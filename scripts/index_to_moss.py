#!/usr/bin/env python3
"""
scripts/index_to_moss.py — Bulk-index Bright Data scraped products into Moss

Usage:
  # Index a local JSON file (downloaded from Bright Data snapshot)
  python scripts/index_to_moss.py --file data/amazon_products.json --source amazon

  # Fetch directly from a Bright Data snapshot ID
  python scripts/index_to_moss.py --snapshot SNAPSHOT_ID --source amazon

  # Fetch from a Bright Data dataset (pre-collected marketplace data)
  python scripts/index_to_moss.py --dataset gd_l7q7dkf244hwjntr0 --keyword "ibuprofen" --source amazon

Run from the project root:
  cd /path/to/checky
  source agent/.venv/bin/activate
  python scripts/index_to_moss.py --file products.json --source amazon
"""

import argparse
import json
import os
import sys
import time
import asyncio
import requests
from pathlib import Path

# Load env from agent/.env
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / "agent" / ".env")

BRIGHTDATA_API = "https://api.brightdata.com/datasets/v3"
INDEX_NAME = "products"


# ── Moss setup ─────────────────────────────────────────────────────────────────

def get_moss_client():
    project_id = os.getenv("MOSS_PROJECT_ID")
    project_key = os.getenv("MOSS_PROJECT_KEY")
    if not project_id or not project_key:
        print("❌ MOSS_PROJECT_ID and MOSS_PROJECT_KEY must be set in agent/.env")
        sys.exit(1)
    try:
        from moss import MossClient
        return MossClient(project_id, project_key)
    except ImportError:
        print("❌ Moss SDK not installed. Run: pip install moss")
        sys.exit(1)


def normalize_product(raw: dict, source: str) -> dict:
    """Normalize a raw Bright Data product into Checky's product schema."""

    def clean(v, fallback=None):
        if v is None or v == "" or v == "N/A":
            return fallback
        return v

    def to_float(v):
        try:
            return float(str(v).replace("$", "").replace(",", "")) if v else None
        except Exception:
            return None

    # Amazon fields
    title   = clean(raw.get("title") or raw.get("name") or raw.get("product_name"))
    url     = clean(raw.get("url") or raw.get("product_url") or raw.get("link"), "")
    asin    = clean(raw.get("asin") or raw.get("product_id"))
    price   = to_float(raw.get("price") or raw.get("final_price") or raw.get("sale_price"))
    rating  = to_float(raw.get("rating") or raw.get("stars") or raw.get("rating_stars"))
    reviews = to_float(raw.get("reviews_count") or raw.get("reviews") or raw.get("review_count"))
    brand   = clean(raw.get("brand") or raw.get("brand_name"))
    image   = clean(raw.get("main_image") or raw.get("image") or raw.get("thumbnail_url"))
    avail   = clean(raw.get("availability") or raw.get("in_stock"))

    if not title:
        return None  # skip products with no title

    return {
        "title":         title,
        "url":           url,
        "asin":          asin,
        "price":         price,
        "currency":      clean(raw.get("currency"), "USD"),
        "rating":        rating,
        "reviews_count": int(reviews) if reviews else None,
        "brand":         brand,
        "main_image":    image,
        "availability":  str(avail) if avail is not None else None,
        "source":        source,
    }


def products_to_moss_docs(products: list[dict]):
    """Convert Checky product dicts to Moss document format."""
    from moss import DocumentInfo
    docs = []
    for p in products:
        if not p or not p.get("title"):
            continue

        doc_id = (p.get("asin") or p.get("url", ""))[:32]
        if not doc_id:
            continue

        text = " ".join(filter(None, [p.get("title"), p.get("brand")]))

        docs.append(DocumentInfo(
            id=doc_id,
            text=text,
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
    return docs


async def index_to_moss(products: list[dict], source: str):
    """Bulk-index products into Moss, batching to avoid memory issues."""
    moss = get_moss_client()
    BATCH_SIZE = 500

    normalized = [normalize_product(p, source) for p in products]
    normalized = [p for p in normalized if p]  # filter None
    docs = products_to_moss_docs(normalized)

    if not docs:
        print("⚠️  No valid products to index after normalization")
        return

    print(f"\n📦 Indexing {len(docs)} products into Moss (index: '{INDEX_NAME}')...")

    # Check if index exists
    index_exists = False
    try:
        await moss.load_index(INDEX_NAME)
        index_exists = True
        print(f"✅ Existing Moss index loaded")
    except Exception:
        print(f"ℹ️  Creating new Moss index '{INDEX_NAME}'...")

    for i in range(0, len(docs), BATCH_SIZE):
        batch = docs[i:i + BATCH_SIZE]
        batch_num = i // BATCH_SIZE + 1
        total_batches = (len(docs) + BATCH_SIZE - 1) // BATCH_SIZE
        print(f"   Batch {batch_num}/{total_batches} — {len(batch)} docs...", end=" ", flush=True)

        try:
            if not index_exists:
                await moss.create_index(INDEX_NAME, batch, model_id="moss-minilm")
                await moss.load_index(INDEX_NAME)
                index_exists = True
            else:
                from moss import MutationOptions
                await moss.add_docs(INDEX_NAME, batch, MutationOptions(upsert=True))
            print("✅")
        except Exception as e:
            print(f"❌ {e}")

    print(f"\n🎉 Done! {len(docs)} products indexed into Moss.")
    print(f"   Next time Checky sees any of these products, it'll be a cache hit (<10ms)")


# ── Bright Data fetchers ───────────────────────────────────────────────────────

def fetch_snapshot(snapshot_id: str) -> list[dict]:
    """Poll a Bright Data snapshot until ready and return the data."""
    api_key = os.getenv("BRIGHTDATA_API_KEY")
    if not api_key:
        print("❌ BRIGHTDATA_API_KEY not set in agent/.env")
        sys.exit(1)

    print(f"⏳ Fetching snapshot {snapshot_id}...")
    for attempt in range(20):
        resp = requests.get(
            f"{BRIGHTDATA_API}/snapshot/{snapshot_id}?format=json",
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=30,
        )
        if resp.status_code == 200:
            data = resp.json()
            if isinstance(data, list) and data:
                print(f"✅ Got {len(data)} products from snapshot")
                return data
        elif resp.status_code == 202:
            print(f"   Still processing... (attempt {attempt+1}/20, waiting 30s)")
            time.sleep(30)
        else:
            print(f"❌ Snapshot error: {resp.status_code} {resp.text[:200]}")
            sys.exit(1)

    print("❌ Snapshot timed out after 10 minutes")
    sys.exit(1)


def trigger_dataset_scrape(dataset_id: str, keyword: str) -> list[dict]:
    """Trigger a Bright Data dataset scrape by keyword and wait for results."""
    api_key = os.getenv("BRIGHTDATA_API_KEY")
    if not api_key:
        print("❌ BRIGHTDATA_API_KEY not set in agent/.env")
        sys.exit(1)

    print(f"🚀 Triggering Bright Data scrape: dataset={dataset_id}, keyword='{keyword}'")
    resp = requests.post(
        f"{BRIGHTDATA_API}/scrape?dataset_id={dataset_id}&type=discover_new&discover_by=keyword&format=json",
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {api_key}"},
        json={"input": [{"keyword": keyword, "zipcode": "10001"}]},
        timeout=120,
    )
    resp.raise_for_status()
    data = resp.json()

    if isinstance(data, list):
        print(f"✅ Got {len(data)} products (synchronous response)")
        return data

    if isinstance(data, dict) and data.get("snapshot_id"):
        return fetch_snapshot(data["snapshot_id"])

    print(f"❌ Unexpected response: {data}")
    sys.exit(1)


def load_from_file(filepath: str) -> list[dict]:
    """Load products from a local JSON file."""
    path = Path(filepath)
    if not path.exists():
        print(f"❌ File not found: {filepath}")
        sys.exit(1)

    print(f"📂 Loading {path.name}...")
    with open(path) as f:
        data = json.load(f)

    if isinstance(data, list):
        print(f"✅ Loaded {len(data)} products")
        return data
    elif isinstance(data, dict) and "products" in data:
        items = data["products"]
        print(f"✅ Loaded {len(items)} products")
        return items
    else:
        print("❌ Expected a JSON array of products")
        sys.exit(1)


# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Bulk-index Bright Data products into Moss")
    parser.add_argument("--source", default="amazon", help="Source label: amazon, walmart, target, etc.")

    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--file",     metavar="PATH",        help="Path to a local JSON file from Bright Data")
    group.add_argument("--snapshot", metavar="SNAPSHOT_ID", help="Bright Data snapshot ID to fetch")
    group.add_argument("--dataset",  metavar="DATASET_ID",  help="Bright Data dataset ID (requires --keyword)")

    parser.add_argument("--keyword", help="Keyword to search (used with --dataset)")

    args = parser.parse_args()

    if args.dataset and not args.keyword:
        parser.error("--dataset requires --keyword")

    # Load products
    if args.file:
        products = load_from_file(args.file)
    elif args.snapshot:
        products = fetch_snapshot(args.snapshot)
    else:
        products = trigger_dataset_scrape(args.dataset, args.keyword)

    if not products:
        print("⚠️  No products to index")
        sys.exit(0)

    # Index into Moss
    asyncio.run(index_to_moss(products, args.source))


if __name__ == "__main__":
    main()
