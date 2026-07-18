'use client';

import { useState, useEffect, useRef } from 'react';

interface Props {
  imageDataUrl: string;
  onConfirm: (text: string) => void;
  onCancel: () => void;
}

export default function ProductCapture({ imageDataUrl, onConfirm, onCancel }: Props) {
  const [ocrText, setOcrText] = useState('');
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

  async function runOCR() {
    setOcrRunning(true);
    try {
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('eng');
      const { data } = await worker.recognize(imageDataUrl);
      await worker.terminate();
      const text = data.text.trim().split('\n')[0].trim();
      setOcrText(text);
      setInputText(text);
    } catch (err) {
      console.error('OCR failed:', err);
      setOcrText('');
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
            <span>Running OCR analysis...</span>
          </div>
        ) : (
          ocrText && (
            <div className="font-mono text-xs text-gray-400 mb-2">
              OCR: <span className="text-cyan-300">&quot;{ocrText}&quot;</span>
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
