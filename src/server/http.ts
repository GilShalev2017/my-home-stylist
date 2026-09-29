import type { ImageInput } from '@/server/ai/types';

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Optional passcode gate (APP_ACCESS_CODE) so a public deployment can't burn API credits. */
export function checkAccess(req: Request) {
  const code = process.env.APP_ACCESS_CODE;
  if (!code) return;
  if (req.headers.get('x-access-code') !== code) throw new HttpError(401, 'Access code required');
}

export function parseDataUrl(dataUrl: unknown): ImageInput {
  if (typeof dataUrl !== 'string') throw new HttpError(400, 'Missing image');
  const m = dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
  if (!m) throw new HttpError(400, 'Image must be a JPEG, PNG or WebP data URL');
  if (m[2].length > 6_000_000) throw new HttpError(413, 'Image too large');
  return { mediaType: m[1] as ImageInput['mediaType'], base64: m[2] };
}

export async function handle(req: Request, fn: () => Promise<unknown>): Promise<Response> {
  try {
    checkAccess(req);
    return Response.json(await fn());
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500;
    const message = err instanceof Error ? err.message : 'Unexpected error';
    console.error('[api]', status, message, err instanceof HttpError ? '' : err);
    return Response.json({ error: status === 500 ? `Something went wrong: ${message}` : message }, { status });
  }
}
