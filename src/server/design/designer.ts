import { randomUUID } from 'node:crypto';
import { KEEP_TO_SLOTS, SLOT_LABELS, type DesignPlan, type DesignRequest, type PlanItem, type Product, type Slot } from '@/lib/domain';
import { STYLE_BY_ID } from '@/lib/styles';
import type { AIProviders, CandidateSummary, StylistBrief } from '@/server/ai/types';
import { HybridRetriever } from '@/server/retrieval/retriever';
import { catalogCapturedAt, getProductById, getRetailer } from '@/server/retailers/registry';
import { optimizeSelection, type SlotChoice } from './optimizer';

/** Slots the stylist may fill, per room type. */
const ROOM_SLOTS: Record<string, Slot[]> = {
  bedroom: ['duvet_cover', 'bedspread', 'cushion_cover', 'throw', 'rug', 'bedside_table', 'table_lamp', 'floor_lamp', 'ceiling_light', 'curtains', 'mirror', 'wall_art', 'plant', 'decor', 'headboard', 'bed_frame'],
  living_room: ['rug', 'cushion_cover', 'throw', 'floor_lamp', 'table_lamp', 'ceiling_light', 'curtains', 'mirror', 'wall_art', 'plant', 'decor', 'bedside_table'],
  dining_room: ['rug', 'ceiling_light', 'curtains', 'mirror', 'wall_art', 'plant', 'decor'],
  other: ['rug', 'cushion_cover', 'throw', 'floor_lamp', 'table_lamp', 'ceiling_light', 'curtains', 'mirror', 'wall_art', 'plant', 'decor'],
};

/** Max share of the budget a single slot's candidates may take (keeps candidate lists sensible). */
const SLOT_BUDGET_SHARE: Partial<Record<Slot, number>> = { bed_frame: 0.7, headboard: 0.35, rug: 0.35, curtains: 0.25, bedside_table: 0.3, floor_lamp: 0.2, ceiling_light: 0.2, mirror: 0.2 };

const PRIORITY_WEIGHT = { 1: 0.6, 2: 1.0, 3: 1.6 } as const;

function summarize(p: Product, prior: number): CandidateSummary {
  return {
    id: p.id,
    name: p.name,
    description: `${p.categoryLabel}: ${p.nameEn.replace(p.name, '').trim()}`,
    price: p.price,
    colors: p.colors,
    materials: p.materials,
    dimensionsCm: p.dimensionsCm,
    prior,
  };
}

export async function createDesignPlan(req: DesignRequest, ai: AIProviders): Promise<DesignPlan> {
  const style = STYLE_BY_ID[req.style];
  const locked = new Set(req.keep.flatMap((k) => KEEP_TO_SLOTS[k]));
  const slots = (ROOM_SLOTS[req.analysis.roomType] ?? ROOM_SLOTS.other).filter((s) => !locked.has(s));

  // ---- 1. Retrieve candidates from the catalog (catalog-first: before any image is generated)
  const retriever = new HybridRetriever();
  const hintText = [req.instructions, req.colorDirection, style.brief].filter(Boolean).join(' ');
  const prevBySlot = new Map((req.previous?.items ?? []).map((i) => [i.slot, i]));
  const prevProducts = new Map<string, Product>();
  for (const i of req.previous?.items ?? []) {
    const p = await getProductById(i.productId);
    if (p) prevProducts.set(p.id, p);
  }

  const slotCandidates = await Promise.all(
    slots.map(async (slot) => {
      let maxPrice = req.budget != null ? Math.round(req.budget * (SLOT_BUDGET_SHARE[slot] ?? 0.15)) : undefined;
      const prev = prevBySlot.get(slot);
      if (req.action === 'cheaper' && prev) {
        const prevPrice = prevProducts.get(prev.productId)?.price;
        if (prevPrice != null) maxPrice = Math.min(maxPrice ?? Infinity, prevPrice);
      }
      const candidates = await retriever.candidates({
        slot,
        style: req.style,
        text: hintText,
        maxPrice,
        limit: 10,
        includeIds: prev ? [prev.productId] : [],
      });
      return { slot, candidates };
    }),
  );
  const available = slotCandidates.filter((s) => s.candidates.length > 0);

  // ---- 2. The stylist rates real candidates for this room + brief
  const brief: StylistBrief = await ai.stylist.createBrief({
    analysis: req.analysis,
    style: req.style,
    styleBrief: style.brief,
    instructions: req.instructions,
    budget: req.budget,
    keep: req.keep,
    action: req.action,
    colorDirection: req.colorDirection,
    previous: req.previous
      ? {
          concept: req.previous.concept,
          palette: req.previous.palette,
          total: req.previous.total,
          items: req.previous.items.map((i) => ({ ...i, price: prevProducts.get(i.productId)?.price ?? 0 })),
        }
      : undefined,
    slots: available.map(({ slot, candidates }) => ({
      slot,
      label: SLOT_LABELS[slot],
      candidates: candidates.map((c) => summarize(c.product, c.score)),
    })),
  });

  // ---- 3. Budget optimization over the stylist's ratings (exact prices, no LLM arithmetic)
  const pad = await getProductById('ikea-il:50550702');
  const byId = new Map(available.flatMap((s) => s.candidates.map((c) => [c.product.id, c] as const)));
  const choices: SlotChoice<Slot>[] = [];
  const briefBySlot = new Map(brief.slots.map((s) => [s.slot, s]));
  for (const { slot } of available) {
    const b = briefBySlot.get(slot);
    if (!b || !b.include) continue;
    const qty = Math.max(1, Math.min(4, Math.round(b.quantity || 1)));
    const weight = PRIORITY_WEIGHT[(b.priority as 1 | 2 | 3) ?? 2] ?? 1;
    let rated = b.ratings.filter((r) => byId.has(r.productId) && r.score >= 4);
    if (!rated.length) rated = [...b.ratings].filter((r) => byId.has(r.productId)).sort((x, y) => y.score - x.score).slice(0, 1);
    const options = rated.map((r) => {
      const c = byId.get(r.productId)!;
      const accessoryCost = c.product.requires?.length && pad ? pad.price * qty : 0;
      return {
        id: r.productId,
        cost: c.product.price * qty + accessoryCost,
        value: weight * (Math.max(0, Math.min(10, r.score)) / 10) * (0.9 + 0.1 * c.score),
      };
    });
    choices.push({ slot, required: b.priority === 3, options });
  }
  const result = optimizeSelection(choices, req.budget);

  // ---- 4. Build plan items (+ required accessories), then verify prices live where possible
  const items: PlanItem[] = [];
  for (const { slot } of choices) {
    const pick = result.picks[slot];
    if (!pick) continue;
    const b = briefBySlot.get(slot)!;
    const c = byId.get(pick.id)!;
    const qty = Math.max(1, Math.min(4, Math.round(b.quantity || 1)));
    const rating = b.ratings.find((r) => r.productId === pick.id)?.score ?? 5;
    items.push({
      slot,
      role: SLOT_LABELS[slot],
      placement: b.placement,
      quantity: qty,
      product: c.product,
      lineTotal: c.product.price * qty,
      confidence: Math.round((rating / 10) * 100) / 100,
    });
    if (c.product.requires?.length && pad) {
      items.push({
        slot,
        role: 'Inner cushion',
        placement: 'Inside the cushion covers',
        quantity: qty,
        product: pad,
        lineTotal: pad.price * qty,
        confidence: 1,
        isAccessory: true,
        accessoryFor: c.product.id,
      });
    }
  }

  await verifyPrices(items);
  const total = items.reduce((s, i) => s + i.lineTotal, 0);
  const notes: string[] = [];
  if (!result.feasible) notes.push('Some essential pieces did not fit the budget, so the design uses fewer items.');
  if (req.budget != null && total > req.budget) notes.push('Live prices changed since the catalog snapshot and the total is now slightly above budget.');
  const changed = items.filter((i) => i.product.verification.previousPrice != null);
  if (changed.length) notes.push(`Updated ${changed.length} price${changed.length > 1 ? 's' : ''} from the live IKEA site.`);

  return {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    style: req.style,
    action: req.action,
    instructions: req.instructions,
    budget: req.budget,
    keep: req.keep,
    concept: brief.concept,
    palette: brief.palette,
    renderNotes: brief.renderNotes,
    items,
    total,
    currency: 'ILS',
    withinBudget: req.budget == null || total <= req.budget,
    notes,
    catalogCapturedAt: catalogCapturedAt(),
    mode: ai.mode,
  };
}

/** Try a live price check for each selected product (bounded time), updating price + status. */
async function verifyPrices(items: PlanItem[]) {
  await Promise.all(
    items.map(async (item) => {
      const retailer = getRetailer(item.product.retailerId);
      if (!retailer) {
        item.product = { ...item.product, verification: { status: 'verification_required', checkedAt: new Date().toISOString(), message: 'Unknown retailer' } };
        return;
      }
      const price = await retailer.getPrice(item.product.id);
      if (!price) {
        item.product = { ...item.product, verification: { status: 'verification_required', checkedAt: new Date().toISOString() } };
        return;
      }
      item.product = { ...item.product, price: price.price, verification: price.verification };
      item.lineTotal = price.price * item.quantity;
    }),
  );
}
