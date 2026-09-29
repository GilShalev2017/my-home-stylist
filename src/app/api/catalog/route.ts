import { catalogCapturedAt, getAllProducts } from '@/server/retailers/registry';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const category = new URL(req.url).searchParams.get('category');
  const products = (await getAllProducts()).filter((p) => !category || p.category === category);
  return Response.json({ capturedAt: catalogCapturedAt(), kind: 'DEVELOPMENT DATASET', count: products.length, products });
}
