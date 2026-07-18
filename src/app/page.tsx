'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import CameraFeed, { CameraFeedHandle } from '@/components/CameraFeed';
import SmartGlassHUD from '@/components/SmartGlassHUD';
import VoiceIndicator from '@/components/VoiceIndicator';
import ProductCapture from '@/components/ProductCapture';
import ProductResults from '@/components/ProductResults';
import { useVoiceActivation } from '@/lib/useVoiceActivation';
import { AppState, Product, SearchResult, CaptureData } from '@/lib/types';

export default function HomePage() {
  const [appState, setAppState] = useState<AppState>('idle');
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [captureData, setCaptureData] = useState<CaptureData | null>(null);
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [likedAsins, setLikedAsins] = useState<Set<string>>(new Set());
  const [excludedAsins, setExcludedAsins] = useState<Set<string>>(new Set());

  const cameraRef = useRef<CameraFeedHandle>(null);
  const activationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleActivate = useCallback(() => {
    if (appState !== 'idle' && appState !== 'listening') return;
    setAppState('activated');
    // Auto-deactivate after 8 seconds if no capture command
    activationTimeoutRef.current = setTimeout(() => {
      setAppState((s) => (s === 'activated' ? 'idle' : s));
    }, 8000);
  }, [appState]);

  const handleCapture = useCallback(() => {
    if (appState !== 'activated') return;
    if (activationTimeoutRef.current) clearTimeout(activationTimeoutRef.current);

    const imageDataUrl = cameraRef.current?.captureFrame();
    if (!imageDataUrl) return;

    setCaptureData({ imageDataUrl, ocrText: '', confirmedText: '' });
    setAppState('capturing');
  }, [appState]);

  const { isSupported: isVoiceSupported } = useVoiceActivation({
    onActivate: handleActivate,
    onCapture: handleCapture,
    enabled: cameraReady && (appState === 'idle' || appState === 'listening' || appState === 'activated'),
  });

  // Start listening state when camera is ready
  useEffect(() => {
    if (cameraReady && appState === 'idle') {
      setAppState('listening');
    }
  }, [cameraReady, appState]);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.code === 'Space' && e.target === document.body) {
        e.preventDefault();
        if (appState === 'listening' || appState === 'idle') {
          handleActivate();
        } else if (appState === 'activated') {
          handleCapture();
        }
      }
      if (e.code === 'Escape') {
        if (activationTimeoutRef.current) clearTimeout(activationTimeoutRef.current);
        setAppState(cameraReady ? 'listening' : 'idle');
        setCaptureData(null);
        setSearchResult(null);
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [appState, cameraReady, handleActivate, handleCapture]);

  async function handleSearchConfirm(productName: string) {
    setAppState('searching');
    setCaptureData((prev) => prev ? { ...prev, confirmedText: productName } : null);

    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: productName }),
      });
      const data = await res.json();
      setSearchResult({
        query: productName,
        products: data.products ?? [],
        timestamp: Date.now(),
        source: data.source,
        pending: data.pending ?? false,
      });
      setAppState('results');
    } catch (err) {
      console.error('Search failed:', err);
      setAppState('listening');
      setCaptureData(null);
    }
  }

  function handleLike(product: Product) {
    const key = product.asin ?? product.url;
    setLikedAsins((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handleExclude(product: Product) {
    const key = product.asin ?? product.url;
    setExcludedAsins((prev) => new Set([...prev, key]));
  }

  function handleResultsClose() {
    setAppState('listening');
    setCaptureData(null);
    setSearchResult(null);
    setExcludedAsins(new Set());
  }

  function handleCaptureCancel() {
    setCaptureData(null);
    setAppState('listening');
  }

  // Click anywhere to activate when idle/listening
  function handleScreenTap() {
    if (appState === 'listening') {
      handleActivate();
    } else if (appState === 'activated') {
      handleCapture();
    }
  }

  return (
    <div
      className="relative w-screen h-screen overflow-hidden bg-black"
      onClick={handleScreenTap}
    >
      {/* Camera feed - always behind everything */}
      <CameraFeed
        ref={cameraRef}
        onReady={() => setCameraReady(true)}
        onError={(err) => setCameraError(err)}
      />

      {/* Camera error state */}
      {cameraError && (
        <div className="absolute inset-0 flex items-center justify-center" style={{ zIndex: 30 }}>
          <div className="glass-card rounded-2xl p-8 text-center max-w-sm mx-4">
            <div className="text-4xl mb-4">📷</div>
            <div className="font-mono text-sm glow-green mb-2">CAMERA REQUIRED</div>
            <div className="font-mono text-xs text-gray-400 mb-4">{cameraError}</div>
            <div className="font-mono text-xs text-gray-600">
              Please allow camera access and refresh the page
            </div>
          </div>
        </div>
      )}

      {/* HUD overlay - always visible */}
      <SmartGlassHUD appState={appState} likedCount={likedAsins.size} />

      {/* Voice / activation indicator */}
      {!captureData && !searchResult && (
        <VoiceIndicator appState={appState} isVoiceSupported={isVoiceSupported} />
      )}

      {/* Product capture + OCR */}
      {appState === 'capturing' && captureData && (
        <div onClick={(e) => e.stopPropagation()}>
          <ProductCapture
            imageDataUrl={captureData.imageDataUrl}
            onConfirm={handleSearchConfirm}
            onCancel={handleCaptureCancel}
          />
        </div>
      )}

      {/* Searching indicator */}
      {appState === 'searching' && (
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{ zIndex: 30 }}
        >
          <div className="flex flex-col items-center gap-3">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{ border: '2px solid var(--hud-blue)', boxShadow: '0 0 20px rgba(0,204,255,0.4)' }}
            >
              <div
                className="w-10 h-10 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin"
              />
            </div>
            <span className="font-mono text-xs glow-blue hud-blink">SCANNING AMAZON PRICES...</span>
            {captureData?.confirmedText && (
              <span className="font-mono text-xs text-gray-400">
                &quot;{captureData.confirmedText}&quot;
              </span>
            )}
          </div>
        </div>
      )}

      {/* Product results overlay */}
      {appState === 'results' && searchResult && (
        <div onClick={(e) => e.stopPropagation()}>
          <ProductResults
            result={searchResult}
            likedAsins={likedAsins}
            excludedAsins={excludedAsins}
            onLike={handleLike}
            onExclude={handleExclude}
            onClose={handleResultsClose}
          />
        </div>
      )}

      {/* Tap hint for touch devices */}
      {cameraReady && appState === 'listening' && !cameraError && (
        <div
          className="absolute bottom-20 inset-x-0 text-center pointer-events-none"
          style={{ zIndex: 10 }}
        >
          <p className="font-mono text-xs text-gray-600">
            Tap anywhere to activate
          </p>
        </div>
      )}
    </div>
  );
}
