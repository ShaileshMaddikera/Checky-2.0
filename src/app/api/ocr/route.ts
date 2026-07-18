import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ text: null, source: 'no_key' }, { status: 200 });
  }

  try {
    const { imageDataUrl } = await req.json();

    if (!imageDataUrl || typeof imageDataUrl !== 'string') {
      return NextResponse.json({ error: 'imageDataUrl required' }, { status: 400 });
    }

    // Strip the data URL prefix to get pure base64
    const base64 = imageDataUrl.replace(/^data:image\/\w+;base64,/, '');
    const mediaType = imageDataUrl.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 64,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: base64 },
            },
            {
              type: 'text',
              text: 'Extract only the main product name from this image. Reply with ONLY the product name — no brand, no extra words, no punctuation. If you see "Single Origin Cacao Powder" reply exactly "Single Origin Cacao Powder". If nothing is readable, reply "UNKNOWN".',
            },
          ],
        },
      ],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : null;
    const cleaned = text === 'UNKNOWN' || !text ? null : text;

    return NextResponse.json({ text: cleaned, source: 'claude' });
  } catch (err) {
    console.error('Claude Vision OCR failed:', err);
    return NextResponse.json({ text: null, source: 'error' }, { status: 200 });
  }
}
