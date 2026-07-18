"""
load_snapshots.py — bulk-load pre-scraped Bright Data snapshot JSON files into Moss.

Checky no longer scrapes Bright Data live on every check_price() call (too slow/
unreliable for a demo). Instead, drop Bright Data snapshot exports (the JSON
array a snapshot downloads as) into data/, run this once, and check_price()
serves everything straight out of the Moss cache.

Each file in data/ is expected to be a JSON array of raw product records from
any of Amazon / Walmart / Target — source is auto-detected per record from its
URL, so files can mix retailers or come from different queries freely.

Run:
    cd agent && source .venv/bin/activate
    python load_snapshots.py
"""

import asyncio
import json
import sys
from pathlib import Path

import tools

DATA_DIR = Path(__file__).parent / "data"
BATCH_SIZE = 200

DOMAIN_TO_SOURCE = {
    "amazon.com": "amazon",
    "walmart.com": "walmart",
    "target.com": "target",
}


def _detect_source(raw: dict) -> str | None:
    url = raw.get("url") or raw.get("product_url") or raw.get("link") or ""
    for domain, source in DOMAIN_TO_SOURCE.items():
        if domain in url:
            return source
    return None


def _load_file(path: Path) -> list[dict]:
    with open(path) as f:
        data = json.load(f)
    if not isinstance(data, list):
        print(f"  ⚠️  {path.name}: not a JSON array, skipping")
        return []

    normalized = []
    skipped = 0
    for raw in data:
        source = _detect_source(raw)
        if not source:
            skipped += 1
            continue
        product = tools._normalize_raw(raw, source)
        if product:
            normalized.append(product)
    if skipped:
        print(f"  ({skipped} records skipped — no recognized retailer URL)")
    return normalized


async def main():
    if not DATA_DIR.exists():
        print(f"No data/ folder at {DATA_DIR} — nothing to load.")
        sys.exit(1)

    files = sorted(DATA_DIR.glob("*.json"))
    if not files:
        print(f"No .json files in {DATA_DIR} — drop Bright Data snapshot exports there first.")
        sys.exit(1)

    all_products: list[dict] = []
    for path in files:
        print(f"→ {path.name}")
        products = _load_file(path)
        print(f"  {len(products)} normalized products")
        all_products.extend(products)

    # De-dupe by asin/url — the same product can appear in multiple snapshot files
    seen = set()
    deduped = []
    for p in all_products:
        key = p.get("asin") or p.get("url")
        if not key or key in seen:
            continue
        seen.add(key)
        deduped.append(p)

    by_source: dict[str, int] = {}
    for p in deduped:
        by_source[p["source"]] = by_source.get(p["source"], 0) + 1

    print(f"\n{len(all_products)} total → {len(deduped)} unique products")
    for source, count in sorted(by_source.items()):
        print(f"  {source}: {count}")

    print(f"\nIndexing into Moss in batches of {BATCH_SIZE}...")
    for i in range(0, len(deduped), BATCH_SIZE):
        batch = deduped[i:i + BATCH_SIZE]
        await tools._cache_to_moss(batch)
        print(f"  batch {i // BATCH_SIZE + 1}/{(len(deduped) + BATCH_SIZE - 1) // BATCH_SIZE} done")

    print("\n✅ Done.")


if __name__ == "__main__":
    asyncio.run(main())
