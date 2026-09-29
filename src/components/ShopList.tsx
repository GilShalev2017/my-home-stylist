'use client';

import { useState } from 'react';
import type { DesignPlan, PlanItem } from '@/lib/domain';
import { Sheet } from './Sheet';
import { descriptor, fmtDate, ils, productImage, verificationText } from './format';
import { IconArrowUpRight, IconCheck, IconCopy } from './icons';

export function ShopList({ plan, onItem }: { plan: DesignPlan; onItem: (i: PlanItem) => void }) {
  const [shopOpen, setShopOpen] = useState(false);
  const live = plan.items.filter((i) => i.product.verification.status === 'verified_live').length;

  return (
    <section>
      <div className="flex items-end justify-between">
        <h2 className="font-serif text-[28px] leading-none">Shop this room</h2>
        <span className="text-xs text-muted">{plan.items.length} items · IKEA</span>
      </div>

      <ul className="mt-4 divide-y divide-line overflow-hidden rounded-[22px] bg-white shadow-[var(--shadow-soft)]">
        {plan.items.map((i) => {
          const v = verificationText(i.product.verification);
          return (
            <li key={`${i.product.id}-${i.isAccessory ? 'acc' : 'main'}`}>
              <button onClick={() => onItem(i)} className={`flex w-full items-center gap-3 px-3 py-3 text-left active:bg-sand ${i.isAccessory ? 'pl-8' : ''}`}>
                <div className={`${i.isAccessory ? 'h-10 w-10' : 'h-14 w-14'} shrink-0 overflow-hidden rounded-xl bg-paper`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {i.product.imageUrl && <img src={productImage(i.product, 'xs')} alt="" className="h-full w-full object-contain p-1" loading="lazy" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted">
                    {i.isAccessory ? `+ ${i.role}` : i.role}
                    {i.quantity > 1 && ` · ×${i.quantity}`}
                  </p>
                  <p className="truncate text-[15px] font-medium">{i.product.name}</p>
                  <p className="truncate text-xs text-muted">{descriptor(i.product)}</p>
                  {v.tone === 'warn' && <p className="text-[11px] text-warn">{v.text}</p>}
                </div>
                <p className="shrink-0 text-[15px] font-medium tabular-nums">{ils(i.lineTotal)}</p>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="mt-5 flex items-end justify-between px-1">
        <div>
          <p className="text-sm text-muted">Estimated total</p>
          <p className="text-[34px] font-semibold leading-tight tracking-tight tabular-nums">{ils(plan.total)}</p>
        </div>
        {plan.budget != null && (
          <p className={`mb-1.5 flex items-center gap-1 text-sm ${plan.withinBudget ? 'text-ok' : 'text-warn'}`}>
            {plan.withinBudget && <IconCheck className="h-4 w-4" />}
            {plan.withinBudget ? `Within ${ils(plan.budget)}` : `Over ${ils(plan.budget)} budget`}
          </p>
        )}
      </div>
      <p className="px-1 text-xs leading-relaxed text-muted">
        {live > 0 ? `${live} of ${plan.items.length} prices checked live on IKEA just now. ` : ''}
        {live < plan.items.length && `${live > 0 ? 'Other prices' : 'Prices'} from the IKEA Israel catalog snapshot of ${fmtDate(plan.catalogCapturedAt)}. `}
        Final price and availability are confirmed at IKEA.
      </p>
      {plan.notes.map((n) => (
        <p key={n} className="mt-1 px-1 text-xs text-warn">
          {n}
        </p>
      ))}

      <button onClick={() => setShopOpen(true)} className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-ink py-4 text-[16px] font-medium text-white active:scale-[0.99]">
        Shop at IKEA <IconArrowUpRight className="h-4 w-4" />
      </button>

      <ShopAllSheet plan={plan} open={shopOpen} onClose={() => setShopOpen(false)} />
    </section>
  );
}

function ShopAllSheet({ plan, open, onClose }: { plan: DesignPlan; open: boolean; onClose: () => void }) {
  const [opened, setOpened] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    const text = [
      'My Home Private Stylist — shopping list (IKEA Israel)',
      ...plan.items.map((i) => `${i.quantity}× ${i.product.name} — ${descriptor(i.product)} (art. ${i.product.retailerProductId}) ${ils(i.lineTotal)}\n   ${i.product.url}`),
      `Estimated total: ${ils(plan.total)}`,
    ].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <Sheet open={open} onClose={onClose} title="Shop at IKEA">
      <p className="text-sm leading-relaxed text-muted">Checkout happens on IKEA&apos;s website. Open each product and add it to your IKEA cart.</p>
      <ul className="mt-4 space-y-2">
        {plan.items.map((i) => (
          <li key={`${i.product.id}-${i.isAccessory ? 'a' : 'm'}`}>
            <a
              href={i.product.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpened((s) => new Set(s).add(i.product.id))}
              className="flex items-center gap-3 rounded-2xl bg-white px-3 py-2.5"
            >
              <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-paper">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {i.product.imageUrl && <img src={productImage(i.product, 'xs')} alt="" className="h-full w-full object-contain p-1" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-medium">
                  {i.quantity}× {i.product.name}
                </p>
                <p className="truncate text-xs text-muted">{descriptor(i.product)}</p>
              </div>
              {opened.has(i.product.id) ? <IconCheck className="h-5 w-5 text-ok" /> : <IconArrowUpRight className="h-5 w-5 text-muted" />}
            </a>
          </li>
        ))}
      </ul>
      <button onClick={copy} className="mt-4 flex w-full items-center justify-center gap-2 rounded-full border border-line bg-white py-3.5 text-[15px] font-medium">
        <IconCopy className="h-4 w-4" /> {copied ? 'Copied' : 'Copy shopping list'}
      </button>
    </Sheet>
  );
}
