# Checky MVP Design

**Date:** 2026-07-18  
**Status:** Implemented

## Product Vision

Checky is a real-time voice-activated smart shopping assistant that runs on a laptop or mobile phone but presents itself as a smart glass / AR overlay UI — the camera feed is always visible as the background, and all controls and results appear as translucent HUD elements on top.

## User Flow

1. App opens → camera feed fills the screen with HUD overlay
2. User says **"Hey Checky"** (or presses Space) → visual activation indicator pulses
3. User points device at a product and says **"Check this out"** (or presses Space again) → app captures frame
4. Captured image appears with rectangle highlight + OCR analysis runs
5. User confirms/edits the detected product name → presses Enter or Search
6. "Scanning Amazon prices..." animation → Bright Data API fetches Amazon results
7. Results panel slides up from bottom: best match, price comparison bar, similar items row
8. User can Like (save) or Exclude (dismiss) any product, view on Amazon

## Architecture

### Tech Stack
- **Framework:** Next.js 14.2 (App Router), TypeScript 6, Tailwind CSS v4
- **OCR:** Tesseract.js v7 (client-side WASM, no API key needed)
- **Product Search:** Bright Data Amazon Scraper API (keyword → product list with prices)
- **Voice:** Web Speech API (browser-native, Chrome/Edge)
- **State:** React `useState` / `useCallback` (no external state manager for MVP)

### File Structure
```
src/
  app/
    page.tsx              — Main app shell, orchestrates all state
    layout.tsx            — Root layout with metadata
    globals.css           — Tailwind v4 + custom HUD CSS animations
    api/search/route.ts   — Server-side Bright Data API proxy
  components/
    CameraFeed.tsx         — MediaDevices camera, exposes captureFrame()
    SmartGlassHUD.tsx      — Corner brackets, clock, state indicator
    VoiceIndicator.tsx     — Pulse rings, listening/activated states
    ProductCapture.tsx     — Canvas frame preview + OCR + product name input
    ProductResults.tsx     — Slide-up panel with featured, price bar, similar items
  lib/
    types.ts               — Shared interfaces (Product, AppState, etc.)
    brightdata.ts          — Bright Data API client + mock fallback
    useVoiceActivation.ts  — Web Speech API hook
```

### State Machine
```
idle → listening (on camera ready)
listening → activated (voice: "hey checky" | key: Space)
activated → capturing (voice: "check this out" | key: Space | 8s timeout → listening)
capturing → searching (on product name confirmed)
searching → results (on API response)
results → listening (on close | key: Escape)
any → listening (key: Escape)
```

### API Integration

**Bright Data Amazon Keyword Search**
- Endpoint: `POST https://api.brightdata.com/datasets/v3/trigger`
- Auth: `Authorization: Bearer BRIGHTDATA_API_KEY`
- Params: `dataset_id=gd_l7q7dkf244hwjntr0&type=discover_new&discover_by=keyword`
- Body: `[{"keyword": "product name", "zipcode": "10001"}]`
- Returns product array with: title, url, asin, price, currency, rating, reviews_count, brand, main_image
- Falls back to mock data when `BRIGHTDATA_API_KEY` is not set (for development)

**Moss.dev** — not implemented in MVP. Intended use: index searched products for semantic re-matching, so repeat searches return cached results. Implementation deferred to v2.

## UI Design Decisions

- **Smart glass aesthetic:** Full-viewport camera feed, dark translucent overlays (backdrop-blur), neon green (#00ff88) as primary HUD color, cyan (#00ccff) for secondary info
- **Scanlines + vignette:** CSS repeating-linear-gradient scanline effect, radial-gradient vignette
- **HUD corners:** CSS border trick for corner bracket decorators
- **Monospace font:** All UI text uses `font-mono` / Courier New for AR/HUD feel
- **Animations:** pulse-ring (activation indicator), scan-line (OCR), slide-up (results panel), hud-blink

## Environment Variables
```
BRIGHTDATA_API_KEY=  # Required for live Amazon search; omit to use mock data
MOSS_API_KEY=        # Optional, for v2 product caching
MOSS_INDEX_ID=       # Optional, for v2 product caching
```

## Known Limitations / v2 Backlog
- Moss.dev integration (product search caching + semantic matching)
- Mobile touch/gesture for product area selection (currently full-frame capture)
- Product barcode scanning as alternative to OCR
- Bright Data async polling (current impl may time out for slow queries)
- Price history charts
- Multi-product comparison mode
