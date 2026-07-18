/**
 * /api/ocr — RETIRED
 *
 * OCR is now handled natively by Gemini Multimodal Live via the Python agent.
 * This route returns a 410 Gone so any stale client code gets a clear error.
 */

import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    { error: 'OCR route retired. Vision is handled by the Gemini agent via LiveKit.' },
    { status: 410 }
  );
}
