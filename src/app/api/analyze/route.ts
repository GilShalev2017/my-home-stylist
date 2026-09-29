import { getAI } from '@/server/ai';
import { handle, parseDataUrl } from '@/server/http';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(req: Request) {
  return handle(req, async () => {
    const body = await req.json();
    const image = parseDataUrl(body.image);
    const ai = getAI();
    const analysis = await ai.analyzer.analyzeRoom(image);
    return { analysis, mode: ai.mode };
  });
}
