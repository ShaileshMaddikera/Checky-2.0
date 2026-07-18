'use client';

import { useEffect, useRef, useCallback, useState } from 'react';

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  start(): void;
  stop(): void;
}

interface Options {
  onActivate: () => void;
  onCapture: () => void;
  enabled: boolean;
}

export function useVoiceActivation({ onActivate, onCapture, enabled }: Options) {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const [isSupported, setIsSupported] = useState(false);

  const startListening = useCallback(() => {
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.start();
    } catch {
      // already started
    }
  }, []);

  const stopListening = useCallback(() => {
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.stop();
    } catch {
      // already stopped
    }
  }, []);

  useEffect(() => {
    type AnyConstructor = new () => SpeechRecognitionLike;
    const win = window as Window & { SpeechRecognition?: AnyConstructor; webkitSpeechRecognition?: AnyConstructor };
    const SpeechRecognition = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    setIsSupported(true);

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    let activated = false;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript.toLowerCase().trim();

        if (!activated && transcript.includes('hey checky')) {
          activated = true;
          onActivate();
        }

        if (activated && (transcript.includes('check this out') || transcript.includes('check it out'))) {
          activated = false;
          onCapture();
        }
      }
    };

    recognition.onend = () => {
      if (enabled) {
        try { recognition.start(); } catch { /* ignore */ }
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        console.warn('Speech recognition error:', event.error);
      }
    };

    recognitionRef.current = recognition;

    if (enabled) {
      try { recognition.start(); } catch { /* ignore */ }
    }

    return () => {
      try { recognition.stop(); } catch { /* ignore */ }
    };
  }, [enabled, onActivate, onCapture]);

  return { isSupported, startListening, stopListening };
}
