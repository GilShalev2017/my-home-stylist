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
  constructor(
    public status: number,
    message: string,
    public code = 'error',
    public step?: string,
    public requestId?: string,
  ) {
    super(message);
  }
}

/** Human-readable message with the step and a reference you can find in the Vercel logs. */
export function describeError(e: unknown, fallbackStep: string): string {
  if (e instanceof ApiError) {
    const ref = e.requestId ? ` · ref ${e.requestId}` : '';
    return `${e.message} [${e.step ?? fallbackStep} · ${e.code}${e.status ? ` ${e.status}` : ''}${ref}]`;
  }
  if (e instanceof Error && e.message) return `${e.message} [${fallbackStep} · ${e.name}]`;
  return `Unexpected error during ${fallbackStep} (${Object.prototype.toString.call(e)}).`;
}

const VERCEL_ERRORS: Record<string, string> = {
  FUNCTION_INVOCATION_TIMEOUT: 'The server hit its 5-minute limit.',
  FUNCTION_PAYLOAD_TOO_LARGE: 'The request or response was too large for the server.',
  FUNCTION_RESPONSE_PAYLOAD_TOO_LARGE: 'The generated image was too large for the server to send.',
  FUNCTION_INVOCATION_FAILED: 'The server crashed while handling this step.',
};

async function post<T>(path: string, body: unknown, timeoutMs: number): Promise<T> {
  const step = path.replace('/api/', '');
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-access-code': getAccessCode() },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
  } catch (e) {
    clearTimeout(t);
    if ((e as Error).name === 'AbortError') throw new ApiError(0, 'No answer from the server in time.', 'client_timeout', step);
    // Safari: "Load failed"; Chrome: "Failed to fetch" — the connection dropped.
    throw new ApiError(
      0,
      'The connection to the server was lost. This usually happens when the phone locks or you switch apps while the image is being made — keep this screen open and retry.',
      'network',
      step,
    );
  }
  clearTimeout(t);
  const requestId = res.headers.get('x-request-id') ?? res.headers.get('x-vercel-id')?.split('::').pop() ?? undefined;
  const text = await res.text().catch(() => '');
  let data: Record<string, unknown> = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {};
  }
  if (!res.ok) {
    if (res.status === 401) window.dispatchEvent(new CustomEvent('mhs:access-required'));
    const vercelCode = Object.keys(VERCEL_ERRORS).find((k) => text.includes(k));
    const message =
      (data.error as string) ||
      (vercelCode ? VERCEL_ERRORS[vercelCode] : res.status === 504 ? 'The server timed out.' : `The server returned an error (${res.status}).`);
    throw new ApiError(res.status, message, (data.code as string) || vercelCode || 'http_error', (data.step as string) || step, (data.requestId as string) || requestId);
  }
  return data as T;
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

  render: (req: { image: string; size: RenderSize; padded: boolean; plan: DesignPlan; analysis: RoomAnalysis; quality?: 'medium' | 'low' }) =>
    post<RenderResult>('/api/render', req, 310_000),

  locate: (image: string, items: PlanItem[]) => post<{ hotspots: Hotspot[] }>('/api/locate', { image, items }, 90_000),
};
