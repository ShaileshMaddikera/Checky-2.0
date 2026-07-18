# Checky - Smart Shopping AI

Checky is an AI-powered smart shopping assistant designed for smart glasses. It uses Google's Gemini 2.5 Flash Multimodal Live API to "see" and "hear" what you are looking at in real time. Point your camera at a product and Checky looks up pricing across Amazon, Walmart, and Target from a **Moss** semantic cache — instant, no live network scrape in the loop.

## 🚀 Features
- **Real-Time Multimodal Voice AI:** Uses Gemini Live API via LiveKit to process live video and audio streams.
- **Instant Multi-Retailer Lookup:** Every `check_price()` call is a Moss semantic search — sub-second, no waiting on a live scrape.
- **Offline-Seeded Catalog:** The product catalog is bulk-loaded from Bright Data snapshot exports via `agent/load_snapshots.py`, not scraped live per-query (live scraping was too slow/unreliable for a real-time voice demo — Target/Walmart snapshots can take 1-3+ minutes and time out unpredictably).
- **Honest Misses:** If a product isn't in the catalog, Checky says so and suggests what it does have — it never fabricates a price.
- **Modern Glassmorphic UI:** Clean, translucent dark UI built with Next.js and Tailwind CSS.
- **Manual Text Search:** Bypass the voice agent completely by using the bottom text-input bar for instant searches.

## 🛠️ Project Structure
- `/` - Next.js Frontend (React, Tailwind, LiveKit Components)
- `/agent` - Python LiveKit Worker (Gemini Live API, Moss integration, offline scraper tools)
  - `agent/tools.py` - `check_price()` (Moss-only lookup) plus the Bright Data scraper functions used for offline seeding
  - `agent/load_snapshots.py` - bulk-loads Bright Data snapshot JSON exports from `agent/data/` into Moss (see below)
  - `agent/data/` - drop Bright Data snapshot exports here (gitignored — not committed, can be large)
- `/scripts` - Utility scripts (e.g., `index_to_moss.py` for manual single-keyword Bright Data testing and caching)

## 📦 Seeding the product catalog
Checky reads exclusively from Moss at request time — nothing is scraped live while the agent is running. To populate (or refresh) the catalog:

1. Get Bright Data snapshot exports (JSON array of raw product records) — from a manual scrape via `scripts/index_to_moss.py`, the Bright Data dashboard, or wherever you already have them.
2. Drop the `.json` files into `agent/data/`. Files can mix retailers/queries freely — source (Amazon/Walmart/Target) is auto-detected per record from its URL.
3. Run the loader:
   ```bash
   cd agent && source .venv/bin/activate
   python load_snapshots.py
   ```
   It normalizes every record, de-dupes by ASIN/product ID/URL, and bulk-indexes into Moss in batches.
4. Restart the agent — `check_price()` will now hit Moss for anything in the newly-loaded catalog.

## 🔑 Environment Variables
You need two environment files to run Checky:

**1. Frontend (`.env.local` in the root folder)**
```env
LIVEKIT_API_KEY=your_api_key
LIVEKIT_API_SECRET=your_api_secret
NEXT_PUBLIC_LIVEKIT_URL=wss://your-project.livekit.cloud
```

**2. Python Agent (`agent/.env`)**
```env
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your_api_key
LIVEKIT_API_SECRET=your_api_secret
GOOGLE_API_KEY=your_gemini_api_key
BRIGHTDATA_API=your_brightdata_dataset_url
```

## 🏃‍♂️ How to Run Locally

### 1. Start the Frontend
In a new terminal window at the project root:
```bash
npm install
npm run dev
```
The frontend will start on [http://localhost:3000](http://localhost:3000).

### 2. Start the Python Agent
In a separate terminal window, navigate to the `agent` folder and start the worker:
```bash
cd agent
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Run in dev mode (auto-reloads on file changes)
python agent.py dev
```

### 3. Seed the catalog (first run only)
Checky doesn't scrape live — see [Seeding the product catalog](#-seeding-the-product-catalog) above. Without this step, `check_price()` will just report every product as not found.

### 4. Test the App
1. Open [http://localhost:3000](http://localhost:3000) in your browser.
2. Grant Camera and Microphone permissions.
3. Wait for the Python terminal to log `[checky] Agent started — watching camera and listening...`
4. Either use your voice: **"Hey Checky, check the price of this"** or type a product name into the bottom search bar — try whatever you seeded the catalog with.

## 🤖 AI Agent Guidelines
*(For AI coding assistants working on this repo)*
**Always keep this README up to date** if you modify the startup commands, add new environment variables, or significantly alter the system architecture.
