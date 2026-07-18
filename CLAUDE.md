## Project Ideas

Goal: This is a realtime voice application to check the price in the online and help the smart shopping.

1. The user call 'Hey checky' (at least just visual effect like voice ai has activated)
   1-1. Ideally, the moss.dev voice ai work to answer the call like "Yes, I'm here"
2. And point out the product they want to check and say 'check this out'.
3. The application highlight the product in rectangle, and capture it. the captured product image show up and ocr the product name.
4. Moss.dev search the product information from our database and show the same products in Amazon and Walmart
5. Compare the prices
6. Below that row, there is a Similar items row.
7. The user can exclude it or put in liked items bucket.

- Please make sure the UI should be always show the picture/video that looks like a recording through a camera and the components should be on the overlay of the screen. I want to make it looks like a smart glass view but the application runs on a laptop or a mobile phone.

### References

moss.dev documentation: https://docs.moss.dev/docs
Bright data dataset market place documentation: https://docs.brightdata.com/datasets/marketplace/overview
moss.dev voice agent(LiveKit) documentation: https://www.moss.dev/integrations/livekit

## Presentation flow

- I really prefer the human-like design which is not perfect but simple and straightforward.
- Make sure to leave some visual parts as placeholders that is the place for real pictures, 3d images, or pricesly selected design part.

[Problem]

1. My mom absolutely loves shopping.
2. She loves going to local markets, grocery stores, and department stores.
3. Psychological research shows that shopping triggers the same mental
   reward as hunting did for our ancestors — the act of shopping itself
   brings happiness that goes beyond simply meeting our grocery needs.
4. That's why we built a new offline shopping experience: Checky and There are some competitors like shopsavvy, buyvia, and honey. But, one the difference of checky is that it designed to maintain the joy of offline shopping experience while consume smarter.
   [Tech Stack]
5. Checky runs on a dataset of over a million products, scraped using
   Bright Data and indexed with Moss.
   It extracts the product name, or its visual description with Gemini flash model, and the voice agent is powered by LikeKit integrated with moss.
   [Demo]
6. [demo video playing] Checky is built as a smart glasses application,
   and activating it is simple — just say "Hey Checky." Once it's listening,
   you can point at any product and say "Check this out."
   It instantly returns matching listings from multiple online retailers,
   as well as similar items — the same product in a different size or
   quantity, or equivalent products from other brands.
   Since I'm gluten-intolerant, let's ask Checky: "Does this have gluten?"
   (wait for the answer) "Can you recommend a gluten-free alternative?"
   (wait for the answer)
   """ Ideal conversation
   ME: "Does this have gluten?"
   AI: ⚠ Yes — this product contains wheat and is not gluten-free. The main ingredient is enriched macaroni (wheat flour).
   ME: "Can you recommend a gluten-free alternative?"
   AI: Of course! Banza Chickpea Mac & Cheese is a great gluten-free option — $3.29 at Walmart, 4.5★, made with chickpea pasta.
   """
7. Checky bridges offline and online shopping seamlessly. Thank you for watching!

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
- `OCR_WORKER_URL` — local OCR worker URL (default: http://localhost:3002)

### Search Flow

1. Moss cache check (semantic, sub-10ms after first load)
2. Cache miss → Bright Data Amazon API
3. Results cached to Moss for future searches

### OCR Flow

1. Capture → crop center 70% → grayscale + contrast
2. POST to `/api/ocr` → forwarded to `localhost:3002` worker
3. Worker: Claude Haiku Vision → product name
4. Worker offline → Tesseract.js browser fallback

### Design Doc

`docs/superpowers/specs/2026-07-18-checky-mvp-design.md`
