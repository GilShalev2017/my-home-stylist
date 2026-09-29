/**
 * Budget-aware product selection: a multiple-choice knapsack.
 * Pick at most one option per slot, maximizing total stylist value, subject to total cost ≤ budget.
 * Exact dynamic programming over integer shekel costs (scaled for large budgets; costs are
 * rounded UP when scaled, so the budget is never exceeded).
 */
export interface SlotOption {
  id: string;
  cost: number; // total ₪ for this option incl. quantity and required accessories
  value: number; // stylist value (higher is better)
}

export interface SlotChoice<S extends string = string> {
  slot: S;
  required: boolean; // skipping costs a penalty
  options: SlotOption[];
}

export interface OptimizationResult<S extends string = string> {
  picks: Partial<Record<S, SlotOption>>;
  totalCost: number;
  totalValue: number;
  feasible: boolean; // every required slot got an option within budget
}

const SKIP_PENALTY_REQUIRED = -2;
const MAX_COLUMNS = 60000; // exact for budgets up to ₪60,000; conservative (never over budget) above

export function optimizeSelection<S extends string>(slots: SlotChoice<S>[], budget: number | null): OptimizationResult<S> {
  if (budget == null) {
    // No limit: best value per slot, cheaper on ties.
    const picks: Partial<Record<S, SlotOption>> = {};
    let totalCost = 0;
    let totalValue = 0;
    for (const s of slots) {
      const best = [...s.options].sort((a, b) => b.value - a.value || a.cost - b.cost)[0];
      if (best && best.value > 0) {
        picks[s.slot] = best;
        totalCost += best.cost;
        totalValue += best.value;
      }
    }
    return { picks, totalCost, totalValue, feasible: slots.every((s) => !s.required || picks[s.slot]) };
  }

  const unit = Math.max(1, Math.ceil(budget / MAX_COLUMNS));
  const B = Math.floor(budget / unit);
  const NEG = -1e9;
  const n = slots.length;
  // dp[i][c] = best value using first i slots with scaled cost exactly ≤ c (we keep "≤" via monotone pass)
  let dp = new Float64Array(B + 1).fill(0);
  const choice: Int16Array[] = []; // chosen option index per slot per cost (-1 = skip)

  for (let i = 0; i < n; i++) {
    const s = slots[i];
    const next = new Float64Array(B + 1).fill(NEG);
    const pick = new Int16Array(B + 1).fill(-1);
    const skipValue = s.required ? SKIP_PENALTY_REQUIRED : 0;
    const scaled = s.options.map((o) => Math.ceil(o.cost / unit));
    for (let c = 0; c <= B; c++) {
      // skip
      let best = dp[c] + skipValue;
      let bestIdx = -1;
      for (let k = 0; k < s.options.length; k++) {
        const w = scaled[k];
        if (w > c) continue;
        const v = dp[c - w] + s.options[k].value;
        if (v > best + 1e-9) {
          best = v;
          bestIdx = k;
        }
      }
      next[c] = best;
      pick[c] = bestIdx;
    }
    dp = next;
    choice.push(pick);
  }

  // Backtrack from the best column (prefer spending less on ties).
  let bestC = 0;
  for (let c = 0; c <= B; c++) if (dp[c] > dp[bestC] + 1e-9) bestC = c;
  const picks: Partial<Record<S, SlotOption>> = {};
  let c = bestC;
  let totalCost = 0;
  let totalValue = 0;
  for (let i = n - 1; i >= 0; i--) {
    const k = choice[i][c];
    if (k >= 0) {
      const o = slots[i].options[k];
      picks[slots[i].slot] = o;
      totalCost += o.cost;
      totalValue += o.value;
      c -= Math.ceil(o.cost / unit);
    }
  }
  const feasible = slots.every((s) => !s.required || picks[s.slot]);
  return { picks, totalCost, totalValue, feasible };
}
