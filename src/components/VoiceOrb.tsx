'use client';

import { GeminiVoiceState } from '@/lib/types';

interface Props {
  voiceState: GeminiVoiceState;
  agentConnected: boolean;
}

const LABELS: Record<GeminiVoiceState, string> = {
  initializing: 'Starting up…',
  idle: 'Idle',
  listening: 'Listening',
  thinking: 'Thinking',
  speaking: 'Speaking',
};

/** Animated voice-reactive centerpiece — fills the space the camera used to occupy. */
export default function VoiceOrb({ voiceState, agentConnected }: Props) {
  const active = agentConnected && voiceState !== 'idle' && voiceState !== 'initializing';
  const label = !agentConnected ? 'Connecting…' : LABELS[voiceState];

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center gap-7">
      <div className="relative flex items-center justify-center" style={{ width: 240, height: 240 }}>
        {active && (
          <>
            <div
              className="absolute inset-0 rounded-full"
              style={{ border: '1px solid var(--accent-border)', animation: 'ring-ripple 2.4s ease-out infinite' }}
            />
            <div
              className="absolute inset-0 rounded-full"
              style={{ border: '1px solid var(--accent-border)', animation: 'ring-ripple 2.4s ease-out infinite 0.8s' }}
            />
            <div
              className="absolute inset-0 rounded-full"
              style={{ border: '1px solid var(--accent-border)', animation: 'ring-ripple 2.4s ease-out infinite 1.6s' }}
            />
          </>
        )}

        {voiceState === 'thinking' && (
          <div
            className="absolute rounded-full"
            style={{
              width: 178,
              height: 178,
              background: 'conic-gradient(from 0deg, var(--accent), transparent 55%)',
              animation: 'orb-spin 1s linear infinite',
              WebkitMaskImage: 'radial-gradient(closest-side, transparent 76%, black 78%)',
              maskImage: 'radial-gradient(closest-side, transparent 76%, black 78%)',
            }}
          />
        )}

        <div
          className="rounded-full"
          style={{
            width: voiceState === 'speaking' ? 132 : 108,
            height: voiceState === 'speaking' ? 132 : 108,
            background:
              'radial-gradient(circle at 35% 30%, rgba(147,157,250,0.95), rgba(99,102,241,0.4) 58%, transparent 76%)',
            boxShadow: agentConnected ? '0 0 70px rgba(129,140,248,0.35)' : 'none',
            transition: 'width 0.35s ease, height 0.35s ease',
            animation: agentConnected ? 'orb-pulse 2.8s ease-in-out infinite' : 'none',
            opacity: agentConnected ? 1 : 0.4,
          }}
        />

        {voiceState === 'speaking' && (
          <div className="absolute flex items-end gap-1" style={{ bottom: 30 }}>
            {[...Array(9)].map((_, i) => (
              <div
                key={i}
                className="rounded-full"
                style={{
                  width: 3,
                  background: '#fff',
                  height: `${10 + Math.random() * 26}px`,
                  animation: `waveform-bar ${0.35 + i * 0.05}s ease-in-out infinite alternate`,
                }}
              />
            ))}
          </div>
        )}
      </div>

      <span className="text-[12px] font-medium tracking-wide" style={{ color: 'var(--text-secondary)' }}>
        {label}
      </span>
    </div>
  );
}
