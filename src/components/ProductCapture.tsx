'use client';

import { useState, useEffect, useRef } from 'react';

interface Props {
  imageDataUrl: string;
  onConfirm: (text: string) => void;
  onCancel: () => void;
}

export default function ProductCapture({ imageDataUrl, onConfirm, onCancel }: Props) {
  const [ocrText, setOcrText] = useState('');
  const [ocrSource, setOcrSource] = useState<'gemini' | null>(null);
  const [inputText, setInputText] = useState('');
  const [ocrRunning, setOcrRunning] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    runOCR();
    drawHighlight();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function drawHighlight() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      // Darken edges, leave center bright
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      const cw = img.width;
      const ch = img.height;
      const rx = cw * 0.15;
      const ry = ch * 0.15;
      const rw = cw * 0.7;
      const rh = ch * 0.7;
      ctx.fillRect(0, 0, cw, ry);
      ctx.fillRect(0, ry + rh, cw, ch - ry - rh);
      ctx.fillRect(0, ry, rx, rh);
      ctx.fillRect(rx + rw, ry, cw - rx - rw, rh);
      // Rectangle highlight
      ctx.strokeStyle = '#00ff88';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#00ff88';
      ctx.shadowBlur = 12;
      ctx.strokeRect(rx, ry, rw, rh);
      // Corner accents
      const aw = 24;
      ctx.lineWidth = 4;
      [
        [rx, ry, aw, 0, 0, aw],
        [rx + rw, ry, -aw, 0, 0, aw],
        [rx, ry + rh, aw, 0, 0, -aw],
        [rx + rw, ry + rh, -aw, 0, 0, -aw],
      ].forEach(([x, y, dx1, dy1, dx2, dy2]) => {
        ctx.beginPath();
        ctx.moveTo(x + dx1, y + dy1);
        ctx.lineTo(x, y);
        ctx.lineTo(x + dx2, y + dy2);
        ctx.stroke();
      });
    };
    img.src = imageDataUrl;
  }

  function cropAndPreprocess(src: string): Promise<string> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const cw = img.width;
        const ch = img.height;
        // Crop to the same bounding box region shown visually (center 70%)
        const rx = Math.floor(cw * 0.15);
        const ry = Math.floor(ch * 0.15);
        const rw = Math.floor(cw * 0.7);
        const rh = Math.floor(ch * 0.7);

        // Upscale 2x for better character resolution
        const scale = 2;
        const out = document.createElement('canvas');
        out.width = rw * scale;
        out.height = rh * scale;
        const ctx = out.getContext('2d')!;

        // Draw cropped + scaled region
        ctx.drawImage(img, rx, ry, rw, rh, 0, 0, out.width, out.height);

        // Convert to grayscale and boost contrast
        const imageData = ctx.getImageData(0, 0, out.width, out.height);
        const d = imageData.data;
        let minL = 255, maxL = 0;

        // First pass: compute luminance range for contrast stretch
        for (let i = 0; i < d.length; i += 4) {
          const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
          if (lum < minL) minL = lum;
          if (lum > maxL) maxL = lum;
        }
        const range = maxL - minL || 1;

        // Second pass: grayscale + contrast stretch
        for (let i = 0; i < d.length; i += 4) {
          const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
          const stretched = Math.round(((lum - minL) / range) * 255);
          d[i] = d[i + 1] = d[i + 2] = stretched;
        }
        ctx.putImageData(imageData, 0, 0);

        resolve(out.toDataURL('image/png'));
      };
      img.src = src;
    });
  }

  function pickBestLine(raw: string): string {
    const lines = raw
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length >= 3)
      // Keep lines that look like product names: mostly letters/numbers/spaces
      .filter((l) => {
        const alphaRatio = (l.match(/[a-zA-Z0-9 ]/g) ?? []).length / l.length;
        return alphaRatio > 0.6;
      });

    if (lines.length === 0) return '';

    // Score: longer lines with more words and real words rank higher
    const scored = lines.map((l) => {
      const words = l.split(/\s+/).filter((w) => w.length > 1);
      return { line: l, score: words.length * 3 + l.length };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored[0].line;
  }

  async function runOCR() {
    setOcrRunning(true);
    try {
      // OCR is now handled by the Gemini agent via LiveKit.
      // This component is a legacy fallback — product name comes from data channel.
      const visionRes = await fetch('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageDataUrl }),
      });

      if (visionRes.ok) {
        const { text } = await visionRes.json();
        if (text) {
          setOcrText(text);
          setOcrSource('gemini');
          setInputText(text);
          return;
        }
      }
    } catch (err) {
      console.warn('OCR endpoint unavailable (Gemini handles this via LiveKit):', err);
    } finally {
      setOcrRunning(false);
    }
  }

  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center"
      style={{ zIndex: 50, background: 'rgba(0,0,0,0.8)' }}
    >
      {/* Captured image with highlight */}
      <div className="relative w-full max-w-2xl mx-4 mb-4">
        <canvas
          ref={canvasRef}
          className="w-full h-auto rounded-lg"
          style={{ border: '1px solid rgba(0,255,136,0.3)', maxHeight: '45vh', objectFit: 'contain' }}
        />
        {/* Scan line animation */}
        <div
          className="absolute left-0 right-0 pointer-events-none"
          style={{
            top: '15%',
            height: '70%',
            overflow: 'hidden',
          }}
        >
          <div
            className="w-full h-0.5 scan-anim"
            style={{
              background: 'linear-gradient(90deg, transparent, rgba(0,255,136,0.8), transparent)',
            }}
          />
        </div>
      </div>

      {/* OCR result + input */}
      <div
        className="w-full max-w-2xl mx-4 glass-card rounded-xl p-4"
        style={{ border: '1px solid rgba(0,255,136,0.35)' }}
      >
        <div className="flex items-center gap-2 mb-3">
          <div className="w-2 h-2 rounded-full bg-green-400 hud-blink" />
          <span className="font-mono text-xs glow-green tracking-widest">PRODUCT DETECTED</span>
        </div>

        {ocrRunning ? (
          <div className="flex items-center gap-2 text-cyan-400 font-mono text-xs mb-3">
            <div className="w-3 h-3 border border-cyan-400 border-t-transparent rounded-full animate-spin" />
            <span>Identifying product...</span>
          </div>
        ) : (
          ocrText && (
            <div className="font-mono text-xs text-gray-400 mb-2">
              <span className="text-purple-400">
                {ocrSource === 'gemini' ? '⚡ Gemini' : '🔍 Vision'}:
              </span>{' '}
              <span className="text-cyan-300">&quot;{ocrText}&quot;</span>
            </div>
          )
        )}

        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && inputText.trim()) onConfirm(inputText.trim());
              if (e.key === 'Escape') onCancel();
            }}
            placeholder="Product name..."
            className="flex-1 bg-black/60 border border-green-900 focus:border-green-400 rounded px-3 py-2 font-mono text-sm text-white outline-none transition-colors"
          />
          <button
            onClick={() => inputText.trim() && onConfirm(inputText.trim())}
            disabled={!inputText.trim()}
            className="px-4 py-2 rounded font-mono text-xs font-bold transition-all disabled:opacity-40"
            style={{
              background: inputText.trim() ? 'rgba(0,255,136,0.15)' : 'transparent',
              border: '1px solid var(--hud-green)',
              color: 'var(--hud-green)',
            }}
          >
            SEARCH
          </button>
          <button
            onClick={onCancel}
            className="px-3 py-2 rounded font-mono text-xs transition-all"
            style={{
              border: '1px solid rgba(255,255,255,0.2)',
              color: 'rgba(255,255,255,0.5)',
            }}
          >
            ✕
          </button>
        </div>
        <div className="font-mono text-xs text-gray-600 mt-2">
          Enter to search · Esc to cancel
        </div>
      </div>
    </div>
  );
}
