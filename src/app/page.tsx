'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { LiveKitRoom, RoomAudioRenderer, useDataChannel, useLocalParticipant } from '@livekit/components-react';
import SmartGlassHUD from '@/components/SmartGlassHUD';
import ProductResults from '@/components/ProductResults';
import LiveKitCameraView from '@/components/LiveKitCameraView';
import { AppState, Product, SearchResult, AgentPayload } from '@/lib/types';

// Generate a random room name so LiveKit always triggers a fresh agent dispatch on reload
const ROOM_NAME = `checky-room-${Math.random().toString(36).substring(2, 8)}`;

// ── Inner app — must be inside <LiveKitRoom> to use LiveKit hooks ─────────────
function CheckyApp() {
  const [appState, setAppState] = useState<AppState>('idle');
  const [cameraReady, setCameraReady] = useState(false);
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [likedAsins, setLikedAsins] = useState<Set<string>>(new Set());
  const [excludedAsins, setExcludedAsins] = useState<Set<string>>(new Set());
  const [agentConnected, setAgentConnected] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState('');
  
  const { localParticipant } = useLocalParticipant();

  function handleManualSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!chatInput.trim() || !localParticipant) return;
    
    setSearchQuery(chatInput);
    setAppState('searching');
    
    const payload = JSON.stringify({ action: "manual_search", query: chatInput });
    localParticipant.publishData(new TextEncoder().encode(payload), { reliable: true });
    
    setChatInput('');
  }

  // ── Data Channel — receive product data from Python agent ─────────────────
  useDataChannel((msg) => {
    try {
      const payload = JSON.parse(new TextDecoder().decode(msg.payload)) as AgentPayload;

      switch (payload.action) {
        case 'agent_ready':
          setAgentConnected(true);
          setAppState('listening');
          break;

        case 'searching':
          setSearchQuery(payload.query);
          setAppState('searching');
          break;

        case 'show_product': {
          const { query, products, source, pending } = payload.data;
          setSearchResult({
            query,
            products,
            timestamp: Date.now(),
            source,
            pending,
          });
          setAppState('results');
          break;
        }
      }
    } catch (e) {
      console.warn('[page] data channel parse error:', e);
    }
  });

  // When camera track is ready, enter listening state
  const handleCameraReady = useCallback(() => {
    setCameraReady(true);
    if (!agentConnected) {
      setAppState('listening');
    }
  }, [agentConnected]);

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
    setAppState(agentConnected ? 'listening' : 'idle');
    setSearchResult(null);
    setSearchQuery(null);
    setExcludedAsins(new Set());
  }

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black">
      {/* LiveKit audio renderer — plays Gemini's spoken responses */}
      <RoomAudioRenderer />

      {/* Live camera feed via LiveKit */}
      <LiveKitCameraView onReady={handleCameraReady} />

      {/* HUD overlay — always visible */}
      <SmartGlassHUD
        appState={appState}
        likedCount={likedAsins.size}
        agentConnected={agentConnected}
      />

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
              <div className="w-10 h-10 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
            </div>
            <span className="font-mono text-xs glow-blue hud-blink">SCANNING AMAZON PRICES…</span>
            {searchQuery && (
              <span className="font-mono text-xs text-gray-400">&quot;{searchQuery}&quot;</span>
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

      {/* Manual Search Input */}
      {cameraReady && (appState === 'listening' || appState === 'idle') && (
        <div className="absolute bottom-10 inset-x-0 flex justify-center" style={{ zIndex: 20 }}>
          <form 
            onSubmit={handleManualSearch}
            className="w-full max-w-md mx-4 glass-card rounded-full overflow-hidden flex"
          >
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Or type a product name to search..."
              className="w-full bg-transparent border-none outline-none text-white px-6 py-3 font-mono text-sm placeholder:text-gray-500"
              disabled={!agentConnected}
            />
            <button 
              type="submit"
              disabled={!chatInput.trim() || !agentConnected}
              className="px-6 text-cyan-400 font-mono text-sm font-bold disabled:opacity-50 hover:bg-white/5 transition-colors"
            >
              SEARCH
            </button>
          </form>
        </div>
      )}

      {/* Camera connecting state */}
      {!cameraReady && (
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{ zIndex: 30 }}
        >
          <div className="glass-card rounded-2xl p-8 text-center max-w-sm mx-4">
            <div className="text-4xl mb-4">📷</div>
            <div className="font-mono text-sm glow-green mb-2">INITIALISING CAMERA</div>
            <div className="font-mono text-xs text-gray-400">
              Allow camera &amp; microphone access when prompted
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Outer shell — fetches LiveKit token then mounts <LiveKitRoom> ─────────────
export default function HomePage() {
  const [token, setToken] = useState<string | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const liveKitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;

  useEffect(() => {
    const identity = `user-${Math.random().toString(36).slice(2, 8)}`;
    fetch(`/api/token?room=${ROOM_NAME}&identity=${identity}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.token) setToken(d.token);
        else setTokenError(d.error ?? 'Token fetch failed');
      })
      .catch((e) => setTokenError(String(e)));
  }, []);

  if (tokenError) {
    return (
      <div className="w-screen h-screen bg-black flex items-center justify-center">
        <div className="glass-card rounded-2xl p-8 text-center max-w-sm mx-4">
          <div className="text-4xl mb-4">⚠️</div>
          <div className="font-mono text-sm glow-green mb-2">LIVEKIT NOT CONFIGURED</div>
          <div className="font-mono text-xs text-gray-400 mb-3">{tokenError}</div>
          <div className="font-mono text-xs text-gray-600 text-left space-y-1">
            <div>1. Create account at livekit.io</div>
            <div>2. Add to <span className="text-cyan-400">.env.local</span>:</div>
            <div className="pl-3 text-cyan-300">LIVEKIT_API_KEY=...</div>
            <div className="pl-3 text-cyan-300">LIVEKIT_API_SECRET=...</div>
            <div className="pl-3 text-cyan-300">NEXT_PUBLIC_LIVEKIT_URL=wss://...</div>
          </div>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="w-screen h-screen bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-full border-2 border-green-400 border-t-transparent animate-spin" />
          <span className="font-mono text-xs glow-green">CONNECTING TO CHECKY…</span>
        </div>
      </div>
    );
  }

  if (!liveKitUrl) {
    return (
      <div className="w-screen h-screen bg-black flex items-center justify-center">
        <div className="glass-card rounded-2xl p-8 text-center max-w-sm mx-4">
          <div className="font-mono text-sm glow-green mb-2">MISSING ENV VAR</div>
          <div className="font-mono text-xs text-cyan-300">NEXT_PUBLIC_LIVEKIT_URL</div>
          <div className="font-mono text-xs text-gray-500 mt-2">Add it to .env.local and restart.</div>
        </div>
      </div>
    );
  }

  return (
    <LiveKitRoom
      video={true}
      audio={true}
      token={token}
      serverUrl={liveKitUrl}
      options={{
        adaptiveStream: true,
        dynacast: true,
      }}
      style={{ width: '100vw', height: '100vh' }}
    >
      <CheckyApp />
    </LiveKitRoom>
  );
}
