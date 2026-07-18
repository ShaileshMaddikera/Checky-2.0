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

---

## Implementation Status (MVP)

### Tech Stack
- Next.js 14.2 + TypeScript 6 + Tailwind CSS v4
- Tesseract.js v7 (client-side OCR)
- Bright Data Amazon Scraper API (keyword product search)
- Web Speech API (voice activation)

### Setup
```bash
npm install
cp .env.local.example .env.local
# Add BRIGHTDATA_API_KEY to .env.local (get from brightdata.com user settings)
npm run dev
```

### Usage
- Open http://localhost:3000 in Chrome/Edge (required for Web Speech API)
- Allow camera + microphone access
- Say "Hey Checky" to activate, then "Check this out" to capture
- OR press Space to activate, Space again to capture
- Press Escape to dismiss

### Environment Variables
- `BRIGHTDATA_API_KEY` — Required for live Amazon search. Get from brightdata.com → User Settings. Without it, mock data is used.
- `MOSS_API_KEY` — Optional, reserved for v2 product caching via Moss.dev
- `MOSS_INDEX_ID` — Optional, reserved for v2

### Design Doc
`docs/superpowers/specs/2026-07-18-checky-mvp-design.md`
