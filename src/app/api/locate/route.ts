import { getAI } from '@/server/ai';
import { handle, HttpError, parseDataUrl } from '@/server/http';
import type { PlanItem } from '@/lib/domain';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(req: Request) {
  return handle(req, async () => {
    const body = await req.json();
    const image = parseDataUrl(body.image);
    const items: PlanItem[] = body.items;
    if (!Array.isArray(items)) throw new HttpError(400, 'Items required');
    const list = items
      .filter((i) => !i.isAccessory)
      .map((i) => ({ productId: i.product.id, label: `${i.slot}: ${i.role}`, description: `${i.product.nameEn}. ${i.placement}` }));
    const hotspots = await getAI().locator.locate(image, list);
    return { hotspots };
  });
}
