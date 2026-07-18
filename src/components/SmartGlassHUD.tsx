'use client';

import { AppState } from '@/lib/types';

interface Props {
  appState: AppState;
  likedCount: number;
  agentConnected?: boolean;
}

const STATE_LABELS: Record<AppState, string> = {
  idle: 'Standby',
  listening: 'Listening',
  activated: 'Activated',
  capturing: 'Capturing',
  ocr: 'Analyzing',
  searching: 'Searching',
  speaking: 'Speaking',
  results: 'Results ready',
};

export default function SmartGlassHUD({ appState, likedCount, agentConnected = false }: Props) {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const isLive = appState === 'listening' || appState === 'activated' || appState === 'speaking';

  return (
    <>
      {/* Top bar */}
      <div
        className="absolute top-0 left-0 right-0 flex items-center justify-between px-5 py-4"
        style={{ zIndex: 10 }}
      >
        {/* Logo + agent connection dot */}
        <div className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold"
            style={{ background: 'var(--accent-soft)', border: '1px solid var(--accent-border)' }}
          >
            <span style={{ color: 'var(--accent)' }}>C</span>
          </div>
          <span className="text-sm font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
            Checky
          </span>
          <div
            className="flex items-center gap-1.5 ml-1 px-2 py-0.5 rounded-full"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <div
              className={`w-1.5 h-1.5 rounded-full ${agentConnected ? 'pulse-soft' : ''}`}
              style={{ background: agentConnected ? 'var(--success)' : 'var(--text-tertiary)' }}
            />
            <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
              {agentConnected ? 'AI online' : 'connecting'}
            </span>
          </div>
        </div>

        {/* Center state pill */}
        <div
          className="flex items-center gap-1.5 px-3 py-1 rounded-full"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <div
            className={`w-1.5 h-1.5 rounded-full ${isLive ? 'pulse-soft' : ''}`}
            style={{ background: appState !== 'idle' ? 'var(--accent)' : 'var(--text-tertiary)' }}
          />
          <span className="text-[11px] font-medium" style={{ color: 'var(--text-secondary)' }}>
            {STATE_LABELS[appState]}
          </span>
        </div>

        {/* Clock */}
        <div className="text-[11px] tabular-nums" style={{ color: 'var(--text-tertiary)' }}>
          {timeStr}
        </div>
      </div>

      {/* Bottom left - hint text */}
      <div className="absolute bottom-6 left-6 pointer-events-none" style={{ zIndex: 10 }}>
        <div className="text-[12px] space-y-1" style={{ color: 'var(--text-secondary)' }}>
          {(appState === 'idle' || appState === 'listening') && !agentConnected && (
            <div>Waiting for AI agent to connect…</div>
          )}
          {appState === 'listening' && agentConnected && (
            <div style={{ color: 'var(--text-primary)' }}>Say &quot;Hey Checky, check this out&quot;</div>
          )}
          {appState === 'speaking' && <div style={{ color: 'var(--text-primary)' }}>Gemini is responding…</div>}
          {(appState === 'searching' || appState === 'ocr') && (
            <div style={{ color: 'var(--accent)' }}>Processing…</div>
          )}
        </div>
      </div>

      {/* Bottom right - liked count */}
      {likedCount > 0 && (
        <div className="absolute bottom-6 right-6 pointer-events-none" style={{ zIndex: 10 }}>
          <div
            className="flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-full glass-panel"
          >
            <span style={{ color: '#f472b6' }}>♥</span>
            <span style={{ color: 'var(--text-primary)' }}>{likedCount} saved</span>
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
                background: 'var(--accent)',
                animation: `waveform-bar ${0.4 + i * 0.08}s ease-in-out infinite alternate`,
              }}
            />
          ))}
        </div>
      )}
    </>
  );
}
