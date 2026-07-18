## Project Ideas

Goal: This is a realtime voice application to check the price online and help with smart shopping.

The user points their camera at a product, says "Hey Checky, check this out",
and Gemini (watching the live video stream) identifies the product and looks up
Amazon prices using Moss + Bright Data.

---

## Architecture (LiveKit + Gemini Multimodal)

```
Browser (LiveKit Room) ──video+audio──▶ Python Agent (agent/agent.py)
                                              │
                                              ▼
                                    Gemini 2.0 Flash (Multimodal Live)
                                    sees camera + hears mic 24/7
                                              │ tool call
                                              ▼
                                    check_price(product_name)
                                    ├─ Moss cache (fast path)
                                    └─ Bright Data scrape (slow path)
                                              │ data channel
                                              ▼
                               Next.js useDataChannel() → UI overlay
```

### Tech Stack

- **Next.js 14.2** + TypeScript 6 + Tailwind CSS v4
- **LiveKit Cloud** — real-time audio/video streaming room
- **livekit-agents** (Python) — agent worker framework
- **Gemini 2.0 Flash Multimodal Live** — vision + voice AI
- **Moss.dev** — semantic product cache (sub-10ms after first load)
- **Bright Data Amazon Scraper API** — live keyword search + prices

---

## Running (two terminals)

**Terminal 1 — Python Agent:**

```bash
cd agent
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in your keys
python agent.py dev
```

**Terminal 2 — Next.js:**

```bash
npm run dev
# Open http://localhost:3000 in Chrome/Edge
```

---

## One-time setup

```bash
npm install
```

Copy `.env.local.example` to `.env.local` and fill in:
- `LIVEKIT_URL` + `NEXT_PUBLIC_LIVEKIT_URL` — from livekit.io
- `LIVEKIT_API_KEY` + `LIVEKIT_API_SECRET` — from livekit.io
- `BRIGHTDATA_API_KEY` — from brightdata.com
- `MOSS_PROJECT_ID` + `MOSS_PROJECT_KEY` — from moss.dev
- `GEMINI_API_KEY` — from aistudio.google.com (goes in `agent/.env`)

---

## Search Flow

1. User says "Hey Checky, check this out" while pointing camera at product
2. Gemini identifies product name from live video frame
3. Agent calls `check_price(product_name)` tool
4. Moss cache check (semantic, sub-10ms after first load)
5. Cache miss → Bright Data Amazon API
6. Results published via LiveKit data channel → Next.js renders overlay
7. Gemini speaks result aloud ("That's Advil, $8.49 on Amazon")

---

## Presentation Flow

- Record demo videos from Walgreens, Target, 7-Eleven (pointing products with fingers)
- Competitors: ShopSavvy, BuyVia, Honey
- Checky difference: preserves the joy of offline shopping while making it smarter

---

## Design Doc

`docs/superpowers/`
