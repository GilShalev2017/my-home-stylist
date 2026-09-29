'use client';

import type { DesignAction, DesignPlan, Hotspot, KeepKey, PlanItem, RenderResult, RoomAnalysis, StyleId } from '@/lib/domain';
import type { RenderSize } from './image';

const CODE_KEY = 'mhs.accessCode';

export function getAccessCode(): string {
  try {
    return localStorage.getItem(CODE_KEY) ?? '';
  } catch {
    return '';
  }
}
export function setAccessCode(code: string) {
  try {
    localStorage.setItem(CODE_KEY, code);
  } catch {}
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function post<T>(path: string, body: unknown, timeoutMs: number): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-access-code': getAccessCode() },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 401) window.dispatchEvent(new CustomEvent('mhs:access-required'));
      throw new ApiError(res.status, data.error || (res.status === 504 ? 'The designer took too long. Please try again.' : `Request failed (${res.status})`));
    }
    return data as T;
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw new ApiError(504, 'This is taking longer than expected. Please try again.');
    throw e;
  } finally {
    clearTimeout(t);
  }
}

export const api = {
  health: async () => (await fetch('/api/health', { cache: 'no-store' })).json() as Promise<{
    mode: 'live' | 'demo';
    providers: { analyzer: string; stylist: string; editor: string; missing: string[] };
    accessCodeRequired: boolean;
    catalog: { products: number; capturedAt: string; kind: string };
  }>,

  analyze: (image: string) => post<{ analysis: RoomAnalysis; mode: 'live' | 'demo' }>('/api/analyze', { image }, 130_000),

  plan: (req: {
    analysis: RoomAnalysis;
    style: StyleId;
    instructions: string;
    budget: number | null;
    keep: KeepKey[];
    action: DesignAction;
    colorDirection?: string;
    previous?: { style: StyleId; concept: string; palette: string[]; total: number; items: { productId: string; slot: string; quantity: number }[] };
  }) => post<{ plan: DesignPlan }>('/api/plan', req, 160_000),

  render: (req: { image: string; size: RenderSize; padded: boolean; plan: DesignPlan; analysis: RoomAnalysis }) =>
    post<RenderResult>('/api/render', req, 310_000),

  locate: (image: string, items: PlanItem[]) => post<{ hotspots: Hotspot[] }>('/api/locate', { image, items }, 90_000),
};
