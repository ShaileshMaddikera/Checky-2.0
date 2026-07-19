'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useDataChannel,
  useLocalParticipant,
  useAudioPlayback,
} from '@livekit/components-react';
import SmartGlassHUD from '@/components/SmartGlassHUD';
import ProductResults from '@/components/ProductResults';
import VoiceOrb from '@/components/VoiceOrb';
import LiveKitCameraView from '@/components/LiveKitCameraView';
import { AppState, Product, SearchResult, AgentPayload, ScrapeSourceStatus, GeminiVoiceState } from '@/lib/types';

// Generate a random room name so LiveKit always triggers a fresh agent dispatch on reload
const ROOM_NAME = `checky-room-${Math.random().toString(36).substring(2, 8)}`;

// ── Inner app — must be inside <LiveKitRoom> to use LiveKit hooks ─────────────
function CheckyApp() {
  const [appState, setAppState] = useState<AppState>('listening');
  const [cameraReady, setCameraReady] = useState(false);
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [likedAsins, setLikedAsins] = useState<Set<string>>(new Set());
  const [excludedAsins, setExcludedAsins] = useState<Set<string>>(new Set());
  const [agentConnected, setAgentConnected] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [voiceState, setVoiceState] = useState<GeminiVoiceState>('idle');
  const [scrapeProgress, setScrapeProgress] = useState<{
    completed: number;
    total: number;
    sources: Record<string, ScrapeSourceStatus>;
  } | null>(null);

  const { localParticipant } = useLocalParticipant();
  // Browsers block autoplay of remote audio until a user gesture unlocks it —
  // without this, Gemini's spoken replies are generated and sent but never
  // actually play, which looks exactly like "voice doesn't work".
  const { canPlayAudio, startAudio } = useAudioPlayback();

  const agentSpeaking = voiceState === 'speaking';

  const handleCameraReady = useCallback(() => setCameraReady(true), []);

  function handleScan() {
    if (!localParticipant) return;
    setSearchQuery(null);
    setAppState('searching');
    const payload = JSON.stringify({ action: 'scan_request' });
    localParticipant.publishData(new TextEncoder().encode(payload), { reliable: true });
  }

  function handleManualSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!chatInput.trim() || !localParticipant) return;

    setSearchQuery(chatInput);
    setAppState('searching');

    const payload = JSON.stringify({ action: 'manual_search', query: chatInput });
    localParticipant.publishData(new TextEncoder().encode(payload), { reliable: true });

    setChatInput('');
  }

  // ── Data Channel — receive product data + voice state from Python agent ───
  useDataChannel((msg) => {
    try {
      const payload = JSON.parse(new TextDecoder().decode(msg.payload)) as AgentPayload;

      switch (payload.action) {
        case 'agent_ready':
          setAgentConnected(true);
          setAppState('listening');
          break;

        case 'agent_state':
          setVoiceState(payload.state);
          break;

        case 'searching':
          setSearchQuery(payload.query);
          setScrapeProgress(null);
          setAppState('searching');
          break;

        case 'scrape_progress': {
          const { completed, total, sources } = payload.data;
          setScrapeProgress({ completed, total, sources });
          break;
        }

        case 'show_product': {
          const { query, products, source, pending } = payload.data;
          setSearchResult({
            query,
            products,
            timestamp: Date.now(),
            source,
            pending,
          });
          setScrapeProgress(null);
          setAppState('results');
          break;
        }
      }
    } catch (e) {
      console.warn('[page] data channel parse error:', e);
    }
  });

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
    <div className="relative w-screen h-screen flex overflow-hidden" style={{ background: 'var(--bg)' }}>
      {/* LiveKit audio renderer — plays Gemini's spoken responses */}
      <RoomAudioRenderer />

      {/* Audio unlock gate — small, non-blocking. Any click satisfies the browser's
          autoplay gesture requirement without covering the rest of the UI. */}
      {!canPlayAudio && (
        <button
          onClick={() => startAudio()}
          className="fixed top-4 left-1/2 -translate-x-1/2 glass-panel rounded-full px-4 py-2 flex items-center gap-2 fade-in"
          style={{ zIndex: 50, border: '1px solid var(--accent-border)' }}
        >
          <span className="text-[15px]">🔊</span>
          <span className="text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>
            Tap to enable sound
          </span>
        </button>
      )}

      {/* Voice panel — right half of the screen, full height. Voice-reactive
          orb is the centerpiece; camera is a small corner thumbnail. */}
      <div
        className="relative order-2 h-full flex-shrink-0 overflow-hidden"
        style={{
          width: '50%',
          borderLeft: '1px solid var(--border)',
          background:
            'radial-gradient(60% 50% at 50% 40%, rgba(129,140,248,0.10), transparent 70%), var(--bg)',
        }}
      >
        <SmartGlassHUD appState={appState} agentConnected={agentConnected} />
        <VoiceOrb voiceState={voiceState} agentConnected={agentConnected} />

        {/* Camera — small picture-in-picture thumbnail, bottom-right corner */}
        <div className="absolute bottom-4 right-4 flex items-end gap-2" style={{ zIndex: 8 }}>
          {cameraReady && (appState === 'listening' || appState === 'idle') && (
            <button
              onClick={handleScan}
              disabled={!agentConnected}
              className="glass-panel w-9 h-9 rounded-full flex items-center justify-center text-sm disabled:opacity-30 transition-transform active:scale-95 flex-shrink-0"
              style={{ border: '1px solid var(--accent-border)' }}
              title="Scan item with camera"
            >
              📷
            </button>
          )}
          <div
            className="relative rounded-2xl overflow-hidden flex-shrink-0"
            style={{
              width: 128,
              height: 96,
              border: '1px solid var(--border)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
              background: '#000',
            }}
          >
            <LiveKitCameraView onReady={handleCameraReady} />
          </div>
        </div>
      </div>

      {/* App area — left half of the screen */}
      <div className="order-1 flex-1 relative flex flex-col px-6 pt-5 pb-6 min-h-0">
        {likedAsins.size > 0 && (
          <div
            className="absolute top-4 right-4 flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-full glass-panel"
            style={{ zIndex: 5 }}
          >
            <span style={{ color: '#f472b6' }}>♥</span>
            <span style={{ color: 'var(--text-primary)' }}>{likedAsins.size} saved</span>
          </div>
        )}

        <div className="text-center text-[12px] mb-2 min-h-[1.5em]" style={{ color: 'var(--text-secondary)' }}>
          {(appState === 'idle' || appState === 'listening') && !agentConnected && (
            <span>Waiting for AI agent to connect…</span>
          )}
          {appState === 'listening' && agentConnected && !agentSpeaking && (
            <span style={{ color: 'var(--text-primary)' }}>
              Say &quot;Hey Checky, check this out&quot;, tap the camera, or search below
            </span>
          )}
          {agentSpeaking && <span style={{ color: 'var(--accent)' }}>Gemini is responding…</span>}
        </div>

        <div className="flex-1" />

        {/* Manual Search Input */}
        {(appState === 'listening' || appState === 'idle') && (
          <form
            onSubmit={handleManualSearch}
            className="w-full glass-panel rounded-full overflow-hidden flex"
          >
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Search a product…"
              className="w-full bg-transparent border-none outline-none px-5 py-3 text-[13px] placeholder:text-[var(--text-tertiary)]"
              style={{ color: 'var(--text-primary)' }}
              disabled={!agentConnected}
            />
            <button
              type="submit"
              disabled={!chatInput.trim() || !agentConnected}
              className="px-5 text-[13px] font-medium disabled:opacity-30 transition-opacity"
              style={{ color: 'var(--accent)' }}
            >
              Search
            </button>
          </form>
        )}
      </div>

      {/* Searching indicator — centered over the whole viewport */}
      {appState === 'searching' && (
        <div
          className="fixed inset-0 flex items-center justify-center pointer-events-none"
          style={{ zIndex: 30 }}
        >
          <div className="glass-panel rounded-3xl flex flex-col items-center gap-3 w-full max-w-xs px-7 py-7 fade-in">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center"
              style={{ border: '1px solid var(--accent-border)', background: 'var(--accent-soft)' }}
            >
              <div
                className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
                style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }}
              />
            </div>
            <span className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>
              Scanning retailers
            </span>
            {searchQuery && (
              <span className="text-[12px] -mt-2" style={{ color: 'var(--text-tertiary)' }}>
                &quot;{searchQuery}&quot;
              </span>
            )}

            {scrapeProgress && scrapeProgress.total > 0 && (
              <div className="w-full mt-1">
                <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${(scrapeProgress.completed / scrapeProgress.total) * 100}%`,
                      background: 'var(--accent)',
                    }}
                  />
                </div>
                <div className="flex justify-center gap-4 mt-3 flex-wrap">
                  {Object.entries(scrapeProgress.sources).map(([source, status]) => (
                    <div key={source} className="flex items-center gap-1.5 text-[11px]">
                      <span className="flex items-center justify-center w-3 h-3">
                        {status === 'pending' && (
                          <span
                            className="block w-2.5 h-2.5 rounded-full border border-t-transparent animate-spin"
                            style={{ borderColor: 'var(--accent-border)', borderTopColor: 'transparent' }}
                          />
                        )}
                        {status === 'done' && <span style={{ color: 'var(--success)' }}>✓</span>}
                        {status === 'empty' && <span style={{ color: 'var(--text-tertiary)' }}>–</span>}
                      </span>
                      <span
                        style={{
                          color:
                            status === 'done'
                              ? 'var(--text-primary)'
                              : status === 'pending'
                              ? 'var(--accent)'
                              : 'var(--text-tertiary)',
                        }}
                      >
                        {source.charAt(0).toUpperCase() + source.slice(1)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
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
      <div className="w-screen h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <div className="glass-panel rounded-3xl p-8 text-center max-w-sm mx-4">
          <div className="text-3xl mb-3">⚠️</div>
          <div className="text-[13px] font-medium mb-1.5" style={{ color: 'var(--text-primary)' }}>
            LiveKit not configured
          </div>
          <div className="text-[12px] mb-4" style={{ color: 'var(--text-tertiary)' }}>{tokenError}</div>
          <div className="text-[11px] text-left space-y-1" style={{ color: 'var(--text-secondary)' }}>
            <div>1. Create account at livekit.io</div>
            <div>2. Add to <span style={{ color: 'var(--accent)' }}>.env.local</span>:</div>
            <div className="pl-3" style={{ color: 'var(--accent)' }}>LIVEKIT_API_KEY=...</div>
            <div className="pl-3" style={{ color: 'var(--accent)' }}>LIVEKIT_API_SECRET=...</div>
            <div className="pl-3" style={{ color: 'var(--accent)' }}>NEXT_PUBLIC_LIVEKIT_URL=wss://...</div>
          </div>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="w-screen h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: 'var(--accent-border)', borderTopColor: 'transparent' }}
          />
          <span className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>Connecting to Checky…</span>
        </div>
      </div>
    );
  }

  if (!liveKitUrl) {
    return (
      <div className="w-screen h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <div className="glass-panel rounded-3xl p-8 text-center max-w-sm mx-4">
          <div className="text-[13px] font-medium mb-1.5" style={{ color: 'var(--text-primary)' }}>Missing env var</div>
          <div className="text-[12px]" style={{ color: 'var(--accent)' }}>NEXT_PUBLIC_LIVEKIT_URL</div>
          <div className="text-[11px] mt-2" style={{ color: 'var(--text-tertiary)' }}>Add it to .env.local and restart.</div>
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
