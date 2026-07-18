'use client';

import { AppState } from '@/lib/types';

interface Props {
  appState: AppState;
  isVoiceSupported: boolean;
}

export default function VoiceIndicator({ appState, isVoiceSupported }: Props) {
  if (appState === 'idle') return null;
  if (appState === 'results' || appState === 'capturing' || appState === 'ocr' || appState === 'searching') return null;

  return (
    <div
      className="absolute inset-0 flex items-center justify-center pointer-events-none"
      style={{ zIndex: 20 }}
    >
      {/* Outer pulse rings */}
      {(appState === 'listening' || appState === 'activated') && (
        <>
          <div
            className="absolute rounded-full pulse-ring"
            style={{
              width: 120,
              height: 120,
              border: `2px solid ${appState === 'activated' ? 'rgba(0,255,136,0.6)' : 'rgba(0,204,255,0.4)'}`,
            }}
          />
          <div
            className="absolute rounded-full pulse-ring"
            style={{
              width: 120,
              height: 120,
              border: `2px solid ${appState === 'activated' ? 'rgba(0,255,136,0.4)' : 'rgba(0,204,255,0.2)'}`,
              animationDelay: '0.4s',
            }}
          />
        </>
      )}

      {/* Center circle */}
      <div
        className="relative flex flex-col items-center justify-center rounded-full"
        style={{
          width: 96,
          height: 96,
          background:
            appState === 'activated'
              ? 'radial-gradient(circle, rgba(0,255,136,0.2), rgba(0,0,0,0.8))'
              : 'radial-gradient(circle, rgba(0,204,255,0.15), rgba(0,0,0,0.7))',
          border: `2px solid ${appState === 'activated' ? 'var(--hud-green)' : 'rgba(0,204,255,0.6)'}`,
          boxShadow:
            appState === 'activated'
              ? '0 0 24px rgba(0,255,136,0.4)'
              : '0 0 16px rgba(0,204,255,0.3)',
        }}
      >
        <span style={{ fontSize: 28 }}>{appState === 'activated' ? '🎯' : '🎙️'}</span>
        <span
          className="font-mono text-xs mt-1"
          style={{ color: appState === 'activated' ? 'var(--hud-green)' : 'var(--hud-blue)' }}
        >
          {appState === 'activated' ? 'READY' : 'LISTENING'}
        </span>
      </div>

      {/* Status text below */}
      <div className="absolute" style={{ top: 'calc(50% + 68px)' }}>
        <p
          className="font-mono text-xs text-center hud-blink"
          style={{ color: appState === 'activated' ? 'var(--hud-green)' : 'var(--hud-blue)' }}
        >
          {appState === 'activated'
            ? '"Check this out"'
            : isVoiceSupported
            ? '"Hey Checky" detected'
            : 'Voice not available · use Space'}
        </p>
      </div>
    </div>
  );
}
