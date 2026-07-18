import { NextRequest, NextResponse } from 'next/server';

const WORKER_URL = process.env.OCR_WORKER_URL ?? 'http://localhost:3001';

export async function POST(req: NextRequest) {
  try {
    const { imageDataUrl } = await req.json();

    if (!imageDataUrl || typeof imageDataUrl !== 'string') {
      return NextResponse.json({ error: 'imageDataUrl required' }, { status: 400 });
    }

    // Delegate to local OCR worker (started with `npm run worker`)
    const workerRes = await fetch(`${WORKER_URL}/ocr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageDataUrl }),
      signal: AbortSignal.timeout(15000),
    });

    if (!workerRes.ok) {
      return NextResponse.json({ text: null, source: 'worker_error' }, { status: 200 });
    }

    const data = await workerRes.json();
    return NextResponse.json(data);
  } catch (err) {
    // Worker is not running — Next.js will fall back to Tesseract in the browser
    console.warn('[api/ocr] Worker unreachable:', (err as Error).message);
    return NextResponse.json({ text: null, source: 'worker_offline' }, { status: 200 });
  }
}
