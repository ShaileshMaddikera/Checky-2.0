# Checky - Smart Shopping AI

Checky is an AI-powered smart shopping assistant designed for smart glasses. It uses Google's Gemini 2.5 Flash Multimodal Live API to "see" and "hear" what you are looking at in real time. Simply point your camera at a product, and Checky will use **Bright Data** to scrape Amazon for the real-time price and cache the results locally using **Moss** for instantaneous future queries.

## 🚀 Features
- **Real-Time Multimodal Voice AI:** Uses Gemini Live API via LiveKit to process live video and audio streams.
- **Smart Product Discovery:** Uses Bright Data's Amazon Scraper API to find live pricing and rating data.
- **Lightning Fast Caching:** Leverages the official **Moss Python SDK** to embed and semantically search for previously scanned items, bypassing slow network scrapes.
- **Modern Glassmorphic UI:** Clean, translucent UI built with Next.js and Tailwind CSS.
- **Manual Text Search:** Bypass the voice agent completely by using the bottom text-input bar for instant searches.

## 🛠️ Project Structure
- `/` - Next.js Frontend (React, Tailwind, LiveKit Components)
- `/agent` - Python LiveKit Worker (Gemini Live API, Bright Data integration, Moss integration)
- `/scripts` - Utility scripts (e.g., `index_to_moss.py` for manual Bright Data testing and caching)

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

### 3. Test the App
1. Open [http://localhost:3000](http://localhost:3000) in your browser.
2. Grant Camera and Microphone permissions.
3. Wait for the Python terminal to log `[checky] Agent started — watching camera and listening...`
4. Either use your voice: **"Hey Checky, check the price of this"** or type a product name into the bottom search bar!

### 4. (Optional) Manual Data Bulk-Indexing
If you want to manually seed your Moss cloud cache with Bright Data keyword searches so they are instantaneous for users, you can use the `index_to_moss.py` script:
```bash
# Still inside the `agent/` folder with your .venv active!
cd .. # go back to project root
source agent/.venv/bin/activate

# Trigger a dataset keyword search and pipe it straight into Moss!
python scripts/index_to_moss.py --dataset gd_l7q7dkf244hwjntr0 --keyword "ibuprofen" --source amazon
```

## 🤖 AI Agent Guidelines
*(For AI coding assistants working on this repo)*
**Always keep this README up to date** if you modify the startup commands, add new environment variables, or significantly alter the system architecture.
