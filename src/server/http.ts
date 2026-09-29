import { randomUUID } from 'node:crypto';
import type { ImageInput } from '@/server/ai/types';

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = 'bad_request',
  ) {
    super(message);
  }
}

/** Optional passcode gate (APP_ACCESS_CODE) so a public deployment can't burn API credits. */
export function checkAccess(req: Request) {
  const code = process.env.APP_ACCESS_CODE;
  if (!code) return;
  if (req.headers.get('x-access-code') !== code) throw new HttpError(401, 'Access code required', 'access_code');
}

export function parseDataUrl(dataUrl: unknown): ImageInput {
  if (typeof dataUrl !== 'string') throw new HttpError(400, 'Missing image', 'missing_image');
  const m = dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
  if (!m) throw new HttpError(400, 'Image must be a JPEG, PNG or WebP data URL', 'bad_image');
  if (m[2].length > 6_000_000) throw new HttpError(413, 'Image too large', 'image_too_large');
  return { mediaType: m[1] as ImageInput['mediaType'], base64: m[2] };
}

interface Classified {
  status: number;
  code: string;
  message: string;
}

/** Turn provider/SDK errors (OpenAI, Anthropic) into clear, actionable messages. */
export function classifyError(err: unknown): Classified {
  if (err instanceof HttpError) return { status: err.status, code: err.code, message: err.message };
  const e = err as { status?: number; code?: string; name?: string; message?: string; error?: { code?: string; type?: string; message?: string } };
  const raw = String(e?.error?.message ?? e?.message ?? err ?? 'Unknown error');
  const code = String(e?.code ?? e?.error?.code ?? e?.error?.type ?? '');
  const provider = /anthropic|claude/i.test(raw) || e?.error?.type === 'error' ? 'Claude' : 'the AI provider';

  if (code === 'moderation_blocked' || /safety system|moderation|content policy/i.test(raw))
    return { status: 422, code: 'safety_rejected', message: 'The image model declined this photo (safety filter). Try a photo without people, screens or artwork in view.' };
  if (/insufficient_quota|billing_hard_limit|billing|exceeded your current quota|credit balance/i.test(code + raw))
    return { status: 402, code: 'no_credit', message: `The API account has no credit left or reached its spending limit (${raw.slice(0, 160)}).` };
  if (e?.status === 429) return { status: 429, code: 'rate_limited', message: 'Too many requests to the AI provider right now. Wait a minute and retry.' };
  if (e?.status === 401) return { status: 502, code: 'provider_auth', message: `An API key was rejected (${raw.slice(0, 160)}). Check the keys in Vercel.` };
  if (e?.status === 403 && /verif/i.test(raw))
    return { status: 502, code: 'org_verification', message: 'OpenAI requires organization verification to use image models. Verify at platform.openai.com → Settings → Organization.' };
  if (e?.name === 'APIConnectionTimeoutError' || /timed? ?out|timeout/i.test(raw))
    return { status: 504, code: 'provider_timeout', message: 'The image model took too long.' };
  if (typeof e?.status === 'number') return { status: 502, code: 'provider_error', message: `${provider} error ${e.status}: ${raw.slice(0, 300)}` };
  return { status: 500, code: 'server_error', message: raw.slice(0, 300) };
}

export async function handle(req: Request, fn: () => Promise<unknown>): Promise<Response> {
  const requestId = randomUUID().slice(0, 8);
  const step = new URL(req.url).pathname.replace(/^\/api\//, '');
  const started = Date.now();
  try {
    checkAccess(req);
    const result = await fn();
    console.log(`[api] ${step} ok ${Date.now() - started}ms ref=${requestId}`);
    return Response.json(result, { headers: { 'x-request-id': requestId } });
  } catch (err) {
    const c = classifyError(err);
    console.error(`[api] ${step} FAILED ${c.status} ${c.code} ${Date.now() - started}ms ref=${requestId}: ${c.message}`, c.code === 'server_error' || c.code === 'provider_error' ? err : '');
    return Response.json({ error: c.message, code: c.code, step, requestId }, { status: c.status, headers: { 'x-request-id': requestId } });
  }
}
