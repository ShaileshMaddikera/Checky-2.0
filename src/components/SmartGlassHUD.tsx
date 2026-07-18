'use client';

import { AppState } from '@/lib/types';

interface Props {
  appState: AppState;
  likedCount: number;
  agentConnected?: boolean;
}

const STATE_LABELS: Record<AppState, string> = {
  idle: 'STANDBY',
  listening: 'LISTENING',
  activated: 'ACTIVATED',
  capturing: 'CAPTURING',
  ocr: 'ANALYZING',
  searching: 'SEARCHING',
  speaking: 'SPEAKING',
  results: 'RESULTS READY',
};

const STATE_COLORS: Record<AppState, string> = {
  idle: 'text-gray-500',
  listening: 'text-cyan-400',
  activated: 'glow-green',
  capturing: 'glow-green',
  ocr: 'glow-blue',
  searching: 'glow-blue',
  speaking: 'glow-green',
  results: 'glow-green',
};

export default function SmartGlassHUD({ appState, likedCount, agentConnected = false }: Props) {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', { hour12: false });
  const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });

  return (
    <>
      {/* Top bar */}
      <div
        className="absolute top-0 left-0 right-0 flex items-center justify-between px-8 py-3"
        style={{ zIndex: 10 }}
      >
        {/* Logo + agent connection dot */}
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
            style={{ background: 'rgba(0,255,136,0.15)', border: '1.5px solid var(--hud-green)' }}
          >
            <span className="glow-green font-mono text-xs">C</span>
          </div>
          <span className="glow-green font-mono text-sm tracking-widest font-bold">CHECKY</span>
          {/* Agent connection indicator */}
          <div className="flex items-center gap-1 ml-1">
            <div
              className={`w-1.5 h-1.5 rounded-full transition-colors ${
                agentConnected ? 'bg-green-400' : 'bg-gray-600'
              } ${agentConnected ? 'hud-blink' : ''}`}
            />
            <span className="font-mono text-xs text-gray-600">
              {agentConnected ? 'AI' : '···'}
            </span>
          </div>
        </div>

        {/* Center state */}
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${appState !== 'idle' ? 'bg-green-400' : 'bg-gray-600'} ${
              appState === 'listening' || appState === 'activated' || appState === 'speaking'
                ? 'hud-blink'
                : ''
            }`}
          />
          <span className={`font-mono text-xs tracking-widest ${STATE_COLORS[appState]}`}>
            {STATE_LABELS[appState]}
          </span>
        </div>

        {/* Clock */}
        <div className="text-right">
          <div className="font-mono text-xs glow-blue">{timeStr}</div>
          <div className="font-mono text-xs text-gray-500">{dateStr}</div>
        </div>
      </div>

      {/* Bottom left - hint text */}
      <div className="absolute bottom-6 left-8 pointer-events-none" style={{ zIndex: 10 }}>
        <div className="font-mono text-xs text-gray-500 space-y-1">
          {(appState === 'idle' || appState === 'listening') && !agentConnected && (
            <div>Waiting for AI agent to connect…</div>
          )}
          {appState === 'listening' && agentConnected && (
            <div className="glow-green hud-blink">Say &quot;Hey Checky, check this out&quot;</div>
          )}
          {appState === 'speaking' && (
            <div className="glow-green hud-blink">Gemini is responding…</div>
          )}
          {(appState === 'searching' || appState === 'ocr') && (
            <div className="glow-blue hud-blink">Processing…</div>
          )}
        </div>
      </div>

      {/* Bottom right - liked count */}
      {likedCount > 0 && (
        <div className="absolute bottom-6 right-8 pointer-events-none" style={{ zIndex: 10 }}>
          <div
            className="flex items-center gap-2 font-mono text-xs px-3 py-1 rounded"
            style={{ background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(0,255,136,0.3)' }}
          >
            <span className="text-pink-400">♥</span>
            <span className="glow-green">{likedCount} saved</span>
          </div>
        </div>
      )}

      {/* Speaking waveform — subtle animated bars when Gemini is talking */}
      {appState === 'speaking' && (
        <div
          className="absolute bottom-6 inset-x-0 flex justify-center items-end gap-1 pointer-events-none"
          style={{ zIndex: 10 }}
        >
          {[...Array(7)].map((_, i) => (
            <div
              key={i}
              className="rounded-full"
              style={{
                width: 3,
                height: `${8 + Math.random() * 20}px`,
                background: 'var(--hud-green)',
                boxShadow: '0 0 6px var(--hud-green)',
                animation: `waveform-bar ${0.4 + i * 0.08}s ease-in-out infinite alternate`,
              }}
            />
          ))}
        </div>
      )}

    </>
  );
}
