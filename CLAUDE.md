## Project Ideas

Goal: This is a realtime voice application to check the price in the online and help the smart shopping.

1. The user call 'Hey checky' (at least just visual effect like voice ai has activated)
2. And point out the product they want to check and say 'check this out'.
3. The application highlight the product in rectangle, and capture it. the captured product image show up and ocr the product name.
4. Moss.dev search the product information from our database and show the same products in Amazon
5. Compare the prices
6. Below that row, there is a Similar items row.
7. The user can exclude it or put in liked items bucket.

- Please make sure the UI should be always show the picture/video that looks like a recording through a camera and the components should be on the overlay of the screen. I want to make it looks like a smart glass view but the application runs on a laptop or a mobile phone.

### References

moss.dev documentation: https://docs.moss.dev/docs
Bright data dataset market place documentation: https://docs.brightdata.com/datasets/marketplace/overview

## Presentation flow

- record some videos from Walgreens, Target, and 7 Eleven. (pointing product with fingers/just recording). These are for demo.
- There are some competitors like shopsavvy, buyvia, and honey. But, one the difference of checky is that it designed to maintain the joy of offline shopping experience while consume smarter.

---

## Implementation Status (MVP)

### Tech Stack

- Next.js 14.2 + TypeScript 6 + Tailwind CSS v4
- OCR: local worker (`npm run worker`) → Claude Haiku Vision, fallback Tesseract.js
- Moss.dev JS SDK — semantic product cache (indexed from Bright Data results)
- Bright Data Amazon Scraper API — keyword search + live prices
- Web Speech API — voice activation

### Running (two terminals)

**Terminal 1 — OCR worker (uses claude OAuth session, no API key needed):**

```bash
npm run worker
```

**Terminal 2 — Next.js:**

```bash
npm run dev
# Open http://localhost:3000 in Chrome/Edge
```

### One-time setup

```bash
npm install
npm install @moss-dev/moss
# .env.local already has real API keys
```

### Environment Variables

- `BRIGHTDATA_API_KEY` — Bright Data API key (live Amazon search)
- `MOSS_PROJECT_ID` — Moss project ID
- `MOSS_PROJECT_KEY` — Moss project key
- `OCR_WORKER_URL` — local OCR worker URL (default: http://localhost:3001)

### Search Flow

1. Moss cache check (semantic, sub-10ms after first load)
2. Cache miss → Bright Data Amazon API
3. Results cached to Moss for future searches

### OCR Flow

1. Capture → crop center 70% → grayscale + contrast
2. POST to `/api/ocr` → forwarded to `localhost:3001` worker
3. Worker: Claude Haiku Vision → product name
4. Worker offline → Tesseract.js browser fallback

### Design Doc

`docs/superpowers/specs/2026-07-18-checky-mvp-design.md`
