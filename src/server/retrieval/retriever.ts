import type { Product, Slot, StyleId } from '@/lib/domain';
import { getAllProducts } from '@/server/retailers/registry';

/**
 * Semantic retrieval layer.
 *
 * Today: structured filtering + tag/colour/material matching + per-style affinity priors.
 * Tomorrow: plug in an Embedder + VectorIndex (pgvector, or any vector DB) — `HybridRetriever`
 * blends vector similarity in when an index is configured. Nothing upstream changes.
 */
export interface Embedder {
  embed(texts: string[]): Promise<number[][]>;
}

export interface VectorIndex {
  query(vector: number[], k: number, filter?: { categories?: string[] }): Promise<{ id: string; score: number }[]>;
}

export interface RetrievalQuery {
  slot: Slot;
  style: StyleId;
  text?: string; // free text, e.g. "warm beige rug for a luxury bedroom"
  colors?: string[];
  materials?: string[];
  maxPrice?: number;
  limit?: number;
  includeIds?: string[]; // always include (e.g. items from a previous design)
}

export interface Candidate {
  product: Product;
  score: number; // 0..1 prior before the stylist re-ranks
}

/** Map everyday colour/material words (from instructions or palettes) to catalog vocabulary. */
const SYNONYMS: Record<string, string[]> = {
  cream: ['off-white', 'light-beige', 'unbleached'],
  ivory: ['off-white', 'white'],
  sand: ['beige', 'light-beige'],
  oat: ['light-beige', 'natural', 'unbleached'],
  linen: ['natural', 'unbleached', 'light-beige'],
  beige: ['beige', 'light-beige', 'grey-beige'],
  greige: ['grey-beige', 'dark-grey-beige', 'beige-grey'],
  white: ['white', 'off-white'],
  grey: ['grey', 'light-grey', 'dark-grey'],
  gray: ['grey', 'light-grey', 'dark-grey'],
  charcoal: ['dark-grey', 'anthracite'],
  black: ['black', 'anthracite'],
  sage: ['grey-green', 'pale-grey-green'],
  olive: ['grey-green', 'dark-grey-green'],
  green: ['green', 'grey-green', 'dark-green'],
  navy: ['dark-blue'],
  blue: ['blue', 'dark-blue', 'light-blue', 'pale-blue'],
  terracotta: ['orange', 'light-orange-pink', 'red-brown', 'brown-red'],
  pink: ['pink', 'pale-pink', 'light-pink'],
  wood: ['oak', 'oak-veneer', 'walnut', 'walnut-veneer', 'walnut-effect', 'pine', 'birch', 'ash', 'beech', 'bamboo'],
  'warm wood': ['oak', 'oak-veneer', 'walnut', 'walnut-veneer', 'walnut-effect'],
  oak: ['oak', 'oak-veneer', 'oak-effect'],
  walnut: ['walnut', 'walnut-veneer', 'walnut-effect'],
  gold: ['brass', 'brass-plated', 'brass-colour'],
  brass: ['brass', 'brass-plated', 'brass-colour'],
  rattan: ['rattan', 'sedge', 'bamboo'],
  natural: ['natural', 'unbleached', 'rattan', 'sedge', 'bamboo'],
  glass: ['glass', 'opal-white-glass', 'clear-glass'],
  metal: ['nickel-plated', 'chrome-plated', 'brass-plated', 'stainless-steel'],
};

export function expandTerms(text: string): string[] {
  const lower = text.toLowerCase();
  const out = new Set<string>();
  for (const [k, v] of Object.entries(SYNONYMS)) if (lower.includes(k)) v.forEach((x) => out.add(x));
  return [...out];
}

export class HybridRetriever {
  constructor(
    private readonly vector?: { embedder: Embedder; index: VectorIndex },
    private readonly loadProducts: () => Promise<Product[]> = getAllProducts,
  ) {}

  async candidates(q: RetrievalQuery): Promise<Candidate[]> {
    const products = (await this.loadProducts()).filter((p) => p.category === q.slot);
    const wanted = new Set([...(q.colors ?? []), ...(q.materials ?? []), ...expandTerms(q.text ?? '')]);

    let vectorScores = new Map<string, number>();
    if (this.vector && q.text) {
      const [v] = await this.vector.embedder.embed([q.text]);
      const hits = await this.vector.index.query(v, 50, { categories: [q.slot] });
      vectorScores = new Map(hits.map((h) => [h.id, h.score]));
    }

    const scored: Candidate[] = products.map((p) => {
      const style = p.styles[q.style] ?? 0.35;
      const matches = [...p.colors, ...p.materials].filter((t) => wanted.has(t)).length;
      const match = wanted.size ? Math.min(1, matches / 2) : 0;
      const vec = vectorScores.get(p.id) ?? 0;
      const overBudget = q.maxPrice != null && p.price > q.maxPrice;
      const score = (0.6 * style + 0.4 * match + 0.5 * vec) * (overBudget ? 0.2 : 1);
      return { product: p, score: Number(score.toFixed(3)) };
    });

    scored.sort((a, b) => b.score - a.score || a.product.price - b.product.price);
    const limit = q.limit ?? 10;
    const top = scored.slice(0, Math.max(1, limit - 3));
    // Keep a spread of price points so the budget optimizer has real choices.
    const affordable = scored
      .filter((c) => !top.includes(c) && c.score >= 0.2)
      .sort((a, b) => a.product.price - b.product.price)
      .slice(0, limit - top.length);
    const result = [...top, ...affordable];
    for (const id of q.includeIds ?? []) {
      const extra = scored.find((c) => c.product.id === id);
      if (extra && !result.includes(extra)) result.push(extra);
    }
    return result;
  }
}
