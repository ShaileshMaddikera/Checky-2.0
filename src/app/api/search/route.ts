import { NextRequest, NextResponse } from 'next/server';
import { searchAmazonProducts } from '@/lib/brightdata';
import { searchMoss, cacheProducts } from '@/lib/moss';

export async function POST(req: NextRequest) {
  try {
    const { keyword } = await req.json();

    if (!keyword || typeof keyword !== 'string' || keyword.trim().length === 0) {
      return NextResponse.json({ error: 'keyword is required' }, { status: 400 });
    }

    const query = keyword.trim();

    // 1. Check Moss cache first (semantic similarity — finds related products too)
    const cached = await searchMoss(query);
    if (cached.length >= 3) {
      console.log(`[search] Moss cache hit for "${query}" (${cached.length} results)`);
      return NextResponse.json({ products: cached, query, source: 'moss' });
    }

    // 2. Fetch from Bright Data
    const products = await searchAmazonProducts(query);

    // 3. Store results in Moss for future semantic searches (fire-and-forget)
    cacheProducts(products).catch((e) => console.warn('[search] moss cache write failed:', e));

    return NextResponse.json({ products, query, source: 'brightdata' });
  } catch {
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
