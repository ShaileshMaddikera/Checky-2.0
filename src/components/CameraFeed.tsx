'use client';

import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';

export interface CameraFeedHandle {
  captureFrame: () => string | null;
  getVideoElement: () => HTMLVideoElement | null;
}

interface Props {
  onReady?: () => void;
  onError?: (err: string) => void;
}

const CameraFeed = forwardRef<CameraFeedHandle, Props>(function CameraFeed(
  { onReady, onError },
  ref
) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useImperativeHandle(ref, () => ({
    captureFrame() {
      const video = videoRef.current;
      if (!video) return null;

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      ctx.drawImage(video, 0, 0);
      return canvas.toDataURL('image/jpeg', 0.92);
    },
    getVideoElement() {
      return videoRef.current;
    },
  }));

  useEffect(() => {
    let active = true;

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => onReady?.();
        }
      } catch (err) {
        onError?.(err instanceof Error ? err.message : 'Camera access denied');
      }
    }

    startCamera();

    return () => {
      active = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted
      className="absolute inset-0 w-full h-full object-cover"
      style={{ transform: 'scaleX(1)' }}
    />
  );
});

export default CameraFeed;
