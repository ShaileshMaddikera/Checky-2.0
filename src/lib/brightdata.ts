import { Product } from './types';

const BRIGHTDATA_API = 'https://api.brightdata.com/datasets/v3/scrape';
const DATASET_ID = 'gd_l7q7dkf244hwjntr0';

// Bright Data's Amazon keyword search dataset returns various field name formats.
// This normalizes the raw response into our Product shape.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeProduct(raw: Record<string, any>): Product {
  // Price: may come as number, string ("$29.99"), or under final_price/initial_price
  const rawPrice = raw.final_price ?? raw.price ?? raw.initial_price ?? raw.sale_price;
  let price: number | undefined;
  if (rawPrice !== undefined && rawPrice !== null && rawPrice !== '') {
    const n = typeof rawPrice === 'string'
      ? parseFloat(rawPrice.replace(/[^0-9.]/g, ''))
      : Number(rawPrice);
    if (!isNaN(n) && n > 0) price = n;
  }

  // Image: may be main_image, thumbnail, or image
  const main_image: string | undefined =
    raw.main_image || raw.thumbnail || raw.image || undefined;

  // reviews_count: may be reviews or reviews_count
  const reviews_count =
    raw.reviews_count ?? raw.reviews ?? undefined;

  return {
    title: raw.title ?? '',
    url: raw.url ?? '',
    asin: raw.asin || undefined,
    price,
    currency: raw.currency || 'USD',
    rating: raw.rating != null ? Number(raw.rating) : undefined,
    reviews_count: reviews_count != null ? Number(reviews_count) : undefined,
    brand: raw.brand || undefined,
    main_image,
    description: raw.description || undefined,
    availability: raw.availability || undefined,
    seller_name: raw.seller_name || undefined,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeProducts(raw: Record<string, any>[]): Product[] {
  return raw
    .map(normalizeProduct)
    .filter((p) => p.title && p.url);
}

export async function searchAmazonProducts(keyword: string): Promise<Product[]> {
  const apiKey = process.env.BRIGHTDATA_API_KEY;

  if (!apiKey) {
    console.warn('BRIGHTDATA_API_KEY not set — returning mock data');
    return getMockProducts(keyword);
  }

  try {
    const res = await fetch(
      `${BRIGHTDATA_API}?dataset_id=${DATASET_ID}&type=discover_new&discover_by=keyword&format=json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ input: [{ keyword, zipcode: '10001' }] }),
      }
    );

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Bright Data API error: ${res.status} ${res.statusText} — ${body}`);
    }

    const data = await res.json();

    // API may return snapshot_id for async, or direct array
    if (Array.isArray(data)) {
      const products = normalizeProducts(data);
      console.log(`[brightdata] direct response: ${products.length} products, first has price=${products[0]?.price}, image=${!!products[0]?.main_image}`);
      return products;
    }

    if (data.snapshot_id) {
      return await pollSnapshot(data.snapshot_id, apiKey);
    }

    return [];
  } catch (err) {
    console.error('Bright Data search failed:', err);
    return getMockProducts(keyword);
  }
}

async function pollSnapshot(snapshotId: string, apiKey: string): Promise<Product[]> {
  const maxAttempts = 6;   // 6 × 30s = 3 minutes max
  const delayMs = 30_000;  // API recommends 30s between polls

  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, delayMs));

    const res = await fetch(
      `https://api.brightdata.com/datasets/v3/snapshot/${snapshotId}?format=json`,
      { headers: { Authorization: `Bearer ${apiKey}` } }
    );

    if (res.status === 200) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const products = normalizeProducts(data);
        console.log(`[brightdata] snapshot ${snapshotId}: ${products.length} products, first has price=${products[0]?.price}, image=${!!products[0]?.main_image}`);
        return products;
      }
    }
    // 202 = still running, keep polling
    console.log(`[brightdata] snapshot ${snapshotId} still running (attempt ${i + 1}/${maxAttempts})`);
  }

  console.warn('[brightdata] snapshot timed out — returning mock data');
  return [];
}

export function getMockProducts(keyword: string): Product[] {
  const base = keyword.toLowerCase();
  return [
    {
      title: `${keyword} - Premium Model`,
      url: 'https://www.amazon.com/dp/B09MOCK001',
      asin: 'B09MOCK001',
      price: 29.99,
      currency: 'USD',
      rating: 4.5,
      reviews_count: 1240,
      brand: 'TechBrand',
      main_image: `https://placehold.co/200x200/1a1a2e/00ff88?text=${encodeURIComponent(base)}`,
      availability: 'In Stock',
    },
    {
      title: `${keyword} - Value Pack`,
      url: 'https://www.amazon.com/dp/B09MOCK002',
      asin: 'B09MOCK002',
      price: 19.99,
      currency: 'USD',
      rating: 4.2,
      reviews_count: 856,
      brand: 'ValueBrand',
      main_image: `https://placehold.co/200x200/1a1a2e/00ccff?text=${encodeURIComponent(base)}`,
      availability: 'In Stock',
    },
    {
      title: `${keyword} - Pro Edition`,
      url: 'https://www.amazon.com/dp/B09MOCK003',
      asin: 'B09MOCK003',
      price: 49.99,
      currency: 'USD',
      rating: 4.7,
      reviews_count: 3102,
      brand: 'ProBrand',
      main_image: `https://placehold.co/200x200/1a1a2e/ff6600?text=${encodeURIComponent(base)}`,
      availability: 'In Stock',
    },
    {
      title: `${keyword} - Budget Option`,
      url: 'https://www.amazon.com/dp/B09MOCK004',
      asin: 'B09MOCK004',
      price: 12.99,
      currency: 'USD',
      rating: 3.8,
      reviews_count: 421,
      brand: 'BudgetBrand',
      main_image: `https://placehold.co/200x200/1a1a2e/ff0066?text=${encodeURIComponent(base)}`,
      availability: 'In Stock',
    },
    {
      title: `${keyword} - Deluxe Set`,
      url: 'https://www.amazon.com/dp/B09MOCK005',
      asin: 'B09MOCK005',
      price: 79.99,
      currency: 'USD',
      rating: 4.9,
      reviews_count: 5890,
      brand: 'LuxuryBrand',
      main_image: `https://placehold.co/200x200/1a1a2e/aa00ff?text=${encodeURIComponent(base)}`,
      availability: 'Limited Stock',
    },
  ];
}
