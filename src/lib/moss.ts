/**
 * Moss.dev integration — semantic product search cache
 *
 * Products are indexed by title+brand text so future searches for similar
 * items return cached results instantly (sub-10ms after first load).
 *
 * Requires: npm install @moss-dev/moss
 */

import { Product } from './types';

const INDEX_NAME = 'products';

// Minimal interface — avoids depending on @moss-dev/moss types at build time
interface MossLike {
  createIndex(name: string, docs: MossDoc[], opts?: { modelId?: string }): Promise<unknown>;
  loadIndex(name: string): Promise<void>;
  addDocs(name: string, docs: MossDoc[], opts?: { upsert?: boolean }): Promise<unknown>;
  query(name: string, text: string, opts?: { topK?: number }): Promise<{ docs: MossResult[] }>;
}

interface MossDoc {
  id: string;
  text: string;
  metadata?: Record<string, unknown>;
}

interface MossResult {
  id: string;
  score?: number;
  text: string;
  metadata?: Record<string, unknown>;
}

// Singleton state — persists for the lifetime of the Next.js server process
let client: MossLike | null = null;
let indexLoaded = false;
let indexExists = false;

async function getClient(): Promise<MossLike | null> {
  if (client) return client;

  const projectId = process.env.MOSS_PROJECT_ID;
  const projectKey = process.env.MOSS_PROJECT_KEY;
  if (!projectId || !projectKey) return null;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod = await import('@moss-dev/moss' as any);
    const Ctor = mod.MossClient ?? mod.default?.MossClient;
    if (!Ctor) return null;
    client = new Ctor(projectId, projectKey) as MossLike;
    return client;
  } catch {
    console.warn('[moss] @moss-dev/moss not installed — run: npm install @moss-dev/moss');
    return null;
  }
}

async function ensureLoaded(c: MossLike): Promise<boolean> {
  if (indexLoaded) return true;
  try {
    await c.loadIndex(INDEX_NAME);
    indexLoaded = true;
    indexExists = true;
    return true;
  } catch {
    indexExists = false;
    return false;
  }
}

function docToProduct(doc: MossResult): Product {
  const m = doc.metadata ?? {};
  const numOrUndef = (v: unknown) => {
    const n = parseFloat(v as string);
    return isNaN(n) ? undefined : n;
  };
  const strOrUndef = (v: unknown) => (v && v !== '' ? (v as string) : undefined);
  return {
    title: (m.title as string) || doc.text.slice(0, 80),
    url: (m.url as string) ?? '',
    asin: strOrUndef(m.asin),
    price: numOrUndef(m.price),
    currency: (m.currency as string) || 'USD',
    rating: numOrUndef(m.rating),
    reviews_count: numOrUndef(m.reviews_count),
    brand: strOrUndef(m.brand),
    main_image: strOrUndef(m.main_image),
    availability: strOrUndef(m.availability),
  };
}

/** Semantic search of cached products in Moss */
export async function searchMoss(query: string, topK = 5): Promise<Product[]> {
  const c = await getClient();
  if (!c) return [];

  const loaded = await ensureLoaded(c);
  if (!loaded) return [];

  try {
    const results = await c.query(INDEX_NAME, query, { topK });
    const queryWords = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2);

    return (results.docs ?? [])
      .filter((d) => (d.score ?? 0) > 0.75)
      .map(docToProduct)
      .filter((p) => {
        // Require at least one query word to appear in the title or brand
        const haystack = `${p.title} ${p.brand ?? ''}`.toLowerCase();
        return queryWords.some((w) => haystack.includes(w));
      });
  } catch (err) {
    console.warn('[moss] query error:', (err as Error).message);
    return [];
  }
}

/** Store Bright Data results in Moss for future semantic lookups */
export async function cacheProducts(products: Product[]): Promise<void> {
  const c = await getClient();
  if (!c || products.length === 0) return;

  const docs: MossDoc[] = products
    .filter((p) => p.title)
    .map((p) => ({
      id: p.asin ?? Buffer.from(p.url).toString('base64').slice(0, 32),
      text: [p.title, p.brand, p.description].filter(Boolean).join(' '),
      // Moss WASM requires all metadata values to be strings
      metadata: {
        title: p.title ?? '',
        url: p.url ?? '',
        asin: p.asin ?? '',
        price: p.price != null ? String(p.price) : '',
        currency: p.currency ?? 'USD',
        rating: p.rating != null ? String(p.rating) : '',
        reviews_count: p.reviews_count != null ? String(p.reviews_count) : '',
        brand: p.brand ?? '',
        main_image: p.main_image ?? '',
        availability: p.availability ?? '',
      },
    }));

  try {
    if (!indexExists) {
      await c.createIndex(INDEX_NAME, docs, { modelId: 'moss-minilm' });
      await c.loadIndex(INDEX_NAME);
      indexLoaded = true;
      indexExists = true;
    } else {
      await c.addDocs(INDEX_NAME, docs, { upsert: true });
    }
    console.log(`[moss] cached ${docs.length} products`);
  } catch (err) {
    console.warn('[moss] cacheProducts error:', (err as Error).message);
  }
}
