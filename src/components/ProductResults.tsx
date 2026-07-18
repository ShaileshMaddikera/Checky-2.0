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
    <span className="text-yellow-400 text-xs">
      {'★'.repeat(full)}
      {half && '½'}
      {'☆'.repeat(5 - full - (half ? 1 : 0))}
    </span>
  );
}

const SOURCE_STYLES: Record<string, { label: string; color: string; bg: string; border: string }> = {
  amazon:  { label: 'Amazon',  color: '#FF9900', bg: 'rgba(255,153,0,0.12)',  border: 'rgba(255,153,0,0.35)'  },
  walmart: { label: 'Walmart', color: '#0071CE', bg: 'rgba(0,113,206,0.12)', border: 'rgba(0,113,206,0.35)' },
  target:  { label: 'Target',  color: '#CC0000', bg: 'rgba(204,0,0,0.12)',   border: 'rgba(204,0,0,0.35)'   },
  ebay:    { label: 'eBay',    color: '#E53238', bg: 'rgba(229,50,56,0.12)', border: 'rgba(229,50,56,0.35)' },
};

function SourceBadge({ source }: { source?: string }) {
  if (!source) return null;
  const s = SOURCE_STYLES[source] ?? { label: source, color: '#aaa', bg: 'rgba(170,170,170,0.1)', border: 'rgba(170,170,170,0.3)' };
  return (
    <span
      className="font-mono text-xs px-1.5 py-0.5 rounded"
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
  const key = product.asin ?? product.url;

  if (isExcluded) return null;

  return (
    <div
      className={`glass-card rounded-xl flex-shrink-0 flex flex-col overflow-hidden transition-all ${isFeatured ? 'w-full' : 'w-44'}`}
      style={{
        border: isFeatured
          ? '1.5px solid rgba(0,255,136,0.5)'
          : '1px solid rgba(0,255,136,0.2)',
        boxShadow: isFeatured ? '0 0 20px rgba(0,255,136,0.15)' : 'none',
      }}
    >
      {/* Product image */}
      <div
        className="relative bg-black/40"
        style={{ height: isFeatured ? 120 : 96 }}
      >
        {product.main_image ? (
          <Image
            src={product.main_image}
            alt={product.title}
            fill
            className="object-contain p-2"
            unoptimized
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-600 font-mono text-xs">
            NO IMAGE
          </div>
        )}
        {isFeatured && (
          <div
            className="absolute top-2 left-2 px-2 py-0.5 rounded font-mono text-xs font-bold"
            style={{ background: 'rgba(0,255,136,0.2)', border: '1px solid var(--hud-green)', color: 'var(--hud-green)' }}
          >
            BEST MATCH
          </div>
        )}
      </div>

      {/* Info */}
      <div className={`flex flex-col flex-1 ${isFeatured ? 'p-3' : 'p-2'}`}>
        {/* Source badge */}
        <div className="mb-1">
          <SourceBadge source={product.source} />
        </div>

        <p
          className="font-mono text-white leading-snug mb-1"
          style={{ fontSize: isFeatured ? '0.75rem' : '0.65rem' }}
          title={product.title}
        >
          {product.title.length > (isFeatured ? 80 : 50)
            ? product.title.slice(0, isFeatured ? 80 : 50) + '…'
            : product.title}
        </p>

        {product.brand && (
          <p className="font-mono text-gray-500" style={{ fontSize: '0.6rem' }}>
            {product.brand}
          </p>
        )}

        {product.rating != null && (
          <div className="flex items-center gap-1 mt-1">
            <StarRating rating={product.rating} />
            {product.reviews_count && (
              <span className="text-gray-500" style={{ fontSize: '0.6rem' }}>
                ({product.reviews_count.toLocaleString()})
              </span>
            )}
          </div>
        )}

        {/* Price */}
        <div className="mt-auto pt-2">
          {product.price != null ? (
            <span
              className="font-mono font-bold glow-green"
              style={{ fontSize: isFeatured ? '1rem' : '0.8rem' }}
            >
              {product.currency ?? '$'}{product.price.toFixed(2)}
            </span>
          ) : (
            <span className="font-mono text-gray-500 text-xs">Price N/A</span>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-1 mt-2">
          <button
            onClick={onLike}
            className="flex-1 rounded py-1 font-mono transition-all"
            style={{
              fontSize: '0.65rem',
              background: isLiked ? 'rgba(236,72,153,0.25)' : 'transparent',
              border: `1px solid ${isLiked ? 'rgba(236,72,153,0.7)' : 'rgba(255,255,255,0.15)'}`,
              color: isLiked ? '#f472b6' : 'rgba(255,255,255,0.5)',
            }}
          >
            {isLiked ? '♥ Saved' : '♡ Save'}
          </button>
          <button
            onClick={onExclude}
            className="px-2 rounded py-1 font-mono transition-all"
            style={{
              fontSize: '0.65rem',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.3)',
            }}
          >
            ✕
          </button>
        </div>

        {/* View on Amazon */}
        <a
          href={product.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 block text-center rounded py-1 font-mono transition-all"
          style={{
            fontSize: '0.6rem',
            background: 'rgba(255,153,0,0.12)',
            border: '1px solid rgba(255,153,0,0.3)',
            color: 'rgba(255,153,0,0.9)',
          }}
        >
          View on Amazon ↗
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
      className="absolute inset-x-0 bottom-0 slide-up"
      style={{ zIndex: 40, maxHeight: '65vh' }}
    >
      <div
        className="glass-card rounded-t-2xl overflow-hidden flex flex-col"
        style={{
          border: '1px solid rgba(0,255,136,0.3)',
          borderBottom: 'none',
          maxHeight: '65vh',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-green-900/40">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs glow-green tracking-widest">PRICE INTEL</span>
            <span className="font-mono text-xs text-gray-500">
              &quot;{result.query}&quot; · {visible.length} results
            </span>
            {/* Source breakdown badges */}
            {(['amazon','walmart','target','ebay'] as const).map((src) => {
              const count = visible.filter(p => p.source === src).length;
              if (!count) return null;
              const s = SOURCE_STYLES[src];
              return (
                <span key={src} className="font-mono text-xs px-1.5 py-0.5 rounded"
                  style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.color }}>
                  {s.label} {count}
                </span>
              );
            })}
            {result.source === 'moss' && (
              <span className="font-mono text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(170,0,255,0.15)', border: '1px solid rgba(170,0,255,0.4)', color: '#c084fc' }}>
                ⚡ cached
              </span>
            )}
            {result.pending && (
              <span className="font-mono text-xs px-1.5 py-0.5 rounded flex items-center gap-1" style={{ background: 'rgba(0,204,255,0.1)', border: '1px solid rgba(0,204,255,0.3)', color: 'var(--hud-blue)' }}>
                <span className="inline-block w-2 h-2 rounded-full border border-cyan-400 border-t-transparent animate-spin" />
                fetching live prices…
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {priceDiff && Number(priceDiff) > 0 && (
              <div
                className="font-mono text-xs px-2 py-0.5 rounded"
                style={{ background: 'rgba(0,255,136,0.1)', border: '1px solid rgba(0,255,136,0.3)', color: 'var(--hud-green)' }}
              >
                Save ${priceDiff} vs top result
              </div>
            )}
            <button
              onClick={onClose}
              className="font-mono text-gray-400 hover:text-white transition-colors text-sm w-7 h-7 flex items-center justify-center rounded"
              style={{ border: '1px solid rgba(255,255,255,0.1)' }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-green-900/30">
          {(['results', 'liked'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="px-4 py-2 font-mono text-xs uppercase tracking-wider transition-colors"
              style={{
                color: activeTab === tab ? 'var(--hud-green)' : 'rgba(255,255,255,0.3)',
                borderBottom: activeTab === tab ? '2px solid var(--hud-green)' : '2px solid transparent',
              }}
            >
              {tab === 'liked' ? `Saved (${likedAsins.size})` : tab}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto flex-1 p-4">
          {activeTab === 'results' && (
            <>
              {/* Featured / best match */}
              {featured && (
                <div className="mb-4">
                  <div className="font-mono text-xs text-gray-500 mb-2 tracking-widest">TOP MATCH</div>
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

              {/* Price comparison bar */}
              {pricesSorted.length > 1 && (
                <div className="mb-4">
                  <div className="font-mono text-xs text-gray-500 mb-2 tracking-widest">PRICE COMPARISON</div>
                  <div
                    className="glass-card rounded-lg p-3 space-y-2"
                    style={{ border: '1px solid rgba(0,204,255,0.2)' }}
                  >
                    {pricesSorted.slice(0, 4).map((p, i) => {
                      const max = pricesSorted[pricesSorted.length - 1].price ?? 1;
                      const pct = ((p.price ?? 0) / max) * 100;
                      return (
                        <div key={p.asin ?? p.url} className="flex items-center gap-2">
                          <span className="font-mono text-xs text-gray-500 w-4">{i + 1}</span>
                          <div className="flex-1 bg-black/40 rounded-full h-1.5">
                            <div
                              className="h-1.5 rounded-full transition-all"
                              style={{
                                width: `${pct}%`,
                                background: i === 0 ? 'var(--hud-green)' : 'rgba(0,204,255,0.6)',
                              }}
                            />
                          </div>
                          <span className="font-mono text-xs glow-green w-14 text-right">
                            ${(p.price ?? 0).toFixed(2)}
                          </span>
                          <span className="font-mono text-gray-500 text-xs truncate w-28">
                            {p.title.split(' ').slice(0, 3).join(' ')}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Similar items */}
              {similar.length > 0 && (
                <div>
                  <div className="font-mono text-xs text-gray-500 mb-2 tracking-widest">SIMILAR ITEMS</div>
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
                <div className="text-center font-mono text-gray-600 py-8">
                  <div className="text-3xl mb-2">♡</div>
                  <div>No saved items yet</div>
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
