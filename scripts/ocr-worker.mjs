/**
 * Local OCR Worker — runs as a standalone Node.js process
 * Start: npm run worker   (ANTHROPIC_API_KEY must be in shell environment)
 * Next.js /api/ocr calls http://localhost:3001/ocr
 */

import http from 'http';
import Anthropic from '@anthropic-ai/sdk';

const PORT = process.env.OCR_WORKER_PORT ?? 3001;
const apiKey = process.env.ANTHROPIC_API_KEY;

if (!apiKey) {
  console.error('\n[ocr-worker] ❌  ANTHROPIC_API_KEY is not set in environment.');
  console.error('[ocr-worker]    Run: ANTHROPIC_API_KEY=sk-ant-... npm run worker\n');
  process.exit(1);
}

const client = new Anthropic({ apiKey });

const server = http.createServer(async (req, res) => {
  // CORS headers so Next.js dev server can reach us
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method !== 'POST' || req.url !== '/ocr') {
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found' }));
    return;
  }

  // Read request body
  let body = '';
  for await (const chunk of req) body += chunk;

  let imageDataUrl;
  try {
    ({ imageDataUrl } = JSON.parse(body));
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid JSON' }));
    return;
  }

  if (!imageDataUrl || typeof imageDataUrl !== 'string') {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'imageDataUrl required' }));
    return;
  }

  try {
    const base64 = imageDataUrl.replace(/^data:image\/\w+;base64,/, '');
    const mediaType = imageDataUrl.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';

    console.log('[ocr-worker] 🔍 OCR request received, processing...');

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
              text: 'Look at this product image and extract ONLY the main product name (not the brand name). Reply with ONLY the product name — no extra words, no punctuation, no explanation. If nothing is readable, reply "UNKNOWN".',
            },
          ],
        },
      ],
    });

    const raw = response.content[0].type === 'text' ? response.content[0].text.trim() : null;
    const text = raw === 'UNKNOWN' || !raw ? null : raw;

    console.log(`[ocr-worker] ✅ Result: "${text ?? '(empty)'}"`);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ text, source: 'claude-local-worker' }));
  } catch (err) {
    console.error('[ocr-worker] ❌ Claude API error:', err.message);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ text: null, error: err.message }));
  }
});

server.listen(PORT, () => {
  console.log(`\n[ocr-worker] ✅ Local OCR worker running on http://localhost:${PORT}`);
  console.log('[ocr-worker]    Waiting for requests from Next.js app...\n');
});

process.on('SIGINT', () => {
  console.log('\n[ocr-worker] Shutting down...');
  server.close();
  process.exit(0);
});
