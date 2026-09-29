import { getAI } from '@/server/ai';
import { catalogCapturedAt, getAllProducts, getRetailers } from '@/server/retailers/registry';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const ai = getAI();
  const products = await getAllProducts();
  return Response.json({
    mode: ai.mode,
    providers: ai.status,
    accessCodeRequired: !!process.env.APP_ACCESS_CODE,
    retailers: getRetailers().map((r) => r.info),
    catalog: { products: products.length, capturedAt: catalogCapturedAt(), kind: 'DEVELOPMENT DATASET' },
  });
}
