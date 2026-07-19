'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Product, SearchResult } from '@/lib/types';

interface Props {
  result: SearchResult;
  likedAsins: Set<string>;
  excludedAsins: Set<string>;
  onLike: (product: Product) => void;
  onExclude: (product: Product) => void;
  onClose: () => void;
}

function StarRating({ rating }: { rating: number }) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  return (
    <span className="text-[11px]" style={{ color: '#fbbf24' }}>
      {'★'.repeat(full)}
      {half && '½'}
      <span style={{ opacity: 0.25 }}>{'★'.repeat(5 - full - (half ? 1 : 0))}</span>
    </span>
  );
}

const SOURCE_STYLES: Record<string, { label: string; color: string; bg: string; border: string }> = {
  amazon:  { label: 'Amazon',  color: '#f0a94e', bg: 'rgba(240,169,78,0.10)',  border: 'rgba(240,169,78,0.28)'  },
  walmart: { label: 'Walmart', color: '#5b9bf0', bg: 'rgba(91,155,240,0.10)', border: 'rgba(91,155,240,0.28)' },
  target:  { label: 'Target',  color: '#e0616f', bg: 'rgba(224,97,111,0.10)', border: 'rgba(224,97,111,0.28)' },
  ebay:    { label: 'eBay',    color: '#e0616f', bg: 'rgba(224,97,111,0.10)', border: 'rgba(224,97,111,0.28)' },
};

function SourceBadge({ source }: { source?: string }) {
  if (!source) return null;
  const s = SOURCE_STYLES[source] ?? { label: source, color: 'var(--text-secondary)', bg: 'var(--surface)', border: 'var(--border)' };
  return (
    <span
      className="text-[10px] font-medium px-1.5 py-0.5 rounded-md"
      style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.color }}
    >
      {s.label}
    </span>
  );
}

function ProductCard({
  product,
  isLiked,
  isExcluded,
  onLike,
  onExclude,
  isFeatured = false,
}: {
  product: Product;
  isLiked: boolean;
  isExcluded: boolean;
  onLike: () => void;
  onExclude: () => void;
  isFeatured?: boolean;
}) {
  if (isExcluded) return null;

  return (
    <div
      className={`glass-panel rounded-2xl flex-shrink-0 flex flex-col overflow-hidden transition-all ${isFeatured ? 'w-full' : 'w-44'}`}
      style={{
        border: isFeatured ? '1px solid var(--accent-border)' : '1px solid var(--border)',
        boxShadow: isFeatured ? '0 8px 32px rgba(129,140,248,0.12)' : undefined,
      }}
    >
      {/* Product image */}
      <div
        className="relative"
        style={{ height: isFeatured ? 130 : 100, background: 'rgba(255,255,255,0.02)' }}
      >
        {product.main_image ? (
          <Image
            src={product.main_image}
            alt={product.title}
            fill
            className="object-contain p-3"
            unoptimized
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
            No image
          </div>
        )}
        {isFeatured && (
          <div
            className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-full text-[10px] font-semibold"
            style={{ background: 'var(--accent-soft)', border: '1px solid var(--accent-border)', color: 'var(--accent)' }}
          >
            Top match
          </div>
        )}
      </div>

      {/* Info */}
      <div className={`flex flex-col flex-1 ${isFeatured ? 'p-3.5' : 'p-2.5'}`}>
        <div className="mb-1.5">
          <SourceBadge source={product.source} />
        </div>

        <p
          className="leading-snug mb-1 font-medium"
          style={{ fontSize: isFeatured ? '0.8rem' : '0.7rem', color: 'var(--text-primary)' }}
          title={product.title}
        >
          {product.title.length > (isFeatured ? 80 : 50)
            ? product.title.slice(0, isFeatured ? 80 : 50) + '…'
            : product.title}
        </p>

        {product.brand && (
          <p className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
            {product.brand}
          </p>
        )}

        {product.rating != null && (
          <div className="flex items-center gap-1 mt-1">
            <StarRating rating={product.rating} />
            {product.reviews_count && (
              <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                ({product.reviews_count.toLocaleString()})
              </span>
            )}
          </div>
        )}

        {/* Price */}
        <div className="mt-auto pt-2.5">
          {product.price != null ? (
            <span
              className="font-semibold tabular-nums"
              style={{ fontSize: isFeatured ? '1.05rem' : '0.85rem', color: 'var(--success)' }}
            >
              {product.currency === 'USD' || !product.currency ? '$' : product.currency}
              {product.price.toFixed(2)}
            </span>
          ) : (
            <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>Price unavailable</span>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-1.5 mt-2.5">
          <button
            onClick={onLike}
            className="flex-1 rounded-lg py-1.5 text-[11px] font-medium transition-colors"
            style={{
              background: isLiked ? 'rgba(244,114,182,0.14)' : 'transparent',
              border: `1px solid ${isLiked ? 'rgba(244,114,182,0.4)' : 'var(--border)'}`,
              color: isLiked ? '#f472b6' : 'var(--text-secondary)',
            }}
          >
            {isLiked ? '♥ Saved' : '♡ Save'}
          </button>
          <button
            onClick={onExclude}
            className="px-2.5 rounded-lg py-1.5 text-[11px] transition-colors"
            style={{ border: '1px solid var(--border)', color: 'var(--text-tertiary)' }}
          >
            ✕
          </button>
        </div>

        {/* View on retailer site */}
        <a
          href={product.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1.5 block text-center rounded-lg py-1.5 text-[11px] font-medium transition-colors"
          style={{ background: 'var(--accent-soft)', border: '1px solid var(--accent-border)', color: 'var(--accent)' }}
        >
          View product ↗
        </a>
      </div>
    </div>
  );
}

export default function ProductResults({ result, likedAsins, excludedAsins, onLike, onExclude, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<'results' | 'liked'>('results');

  const visible = result.products.filter(
    (p) => !excludedAsins.has(p.asin ?? p.url)
  );

  const featured = visible[0];
  const similar = visible.slice(1);

  const pricesSorted = visible
    .filter((p) => p.price != null)
    .sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
  const cheapest = pricesSorted[0];
  const priceDiff =
    featured && cheapest && cheapest.asin !== featured.asin
      ? ((featured.price ?? 0) - (cheapest.price ?? 0)).toFixed(2)
      : null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 slide-up"
      style={{ zIndex: 40, maxHeight: '68vh' }}
    >
      <div
        className="glass-panel rounded-t-3xl overflow-hidden flex flex-col"
        style={{ borderBottom: 'none', maxHeight: '68vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>Price intel</span>
            <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
              &quot;{result.query}&quot; · {visible.length} results
            </span>
            {(['amazon', 'walmart', 'target', 'ebay'] as const).map((src) => {
              const count = visible.filter((p) => p.source === src).length;
              if (!count) return null;
              const s = SOURCE_STYLES[src];
              return (
                <span
                  key={src}
                  className="text-[10px] font-medium px-1.5 py-0.5 rounded-md"
                  style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.color }}
                >
                  {s.label} {count}
                </span>
              );
            })}
            {result.source === 'moss' && (
              <span
                className="text-[10px] font-medium px-1.5 py-0.5 rounded-md"
                style={{ background: 'var(--accent-soft)', border: '1px solid var(--accent-border)', color: 'var(--accent)' }}
              >
                ⚡ cached
              </span>
            )}
            {result.pending && (
              <span
                className="text-[10px] font-medium px-1.5 py-0.5 rounded-md flex items-center gap-1"
                style={{ background: 'var(--accent-soft)', border: '1px solid var(--accent-border)', color: 'var(--accent)' }}
              >
                <span className="inline-block w-1.5 h-1.5 rounded-full pulse-soft" style={{ background: 'var(--accent)' }} />
                fetching live prices…
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {priceDiff && Number(priceDiff) > 0 && (
              <div
                className="text-[11px] font-medium px-2.5 py-1 rounded-full"
                style={{ background: 'var(--success-soft)', border: `1px solid var(--success-border)`, color: 'var(--success)' }}
              >
                Save ${priceDiff} vs top result
              </div>
            )}
            <button
              onClick={onClose}
              className="text-[13px] w-7 h-7 flex items-center justify-center rounded-full transition-colors"
              style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex px-5" style={{ borderBottom: '1px solid var(--border)' }}>
          {(['results', 'liked'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="px-3 py-2.5 text-[12px] font-medium transition-colors capitalize"
              style={{
                color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-tertiary)',
                borderBottom: activeTab === tab ? '2px solid var(--accent)' : '2px solid transparent',
              }}
            >
              {tab === 'liked' ? `Saved (${likedAsins.size})` : tab}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto flex-1 p-5">
          {activeTab === 'results' && visible.length === 0 && (
            <div className="text-center py-10" style={{ color: 'var(--text-tertiary)' }}>
              <div className="text-2xl mb-2">🔍</div>
              <div className="text-[13px] mb-1" style={{ color: 'var(--text-primary)' }}>
                Not in the catalog yet
              </div>
              <div className="text-[12px] max-w-xs mx-auto">
                &quot;{result.query}&quot; hasn&apos;t been indexed. Try Coke, Sprite, Doritos, a teddy bear, or an iPhone.
              </div>
            </div>
          )}

          {activeTab === 'results' && visible.length > 0 && (
            <>
              {featured && (
                <div className="mb-5">
                  <div className="text-[11px] font-medium mb-2" style={{ color: 'var(--text-tertiary)' }}>Top match</div>
                  <ProductCard
                    key={featured.asin ?? featured.url}
                    product={featured}
                    isLiked={likedAsins.has(featured.asin ?? featured.url)}
                    isExcluded={false}
                    onLike={() => onLike(featured)}
                    onExclude={() => onExclude(featured)}
                    isFeatured
                  />
                </div>
              )}

              {pricesSorted.length > 1 && (
                <div className="mb-5">
                  <div className="text-[11px] font-medium mb-2" style={{ color: 'var(--text-tertiary)' }}>Price comparison</div>
                  <div className="glass-panel rounded-xl p-3.5 space-y-2.5">
                    {pricesSorted.slice(0, 4).map((p, i) => {
                      const max = pricesSorted[pricesSorted.length - 1].price ?? 1;
                      const pct = ((p.price ?? 0) / max) * 100;
                      return (
                        <div key={p.asin ?? p.url} className="flex items-center gap-2.5">
                          <span className="text-[11px] w-3" style={{ color: 'var(--text-tertiary)' }}>{i + 1}</span>
                          <div className="flex-1 rounded-full h-1.5" style={{ background: 'rgba(255,255,255,0.06)' }}>
                            <div
                              className="h-1.5 rounded-full transition-all"
                              style={{
                                width: `${pct}%`,
                                background: i === 0 ? 'var(--success)' : 'var(--accent)',
                              }}
                            />
                          </div>
                          <span className="text-[11px] font-medium tabular-nums w-14 text-right" style={{ color: 'var(--success)' }}>
                            ${(p.price ?? 0).toFixed(2)}
                          </span>
                          <span className="text-[11px] truncate w-28" style={{ color: 'var(--text-tertiary)' }}>
                            {p.title.split(' ').slice(0, 3).join(' ')}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {similar.length > 0 && (
                <div>
                  <div className="text-[11px] font-medium mb-2" style={{ color: 'var(--text-tertiary)' }}>Similar items</div>
                  <div className="flex gap-3 overflow-x-auto pb-2">
                    {similar.map((p) => (
                      <ProductCard
                        key={p.asin ?? p.url}
                        product={p}
                        isLiked={likedAsins.has(p.asin ?? p.url)}
                        isExcluded={excludedAsins.has(p.asin ?? p.url)}
                        onLike={() => onLike(p)}
                        onExclude={() => onExclude(p)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {activeTab === 'liked' && (
            <div>
              {likedAsins.size === 0 ? (
                <div className="text-center py-10" style={{ color: 'var(--text-tertiary)' }}>
                  <div className="text-2xl mb-2">♡</div>
                  <div className="text-[12px]">No saved items yet</div>
                </div>
              ) : (
                <div className="flex gap-3 flex-wrap">
                  {result.products
                    .filter((p) => likedAsins.has(p.asin ?? p.url))
                    .map((p) => (
                      <ProductCard
                        key={p.asin ?? p.url}
                        product={p}
                        isLiked
                        isExcluded={false}
                        onLike={() => onLike(p)}
                        onExclude={() => onExclude(p)}
                      />
                    ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
