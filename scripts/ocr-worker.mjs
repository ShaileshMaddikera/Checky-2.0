/**
 * Local OCR Worker — uses the claude CLI OAuth session (no API key needed)
 *
 * Start:  npm run worker
 * Stop:   Ctrl+C
 *
 * Next.js /api/ocr proxies image POST requests to http://localhost:3001/ocr
 * This worker spawns `claude --print` for each request using the logged-in session.
 */

import http from 'http';
import { spawn } from 'child_process';

const PORT = process.env.OCR_WORKER_PORT ?? 3001;

const PROMPT =
  'Look at this product image and extract ONLY the main product name ' +
  '(not the brand). Reply with ONLY the product name — no punctuation, ' +
  'no explanation. If nothing is readable, reply UNKNOWN.';

/**
 * Run `claude` CLI in non-interactive stream-json mode.
 * Uses the current OAuth session — no ANTHROPIC_API_KEY required.
 */
function runClaudeOCR(imageDataUrl) {
  return new Promise((resolve, reject) => {
    const base64 = imageDataUrl.replace(/^data:image\/\w+;base64,/, '');
    const mediaType = imageDataUrl.startsWith('data:image/png')
      ? 'image/png'
      : 'image/jpeg';

    // stream-json message with image + text
    const inputMsg = JSON.stringify({
      type: 'user',
      message: {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
          { type: 'text', text: PROMPT },
        ],
      },
    });

    const proc = spawn('claude', [
      '--print',
      '--verbose',                         // required by stream-json output
      '--model', 'claude-haiku-4-5-20251001', // fast model for OCR
      '--input-format=stream-json',
      '--output-format=stream-json',
    ]);

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    proc.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

    proc.on('error', (err) => {
      reject(new Error(`claude CLI not found: ${err.message}`));
    });

    proc.on('close', (code) => {
      // Parse NDJSON output — find the {"type":"result"} line
      const lines = stdout.split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const obj = JSON.parse(line);
          if (obj.type === 'result') {
            const text = (obj.result ?? '').trim();
            resolve(text === 'UNKNOWN' || !text ? null : text);
            return;
          }
        } catch { /* skip non-JSON lines */ }
      }

      if (code !== 0) {
        console.error('[ocr-worker] claude exited with code', code, stderr.slice(0, 200));
        reject(new Error(`claude exited with code ${code}`));
      } else {
        resolve(null); // no result line found
      }
    });

    proc.stdin.write(inputMsg + '\n');
    proc.stdin.end();
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  if (req.method !== 'POST' || req.url !== '/ocr') {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'POST /ocr only' }));
    return;
  }

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

  if (!imageDataUrl) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'imageDataUrl required' }));
    return;
  }

  try {
    console.log('[ocr-worker] 🔍 Processing OCR request...');
    const text = await runClaudeOCR(imageDataUrl);
    console.log(`[ocr-worker] ✅ Result: "${text ?? '(empty)'}"`);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ text, source: 'claude-session' }));
  } catch (err) {
    console.error('[ocr-worker] ❌', err.message);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ text: null, error: err.message }));
  }
});

server.listen(PORT, () => {
  console.log(`\n[ocr-worker] ✅ Ready on http://localhost:${PORT}`);
  console.log('[ocr-worker]    Uses claude OAuth session — no API key needed');
  console.log('[ocr-worker]    Waiting for requests...\n');
});

process.on('SIGINT', () => {
  console.log('\n[ocr-worker] Shutting down...');
  server.close(() => process.exit(0));
});
