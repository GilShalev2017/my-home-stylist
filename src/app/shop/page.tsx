'use client';

import { useEffect, useState } from 'react';
import type { Product } from '@/lib/domain';
import { store } from '@/lib/client/store';
import { ProductSheet } from '@/components/ProductSheet';
import { descriptor, ils, productImage } from '@/components/format';

export default function ShopPage() {
  const [items, setItems] = useState<(Product & { savedAt: string })[] | null>(null);
  const [open, setOpen] = useState<Product | null>(null);
  const load = () => store.savedProducts().then(setItems);
  useEffect(() => {
    load();
  }, []);

  const total = items?.reduce((s, p) => s + p.price, 0) ?? 0;

  return (
    <section className="px-5 pt-4 md:pt-10">
      <h1 className="font-serif text-[34px] leading-tight">Shop</h1>
      <p className="mt-1 text-sm text-muted">Products you saved from your designs.</p>

      {items && items.length === 0 && (
        <div className="mt-10 rounded-[24px] bg-white p-8 text-center shadow-[var(--shadow-soft)]">
          <p className="font-serif text-xl">Nothing saved yet</p>
          <p className="mt-1 text-sm text-muted">Tap the heart on any product in a design to keep it here.</p>
        </div>
      )}

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-5">
        {items?.map((p) => (
          <button key={p.id} onClick={() => setOpen(p)} className="overflow-hidden rounded-[20px] bg-white text-left shadow-[var(--shadow-soft)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {p.imageUrl && <img src={productImage(p, 's')} alt="" className="aspect-square w-full object-contain p-3" />}
            <div className="border-t border-line p-3">
              <p className="text-[11px] uppercase tracking-[0.14em] text-muted">IKEA</p>
              <p className="truncate text-[15px] font-medium">{p.name}</p>
              <p className="truncate text-xs text-muted">{descriptor(p)}</p>
              <p className="mt-1 text-[15px] font-semibold tabular-nums">{ils(p.price)}</p>
            </div>
          </button>
        ))}
      </div>
      {!!items?.length && <p className="mt-6 text-right text-sm text-muted">Saved items total: <span className="font-semibold text-ink">{ils(total)}</span></p>}

      <ProductSheet
        product={open}
        onClose={() => {
          setOpen(null);
          load();
        }}
      />
    </section>
  );
}
