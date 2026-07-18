'use client';

import { AppState } from '@/lib/types';

interface Props {
  appState: AppState;
  likedCount: number;
}

const STATE_LABELS: Record<AppState, string> = {
  idle: 'STANDBY',
  listening: 'LISTENING',
  activated: 'ACTIVATED',
  capturing: 'CAPTURING',
  ocr: 'ANALYZING',
  searching: 'SEARCHING',
  results: 'RESULTS READY',
};

const STATE_COLORS: Record<AppState, string> = {
  idle: 'text-gray-500',
  listening: 'text-cyan-400',
  activated: 'glow-green',
  capturing: 'glow-green',
  ocr: 'glow-blue',
  searching: 'glow-blue',
  results: 'glow-green',
};

export default function SmartGlassHUD({ appState, likedCount }: Props) {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', { hour12: false });
  const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });

  return (
    <>
      {/* Corner brackets - full viewport */}
      <div className="absolute inset-4 pointer-events-none" style={{ zIndex: 10 }}>
        <div className="hud-corner-tl" />
        <div className="hud-corner-tr" />
        <div className="hud-corner-bl" />
        <div className="hud-corner-br" />
      </div>

      {/* Top bar */}
      <div
        className="absolute top-0 left-0 right-0 flex items-center justify-between px-8 py-3"
        style={{ zIndex: 10 }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
            style={{ background: 'rgba(0,255,136,0.15)', border: '1.5px solid var(--hud-green)' }}
          >
            <span className="glow-green font-mono text-xs">C</span>
          </div>
          <span className="glow-green font-mono text-sm tracking-widest font-bold">CHECKY</span>
        </div>

        {/* Center state */}
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${appState !== 'idle' ? 'bg-green-400' : 'bg-gray-600'} ${appState === 'listening' || appState === 'activated' ? 'hud-blink' : ''}`}
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
          {appState === 'idle' && (
            <>
              <div>Say <span className="text-cyan-400">&quot;Hey Checky&quot;</span> to activate</div>
              <div>or press <span className="text-cyan-400">Space</span> to activate</div>
            </>
          )}
          {appState === 'listening' && (
            <div className="glow-green hud-blink">Say &quot;Check this out&quot; or press Space</div>
          )}
          {(appState === 'searching' || appState === 'ocr') && (
            <div className="glow-blue hud-blink">Processing...</div>
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

      {/* Vignette overlay */}
      <div className="absolute inset-0 vignette pointer-events-none" style={{ zIndex: 2 }} />

      {/* Scanlines */}
      <div className="absolute inset-0 scanlines pointer-events-none" style={{ zIndex: 3 }} />
    </>
  );
}
