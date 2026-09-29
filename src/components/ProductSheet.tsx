'use client';

import { useEffect, useState } from 'react';
import type { PlanItem, Product } from '@/lib/domain';
import { store } from '@/lib/client/store';
import { Sheet } from './Sheet';
import { descriptor, ils, productImage, verificationText } from './format';
import { IconArrowUpRight, IconHeart } from './icons';

export function ProductSheet({ item, product, onClose }: { item?: PlanItem | null; product?: Product | null; onClose: () => void }) {
  const p = item?.product ?? product ?? null;
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (p) store.isSaved(p.id).then(setSaved);
  }, [p]);
  if (!p) return null;
  const v = verificationText(p.verification);

  return (
    <Sheet open={!!p} onClose={onClose} title={item?.role ?? p.categoryLabel}>
      <div className="overflow-hidden rounded-[20px] bg-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {p.imageUrl && <img src={productImage(p, 'm')} alt={p.name} className="mx-auto h-56 w-full object-contain p-4" />}
      </div>
      <div className="mt-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">IKEA · Israel</p>
          <h3 className="mt-1 text-[20px] font-semibold tracking-tight">{p.name}</h3>
          <p className="text-[15px] text-ink-soft">{descriptor(p)}</p>
          <p dir="rtl" className="mt-1 text-right text-xs text-muted">{p.nameLocal}</p>
        </div>
        <div className="text-right">
          <p className="text-[22px] font-semibold tabular-nums">{ils(p.price)}</p>
          {item && item.quantity > 1 && <p className="text-xs text-muted">×{item.quantity} = {ils(item.lineTotal)}</p>}
        </div>
      </div>

      <p className={`mt-3 text-xs ${v.tone === 'ok' ? 'text-ok' : v.tone === 'warn' ? 'text-warn' : 'text-muted'}`}>
        {v.text}
        {p.verification.previousPrice != null && ` (catalog had ${ils(p.verification.previousPrice)})`} · Article {p.retailerProductId}
      </p>

      {item?.placement && (
        <p className="mt-4 rounded-2xl bg-sand px-4 py-3 text-sm leading-relaxed text-ink-soft">
          <span className="font-medium text-ink">In your room: </span>
          {item.placement}
        </p>
      )}
      {p.notes?.map((n) => (
        <p key={n} className="mt-2 text-xs text-muted">
          {n}
        </p>
      ))}

      <div className="mt-5 flex gap-3">
        <a
          href={p.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-1 items-center justify-center gap-2 rounded-full bg-ink py-3.5 text-[15px] font-medium text-white"
        >
          View at IKEA <IconArrowUpRight className="h-4 w-4" />
        </a>
        <button
          onClick={async () => {
            if (saved) await store.unsaveProduct(p.id);
            else await store.saveProduct(p);
            setSaved(!saved);
          }}
          className={`grid w-14 place-items-center rounded-full border ${saved ? 'border-ink bg-ink text-white' : 'border-line bg-white'}`}
          aria-label={saved ? 'Remove from saved' : 'Save product'}
        >
          <IconHeart className="h-5 w-5" filled={saved} />
        </button>
      </div>
    </Sheet>
  );
}
