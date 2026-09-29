import { describe, expect, it } from 'vitest';
import { optimizeSelection } from './optimizer';

const slots = [
  { slot: 'rug', required: true, options: [{ id: 'rugA', cost: 895, value: 1.5 }, { id: 'rugB', cost: 495, value: 1.4 }, { id: 'rugC', cost: 79, value: 0.6 }] },
  { slot: 'lamp', required: true, options: [{ id: 'lampA', cost: 450, value: 1.5 }, { id: 'lampB', cost: 250, value: 1.3 }] },
  { slot: 'art', required: false, options: [{ id: 'artA', cost: 225, value: 0.5 }] },
];

describe('optimizeSelection', () => {
  it('never exceeds the budget', () => {
    for (const budget of [300, 800, 1000, 1500, 5000]) {
      const r = optimizeSelection(slots, budget);
      expect(r.totalCost).toBeLessThanOrEqual(budget);
    }
  });
  it('trades down on the most efficient slot when the budget is tight', () => {
    const r = optimizeSelection(slots, 1000);
    // rugB + lampB + art (₪970, value 3.2) beats rugB + lampA (₪945, value 2.9)
    expect(r.picks.rug?.id).toBe('rugB');
    expect(r.picks.lamp?.id).toBe('lampB');
    expect(r.picks.art?.id).toBe('artA');
    expect(r.totalCost).toBe(970);
  });
  it('picks the best of everything with no limit', () => {
    const r = optimizeSelection(slots, null);
    expect(r.picks.rug?.id).toBe('rugA');
    expect(r.picks.art?.id).toBe('artA');
  });
  it('flags infeasible budgets', () => {
    const r = optimizeSelection(slots, 100);
    expect(r.feasible).toBe(false);
    expect(r.totalCost).toBeLessThanOrEqual(100);
  });
  it('handles large budgets with scaling without exceeding them', () => {
    const big = [{ slot: 'bed', required: true, options: [{ id: 'b1', cost: 30999, value: 2 }, { id: 'b2', cost: 20001, value: 1 }] }];
    const r = optimizeSelection(big, 31000);
    expect(r.picks.bed?.id).toBe('b1');
    expect(r.totalCost).toBeLessThanOrEqual(31000);
  });
});
