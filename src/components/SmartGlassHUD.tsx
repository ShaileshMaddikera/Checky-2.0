'use client';

import { AppState } from '@/lib/types';

interface Props {
  appState: AppState;
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

/** Top status bar, meant to sit inside the camera panel. */
export default function SmartGlassHUD({ appState, agentConnected = false }: Props) {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const isLive = appState === 'listening' || appState === 'activated' || appState === 'speaking';

  return (
    <div
      className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-3"
      style={{ zIndex: 10 }}
    >
      <div className="flex items-center gap-2">
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold"
          style={{ background: 'var(--accent-soft)', border: '1px solid var(--accent-border)' }}
        >
          <span style={{ color: 'var(--accent)' }}>C</span>
        </div>
        <span className="text-[13px] font-semibold tracking-tight" style={{ color: '#fff' }}>
          Checky
        </span>
        <div
          className="flex items-center gap-1.5 ml-1 px-2 py-0.5 rounded-full"
          style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)' }}
        >
          <div
            className={`w-1.5 h-1.5 rounded-full ${agentConnected ? 'pulse-soft' : ''}`}
            style={{ background: agentConnected ? 'var(--success)' : 'var(--text-tertiary)' }}
          />
          <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.75)' }}>
            {agentConnected ? 'AI online' : 'connecting'}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
          style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)' }}
        >
          <div
            className={`w-1.5 h-1.5 rounded-full ${isLive ? 'pulse-soft' : ''}`}
            style={{ background: appState !== 'idle' ? 'var(--accent)' : 'var(--text-tertiary)' }}
          />
          <span className="text-[10px] font-medium" style={{ color: 'rgba(255,255,255,0.75)' }}>
            {STATE_LABELS[appState]}
          </span>
        </div>
        <span className="text-[10px] tabular-nums" style={{ color: 'rgba(255,255,255,0.5)' }}>
          {timeStr}
        </span>
      </div>
    </div>
  );
}
