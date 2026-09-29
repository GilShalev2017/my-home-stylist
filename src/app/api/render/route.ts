import { getAI } from '@/server/ai';
import { renderDesign } from '@/server/design/render';
import { handle, HttpError, parseDataUrl } from '@/server/http';

export const runtime = 'nodejs';
export const maxDuration = 300;

const SIZES = ['1024x1024', '1536x1024', '1024x1536'] as const;

export async function POST(req: Request) {
  return handle(req, async () => {
    const body = await req.json();
    const room = parseDataUrl(body.image);
    if (!body.plan?.items || !body.analysis?.architecture) throw new HttpError(400, 'Plan and analysis are required', 'bad_request');
    const size = SIZES.includes(body.size) ? body.size : '1024x1536';
    return renderDesign({ ai: getAI(), room, size, plan: body.plan, analysis: body.analysis, padded: !!body.padded, quality: ['low', 'medium', 'high'].includes(body.quality) ? body.quality : undefined });
  });
}
