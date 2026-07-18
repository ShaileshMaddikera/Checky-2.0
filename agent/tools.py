"""
tools.py — Checky Shopping Tools
Exposes check_price() as an AI-callable function for Gemini.

Full pipeline:
  1. Query Moss semantic cache (fast path — sub-10ms after first hit)
  2. Cache miss → trigger Bright Data scraper(s) in background threads
       - Dataset API  (gd_...):  /datasets/v3/scrape + polling
       - Scraper API  (c_...):   /dca/trigger_immediate + polling
  3. ALL results from every source bulk-indexed into Moss for next time
  4. Results published over LiveKit data channel → Next.js UI
"""

import asyncio
import json
import os
import re
import time
import requests
from dotenv import load_dotenv

load_dotenv()

# moss-minilm cosine scores for short product-title text cluster tightly
# (observed 0.65-0.94 even for unrelated queries), so the score threshold alone
# isn't a reliable relevance filter. Require actual word overlap with the query
# as a second gate to avoid false-positive cache hits (e.g. "Sprite" -> "Advil").
_STOPWORDS = {
    "the", "a", "an", "of", "pack", "count", "ct", "oz", "pk", "size",
    "and", "for", "with", "to", "in", "on",
}


def _tokenize(text: str) -> set[str]:
    return {w for w in re.findall(r"[a-z0-9]+", text.lower()) if w not in _STOPWORDS and len(w) > 2}

# ─────────────────────────────────────────────────────────────────────────────
# Bright Data configuration
# Add your collector / dataset IDs here — mix and match both API types.
# ─────────────────────────────────────────────────────────────────────────────

# Scraper Studio collectors (c_... IDs) — Web Scraper API
# Get from: brightdata.com/cp/scrapers → your scraper → "API" tab
# Trigger endpoint: POST /dca/trigger_immediate
SCRAPERS: dict[str, str] = {
    # "amazon":  "c_your_amazon_collector_id",
    # "walmart": "c_your_walmart_collector_id",
    # "target":  "c_your_target_collector_id",
}

# Dataset marketplace (gd_... IDs) — discover_by=<keyword_field> scrape.
# Each retailer's dataset has its own discovery param name and required extra
# fields (found by probing /datasets/v3/scrape and reading its 400 error
# messages) — keyword_field/discover_by aren't interchangeable across datasets.
# Get from: brightdata.com/cp/datasets → your dataset → "API" tab
# Trigger endpoint: POST /datasets/v3/scrape
DATASETS: dict[str, dict] = {
    "amazon": {
        "id": "gd_l7q7dkf244hwjntr0",
        "discover_by": "keyword",
        "keyword_field": "keyword",
        "extra_fields": {"zipcode": "10001"},
    },
    # Walmart dataset (gd_l95fol7l1ru6rlo116) works but is much slower to
    # return snapshots than Amazon/Target in practice — dropped to keep
    # check_price() responsive. Re-add if Bright Data speeds it up.
    "target": {
        "id": "gd_ltppk5mx2lp0v1k0vo",
        "discover_by": "keywords",
        "keyword_field": "keywords",
        "extra_fields": {},
    },
}

BD_BASE       = "https://api.brightdata.com"
BD_SCRAPER    = f"{BD_BASE}/dca"
BD_DATASET    = f"{BD_BASE}/datasets/v3"
POLL_INTERVAL = 10   # seconds between status polls
MAX_WAIT_SECS = 150  # give up after 2.5 minutes; show mock + continue in bg (Target runs slower than Amazon)


# ─────────────────────────────────────────────────────────────────────────────
# Moss client
# ─────────────────────────────────────────────────────────────────────────────

_moss_client = None
_moss_index_loaded = False
_moss_index_exists = False
INDEX_NAME = "products"


def _get_moss():
    global _moss_client
    if _moss_client is not None:
        return _moss_client
    pid = os.getenv("MOSS_PROJECT_ID")
    pkey = os.getenv("MOSS_PROJECT_KEY")
    if not pid or not pkey:
        print("[tools] Moss keys not set — cache disabled")
        return None
    try:
        from moss import MossClient
        _moss_client = MossClient(pid, pkey)
        print("[tools] ✅ Moss client ready")
        return _moss_client
    except ImportError:
        print("[tools] moss SDK not installed — pip install moss")
        return None


async def _ensure_index_loaded() -> bool:
    global _moss_index_loaded, _moss_index_exists
    if _moss_index_loaded:
        return True
    c = _get_moss()
    if not c:
        return False
    try:
        await c.load_index(INDEX_NAME)
        _moss_index_loaded = True
        _moss_index_exists = True
        print("[tools] ✅ Moss index loaded")
        return True
    except Exception as e:
        print(f"[tools] Moss index not found (will create on first write): {e}")
        _moss_index_exists = False
        return False


def _doc_to_product(doc) -> dict:
    m = getattr(doc, "metadata", {}) or {}

    def n(v):
        try:
            return float(v) if v and v != "" else None
        except Exception:
            return None

    return {
        "title":         m.get("title") or (doc.text[:80] if doc.text else ""),
        "url":           m.get("url", ""),
        "asin":          m.get("asin") or None,
        "price":         n(m.get("price")),
        "currency":      m.get("currency") or "USD",
        "rating":        n(m.get("rating")),
        "reviews_count": n(m.get("reviews_count")),
        "brand":         m.get("brand") or None,
        "main_image":    m.get("main_image") or None,
        "availability":  m.get("availability") or None,
        "source":        m.get("source") or "amazon",
    }


def _normalize_raw(raw: dict, source: str) -> dict | None:
    """Normalize any Bright Data raw product dict into Checky schema."""
    def clean(v, fallback=None):
        if v is None or v == "" or v == "N/A":
            return fallback
        return v

    def to_float(v):
        try:
            return float(str(v).replace("$", "").replace(",", "").strip()) if v else None
        except Exception:
            return None

    title = clean(raw.get("title") or raw.get("name") or raw.get("product_name"))
    if not title:
        return None

    images = raw.get("images")
    image_from_list = images[0] if isinstance(images, list) and images else None

    return {
        "title":         title,
        "url":           clean(raw.get("url") or raw.get("product_url") or raw.get("link"), ""),
        "asin":          clean(raw.get("asin") or raw.get("product_id") or raw.get("sku")),
        "price":         to_float(raw.get("price") or raw.get("final_price") or raw.get("sale_price")),
        "currency":      clean(raw.get("currency"), "USD"),
        "rating":        to_float(raw.get("rating") or raw.get("stars") or raw.get("rating_stars")),
        "reviews_count": int(to_float(raw.get("reviews_count") or raw.get("reviews")) or 0) or None,
        "brand":         clean(raw.get("brand") or raw.get("brand_name")),
        "main_image":    clean(raw.get("main_image") or raw.get("image") or raw.get("thumbnail_url") or image_from_list),
        "availability":  clean(raw.get("availability") or raw.get("in_stock")),
        "seller_name":   clean(raw.get("seller_name") or raw.get("seller")),
        "source":        source,
    }


async def _moss_search(query: str) -> list[dict]:
    c = _get_moss()
    if not c:
        return []
    loaded = await _ensure_index_loaded()
    if not loaded:
        return []
    try:
        from moss import QueryOptions
        results = await c.query(INDEX_NAME, query, QueryOptions(top_k=8))
        docs = results.docs if hasattr(results, "docs") else []

        query_tokens = _tokenize(query)
        hits = []
        for d in docs:
            if (d.score or 0) <= 0.55:
                continue
            title = (getattr(d, "metadata", {}) or {}).get("title", "")
            if query_tokens and not (query_tokens & _tokenize(title)):
                continue  # score alone isn't trustworthy for short product titles — require word overlap too
            hits.append(d)

        print(f"[tools] Moss: {len(hits)} hits (score > 0.55 + word overlap) for '{query}'")
        return [_doc_to_product(d) for d in hits]
    except Exception as e:
        print(f"[tools] Moss query error: {e}")
        return []


async def _cache_to_moss(products: list[dict]):
    """Bulk-index all scraped products into Moss."""
    global _moss_index_exists
    c = _get_moss()
    if not c or not products:
        return

    from moss import DocumentInfo, MutationOptions
    docs = []
    for p in products:
        if not p or not p.get("title"):
            continue
        doc_id = (p.get("asin") or p.get("url", ""))[:32]
        if not doc_id:
            continue
        docs.append(DocumentInfo(
            id=doc_id,
            text=" ".join(filter(None, [p.get("title"), p.get("brand")])),
            metadata={
                "title":         str(p.get("title") or ""),
                "url":           str(p.get("url") or ""),
                "asin":          str(p.get("asin") or ""),
                "price":         str(p.get("price") or ""),
                "currency":      str(p.get("currency") or "USD"),
                "rating":        str(p.get("rating") or ""),
                "reviews_count": str(p.get("reviews_count") or ""),
                "brand":         str(p.get("brand") or ""),
                "main_image":    str(p.get("main_image") or ""),
                "availability":  str(p.get("availability") or ""),
                "source":        str(p.get("source") or "amazon"),
            },
        ))

    if not docs:
        return

    try:
        if not _moss_index_exists:
            await c.create_index(INDEX_NAME, docs, model_id="moss-minilm")
            await c.load_index(INDEX_NAME)
            _moss_index_exists = True
            _moss_index_loaded = True
        else:
            await c.add_docs(INDEX_NAME, docs, MutationOptions(upsert=True))
        print(f"[tools] ✅ Indexed {len(docs)} products into Moss")
    except Exception as e:
        print(f"[tools] Moss index error: {e}")


# ─────────────────────────────────────────────────────────────────────────────
# Bright Data — Web Scraper (collector c_...) API
# ─────────────────────────────────────────────────────────────────────────────

def _trigger_scraper(source: str, collector_id: str, keyword: str, api_key: str) -> list[dict]:
    """
    Trigger a Bright Data Scraper Studio collector and wait for results.
    Uses /dca/trigger_immediate for real-time single-keyword queries.
    """
    print(f"[tools]   → Triggering scraper '{source}' (collector={collector_id}) for '{keyword}'")
    try:
        # Trigger immediate — returns a response_id
        resp = requests.post(
            f"{BD_SCRAPER}/trigger_immediate?collector={collector_id}",
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {api_key}",
            },
            json=[{"keyword": keyword}],
            timeout=30,
        )
        resp.raise_for_status()
        data = resp.json()

        # Response may be direct data OR a response_id to poll
        if isinstance(data, list) and data:
            print(f"[tools]   ✅ {source} scraper: {len(data)} products (immediate)")
            products = [_normalize_raw(p, source) for p in data]
            return [p for p in products if p]

        response_id = data.get("response_id") if isinstance(data, dict) else None
        if not response_id:
            print(f"[tools]   ⚠️  {source} scraper returned unexpected: {str(data)[:100]}")
            return []

        # Poll for results
        deadline = time.time() + MAX_WAIT_SECS
        while time.time() < deadline:
            time.sleep(POLL_INTERVAL)
            poll = requests.get(
                f"{BD_SCRAPER}/get_result?response_id={response_id}",
                headers={"Authorization": f"Bearer {api_key}"},
                timeout=30,
            )
            if poll.status_code == 200:
                result = poll.json()
                if isinstance(result, list) and result:
                    print(f"[tools]   ✅ {source} scraper: {len(result)} products")
                    products = [_normalize_raw(p, source) for p in result]
                    return [p for p in products if p]
            elif poll.status_code == 202:
                print(f"[tools]   ⏳ {source} scraper still running...")
            else:
                print(f"[tools]   ❌ {source} poll error: {poll.status_code}")
                break

        print(f"[tools]   ⏱ {source} scraper timed out after {MAX_WAIT_SECS}s")
        return []

    except Exception as e:
        print(f"[tools]   ❌ {source} scraper error: {e}")
        return []


# ─────────────────────────────────────────────────────────────────────────────
# Bright Data — Dataset API (gd_...) keyword discovery
# ─────────────────────────────────────────────────────────────────────────────

def _trigger_dataset(source: str, config: dict, keyword: str, api_key: str) -> list[dict]:
    """
    Trigger a Bright Data dataset keyword-discover scrape and wait for results.
    """
    dataset_id = config["id"]
    discover_by = config["discover_by"]
    input_item = {config["keyword_field"]: keyword, **config.get("extra_fields", {})}

    print(f"[tools]   → Triggering dataset '{source}' (id={dataset_id}) for '{keyword}'")
    try:
        resp = requests.post(
            f"{BD_DATASET}/scrape?dataset_id={dataset_id}&type=discover_new&discover_by={discover_by}&format=json",
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {api_key}",
            },
            json={"input": [input_item]},
            timeout=100,  # the initial trigger call itself (before any polling) can take >60s to ack
        )
        resp.raise_for_status()
        data = resp.json()

        # Synchronous result — list of products returned immediately
        if isinstance(data, list) and data:
            print(f"[tools]   ✅ {source}: {len(data)} products (sync)")
            products = [_normalize_raw(p, source) for p in data]
            return [p for p in products if p]

        # Async snapshot — poll until ready
        snapshot_id = data.get("snapshot_id") if isinstance(data, dict) else None
        if not snapshot_id:
            print(f"[tools]   ⚠️  {source} unexpected response: {str(data)[:120]}")
            return []

        print(f"[tools]   ⏳ {source} snapshot {snapshot_id} — polling every {POLL_INTERVAL}s...")
        deadline = time.time() + MAX_WAIT_SECS
        attempt = 0
        while time.time() < deadline:
            time.sleep(POLL_INTERVAL)
            attempt += 1
            poll = requests.get(
                f"{BD_DATASET}/snapshot/{snapshot_id}?format=json",
                headers={"Authorization": f"Bearer {api_key}"},
                timeout=30,
            )
            if poll.status_code == 200:
                result = poll.json()
                if isinstance(result, list) and result:
                    print(f"[tools]   ✅ {source}: {len(result)} products (attempt {attempt})")
                    products = [_normalize_raw(p, source) for p in result]
                    return [p for p in products if p]
                # Empty list = still processing
                print(f"[tools]   ⏳ {source} snapshot empty (attempt {attempt}), waiting...")
            elif poll.status_code == 202:
                print(f"[tools]   ⏳ {source} still running (attempt {attempt})...")
            else:
                print(f"[tools]   ❌ {source} poll error: {poll.status_code} — {poll.text[:80]}")
                break

        print(f"[tools]   ⏱ {source} timed out after {MAX_WAIT_SECS}s")
        return []

    except Exception as e:
        print(f"[tools]   ❌ {source} error: {e}")
        return []


# ─────────────────────────────────────────────────────────────────────────────
# Orchestration — trigger all sources in parallel threads
# ─────────────────────────────────────────────────────────────────────────────

async def _run_scrapers_with_progress(keyword: str, on_progress=None) -> tuple[list[dict], bool]:
    """
    Trigger every configured source (scrapers + datasets) concurrently, each
    off the event loop thread via asyncio.to_thread. As each source finishes,
    calls `await on_progress(completed, total, status)` so the caller can
    stream live progress (e.g. over the LiveKit data channel) instead of the
    caller only finding out once *everything* is done.

    Returns (merged normalized product list tagged by source, used_mock_fallback).
    """
    api_key = os.getenv("BRIGHTDATA_API_KEY")
    sources_configured = list(SCRAPERS.keys()) + list(DATASETS.keys())

    if not api_key or not sources_configured:
        reason = "BRIGHTDATA_API_KEY not set" if not api_key else "no scrapers or datasets configured"
        print(f"[tools] {reason} — using mock data")
        return _mock_products(keyword), True

    total = len(sources_configured)
    status: dict[str, str] = {s: "pending" for s in sources_configured}

    async def run_source(source: str) -> tuple[str, list[dict]]:
        if source in SCRAPERS:
            products = await asyncio.to_thread(_trigger_scraper, source, SCRAPERS[source], keyword, api_key)
        else:
            products = await asyncio.to_thread(_trigger_dataset, source, DATASETS[source], keyword, api_key)
        return source, products

    tasks = [asyncio.create_task(run_source(s)) for s in sources_configured]
    merged: list[dict] = []
    completed = 0

    for coro in asyncio.as_completed(tasks):
        source, products = await coro
        completed += 1
        status[source] = "done" if products else "empty"
        merged.extend(products)
        if on_progress:
            await on_progress(completed, total, dict(status))

    if not merged:
        print("[tools] All sources failed — using mock data")
        return _mock_products(keyword), True

    sources = {p["source"] for p in merged}
    print(f"[tools] ✅ Scraped {len(merged)} products from: {', '.join(sources)}")
    return merged, False


def _mock_products(keyword: str) -> list[dict]:
    return [
        {"title": f"{keyword} - Best Seller",    "url": "https://www.amazon.com/dp/B09M001", "asin": "B09M001", "price": 14.99, "currency": "USD", "rating": 4.5, "reviews_count": 2140, "brand": "TopBrand",   "availability": "In Stock", "source": "amazon"},
        {"title": f"{keyword} - Value Pack",      "url": "https://www.amazon.com/dp/B09M002", "asin": "B09M002", "price": 9.99,  "currency": "USD", "rating": 4.1, "reviews_count": 890,  "brand": "ValueBrand", "availability": "In Stock", "source": "amazon"},
        {"title": f"{keyword} - Great Value",     "url": "https://www.walmart.com/ip/m001",   "asin": None,      "price": 8.47,  "currency": "USD", "rating": 4.3, "reviews_count": 1204, "brand": "ValueBrand", "availability": "In Stock", "source": "walmart"},
        {"title": f"{keyword} - Premium Edition", "url": "https://www.amazon.com/dp/B09M003", "asin": "B09M003", "price": 24.99, "currency": "USD", "rating": 4.7, "reviews_count": 5302, "brand": "ProBrand",   "availability": "In Stock", "source": "amazon"},
        {"title": f"{keyword} - Rollback",        "url": "https://www.walmart.com/ip/m002",   "asin": None,      "price": 11.88, "currency": "USD", "rating": 4.0, "reviews_count": 630,  "brand": "ProBrand",   "availability": "In Stock", "source": "walmart"},
    ]


# ─────────────────────────────────────────────────────────────────────────────
# LiveKit data channel
# ─────────────────────────────────────────────────────────────────────────────

_room_ref = None

def set_room(room):
    global _room_ref
    _room_ref = room

async def _publish(payload: dict):
    if not _room_ref:
        return
    try:
        await _room_ref.local_participant.publish_data(
            json.dumps(payload).encode(), reliable=True
        )
    except Exception as e:
        print(f"[tools] Data channel error: {e}")


# ─────────────────────────────────────────────────────────────────────────────
# Main AI tool
# ─────────────────────────────────────────────────────────────────────────────

async def check_price(product_name: str) -> str:
    """
    Look up the price and product details across multiple retailers for a product.
    Call this when the user wants to check or compare prices for something visible in the camera.
    """
    print(f"\n[tools] ══════ check_price({product_name!r}) ══════")

    # Notify UI: searching
    await _publish({"action": "searching", "query": product_name})

    # ── 1. Fast path: Moss cache ──────────────────────────────────────────────
    cached = await _moss_search(product_name)
    if cached:
        sources = list({p.get("source", "amazon") for p in cached})
        print(f"[tools] ✅ CACHE HIT — {len(cached)} products from {sources}")
        await _publish({
            "action": "show_product",
            "data": {"query": product_name, "products": cached, "source": "moss", "pending": False},
        })
        top = cached[0]
        price_str = f"${top['price']:.2f}" if top.get("price") else "price unavailable"
        return (
            f"{top['title']} is {price_str} on {top.get('source','Amazon').title()}. "
            f"I found {len(cached)} options across {', '.join(sources)}. (cached)"
        )

    # ── 2. Cache miss ──────────────────────────────────────────────────────────
    # Live Bright Data scraping used to run here on every miss, but a single
    # scrape can take 1-3 minutes and Target/Walmart time out unpredictably —
    # far too slow for a live voice demo. Checky now serves exclusively out of
    # Moss, which is pre-seeded offline via `python load_snapshots.py` (loads
    # Bright Data snapshot exports from agent/data/ in bulk). The scraper
    # functions above (_run_scrapers_with_progress etc.) are kept for that
    # offline seeding workflow — re-run a scrape, save the snapshot, load it —
    # but are no longer called from the live check_price() path.
    print(f"[tools] ❌ No cached data for {product_name!r}")
    await _publish({
        "action": "show_product",
        "data": {"query": product_name, "products": [], "source": "mock", "pending": False},
    })
    return (
        f"I don't have {product_name} in my catalog yet — try something like "
        f"Coke, Sprite, Doritos, a teddy bear, or an iPhone."
    )
