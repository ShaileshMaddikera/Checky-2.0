import { NextRequest, NextResponse } from 'next/server';
import { searchAmazonProducts, getMockProducts } from '@/lib/brightdata';
import { searchMoss, cacheProducts } from '@/lib/moss';

export async function POST(req: NextRequest) {
  try {
    const { keyword } = await req.json();

    if (!keyword || typeof keyword !== 'string' || keyword.trim().length === 0) {
      return NextResponse.json({ error: 'keyword is required' }, { status: 400 });
    }

    const query = keyword.trim();

    // 1. Moss cache first — instant if previously searched
    const cached = await searchMoss(query);
    if (cached.length >= 3) {
      console.log(`[search] Moss cache hit for "${query}" (${cached.length} results)`);
      return NextResponse.json({ products: cached, query, source: 'moss' });
    }

    // 2. Bright Data (async — snapshot takes 30-120s to complete)
    //    Race: real data vs 25s timeout
    const realSearch = searchAmazonProducts(query).then((products) => {
      // Cache results in Moss once they arrive (fire-and-forget)
      if (products.length > 0) {
        cacheProducts(products).catch((e) =>
          console.warn('[search] moss cache write failed:', e)
        );
      }
      return products;
    });

    const timeout = new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), 25_000)
    );

    const result = await Promise.race([realSearch, timeout]);

    if (result && result.length > 0) {
      return NextResponse.json({ products: result, query, source: 'brightdata' });
    }

    // 3. Timed out or empty — return mock data so the UI stays responsive
    console.log(`[search] Bright Data timeout/empty for "${query}" — serving mock data`);
    return NextResponse.json({
      products: getMockProducts(query),
      query,
      source: 'mock',
      pending: true, // hint to UI that real data is still being fetched
    });
  } catch (err) {
    console.error('[search] error:', err);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
