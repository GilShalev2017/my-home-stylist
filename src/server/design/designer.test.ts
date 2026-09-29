import { beforeAll, describe, expect, it } from 'vitest';
import { createDesignPlan } from './designer';
import { buildRenderPrompt } from './render';
import { getAI } from '@/server/ai';
import { getAllProducts } from '@/server/retailers/registry';
import type { DesignRequest } from '@/lib/domain';

beforeAll(() => {
  process.env.AI_MOCK = '1';
  process.env.DISABLE_LIVE_PRICE_CHECK = '1';
});

async function baseRequest(): Promise<DesignRequest> {
  const analysis = await getAI().analyzer.analyzeRoom({ base64: '', mediaType: 'image/jpeg' });
  return { analysis, style: 'warm_luxury', instructions: 'Use beige, cream and warm wood', budget: 5000, keep: ['bed', 'floor', 'walls'], action: 'new' };
}

describe('createDesignPlan (demo AI, real catalog)', () => {
  it('uses only real catalog products and stays within budget', async () => {
    const plan = await createDesignPlan(await baseRequest(), getAI());
    const ids = new Set((await getAllProducts()).map((p) => p.id));
    expect(plan.items.length).toBeGreaterThan(4);
    for (const i of plan.items) {
      expect(ids.has(i.product.id)).toBe(true);
      expect(i.product.url).toMatch(/^https:\/\/www\.ikea\.com\/il\/he\/p\//);
      expect(i.lineTotal).toBe(i.product.price * i.quantity);
    }
    expect(plan.total).toBe(plan.items.reduce((s, i) => s + i.lineTotal, 0));
    expect(plan.total).toBeLessThanOrEqual(5000);
    expect(plan.withinBudget).toBe(true);
  });

  it('respects keep constraints (kept bed → no bed frame or headboard)', async () => {
    const plan = await createDesignPlan(await baseRequest(), getAI());
    expect(plan.items.some((i) => i.slot === 'bed_frame' || i.slot === 'headboard')).toBe(false);
    const req = await baseRequest();
    req.keep = ['bed', 'floor', 'walls', 'curtains', 'rug'];
    const plan2 = await createDesignPlan(req, getAI());
    expect(plan2.items.some((i) => i.slot === 'curtains' || i.slot === 'rug')).toBe(false);
  });

  it('adds inner cushions when cushion covers are chosen', async () => {
    const plan = await createDesignPlan(await baseRequest(), getAI());
    const cover = plan.items.find((i) => i.slot === 'cushion_cover' && !i.isAccessory);
    if (cover) {
      const pad = plan.items.find((i) => i.isAccessory && i.accessoryFor === cover.product.id);
      expect(pad?.quantity).toBe(cover.quantity);
    }
  });

  it('"make it cheaper" reduces the total with real alternatives', async () => {
    const first = await createDesignPlan({ ...(await baseRequest()), budget: 10000 }, getAI());
    const target = Math.floor((first.total * 0.65) / 100) * 100;
    const cheaper = await createDesignPlan(
      {
        ...(await baseRequest()),
        budget: target,
        action: 'cheaper',
        previous: { style: first.style, concept: first.concept, palette: first.palette, total: first.total, items: first.items.filter((i) => !i.isAccessory).map((i) => ({ productId: i.product.id, slot: i.slot, quantity: i.quantity })) },
      },
      getAI(),
    );
    expect(cheaper.total).toBeLessThanOrEqual(target);
    expect(cheaper.total).toBeLessThan(first.total);
  });

  it('render prompt contains the fidelity rules, kept items and every product', async () => {
    const req = await baseRequest();
    const plan = await createDesignPlan(req, getAI());
    const prompt = buildRenderPrompt(plan, req.analysis, new Map());
    expect(prompt).toContain('SAME ROOM');
    expect(prompt).toContain('Do NOT add, remove, move or resize any window');
    expect(prompt).toContain('KEEPING these existing items');
    for (const i of plan.items.filter((x) => !x.isAccessory)) expect(prompt).toContain(i.product.nameEn);
  });
});
