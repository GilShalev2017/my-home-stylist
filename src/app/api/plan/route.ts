import { z } from 'zod';
import { getAI } from '@/server/ai';
import { createDesignPlan } from '@/server/design/designer';
import { handle, HttpError } from '@/server/http';
import type { DesignRequest } from '@/lib/domain';

export const runtime = 'nodejs';
export const maxDuration = 90;

const Body = z.object({
  analysis: z.any(),
  style: z.enum(['warm_luxury', 'warm_minimal', 'modern', 'scandinavian', 'japandi', 'luxury_hotel', 'mediterranean']),
  instructions: z.string().max(1000).default(''),
  budget: z.number().int().positive().max(200000).nullable(),
  keep: z.array(z.enum(['bed', 'bedding', 'floor', 'walls', 'curtains', 'rug', 'bedside_tables', 'lighting', 'wall_art', 'mirror', 'plants', 'decor'])).default([]),
  action: z.enum(['new', 'style', 'cheaper', 'warmer', 'colors', 'refine']).default('new'),
  colorDirection: z.string().max(200).optional(),
  previous: z
    .object({
      style: z.string(),
      concept: z.string(),
      palette: z.array(z.string()),
      total: z.number(),
      items: z.array(z.object({ productId: z.string(), slot: z.string(), quantity: z.number() })),
    })
    .optional(),
});

export async function POST(req: Request) {
  return handle(req, async () => {
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) throw new HttpError(400, 'Invalid design request');
    if (!parsed.data.analysis?.architecture) throw new HttpError(400, 'Room analysis missing');
    const plan = await createDesignPlan(parsed.data as unknown as DesignRequest, getAI());
    return { plan };
  });
}
