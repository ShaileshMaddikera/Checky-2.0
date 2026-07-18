'use client';

/**
 * LiveKitCameraView — renders the user's own camera track full-screen.
 *
 * Replaces the old CameraFeed.tsx (which used getUserMedia directly).
 * LiveKit manages the media stream — we just render it.
 */

import { useEffect, useRef } from 'react';
import { useTracks, VideoTrack } from '@livekit/components-react';
import { Track } from 'livekit-client';
import type { TrackReference } from '@livekit/components-react';

interface Props {
  onReady?: () => void;
}

export default function LiveKitCameraView({ onReady }: Props) {
  // withPlaceholder:false so we only get real tracks (no TrackReferencePlaceholder)
  const tracks = useTracks([{ source: Track.Source.Camera, withPlaceholder: false }], {
    onlySubscribed: false,
  });

  // Find our own local camera track
  const localTrack = tracks.find(
    (t) => t.participant?.isLocal && t.source === Track.Source.Camera
  ) as TrackReference | undefined;

  const didNotifyRef = useRef(false);

  useEffect(() => {
    if (localTrack && !didNotifyRef.current) {
      didNotifyRef.current = true;
      onReady?.();
    }
  }, [localTrack, onReady]);

  if (!localTrack) {
    return (
      <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: 'var(--accent-border)', borderTopColor: 'transparent' }}
          />
          <span className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>Connecting camera…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 bg-black overflow-hidden">
      <VideoTrack
        trackRef={localTrack}
        className="w-full h-full object-cover"
        style={{ transform: 'scaleX(-1)' }} /* Mirror for natural selfie feel */
      />
    </div>
  );
}
