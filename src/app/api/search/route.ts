import { NextRequest, NextResponse } from 'next/server';
import { searchAmazonProducts } from '@/lib/brightdata';

export async function POST(req: NextRequest) {
  try {
    const { keyword } = await req.json();

    if (!keyword || typeof keyword !== 'string' || keyword.trim().length === 0) {
      return NextResponse.json({ error: 'keyword is required' }, { status: 400 });
    }

    const products = await searchAmazonProducts(keyword.trim());
    return NextResponse.json({ products, query: keyword.trim() });
  } catch {
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
