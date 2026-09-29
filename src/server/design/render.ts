import { KEEP_LABELS, type DesignPlan, type RoomAnalysis } from '@/lib/domain';
import { STYLE_BY_ID } from '@/lib/styles';
import type { AIProviders, EditRequest, ImageInput } from '@/server/ai/types';
import { IkeaIsraelAdapter } from '@/server/retailers/ikea-israel';

const MAX_REFERENCES = 9;

/**
 * The render prompt. Room fidelity rules come first and are absolute; the product list says
 * exactly what may change. Reference images are passed in the same order as the numbered list.
 */
export function buildRenderPrompt(plan: DesignPlan, analysis: RoomAnalysis, refLabels: Map<string, number>): string {
  const style = STYLE_BY_ID[plan.style];
  const a = analysis.architecture;
  const keep = new Set(plan.keep);
  const L: string[] = [];

  L.push(`Edit image 1, a photograph of the client's real ${analysis.roomType.replace('_', ' ')}. Produce the SAME ROOM after a professional interior designer restyled it — not a new or different room.`);
  L.push('');
  L.push('ROOM FIDELITY — ABSOLUTE RULES:');
  L.push('- Identical camera position, height, lens, framing and perspective as image 1. Same image boundaries.');
  L.push(`- Identical architecture: walls in the same places (${a.walls}); windows exactly as they are (${a.windows}); doors exactly as they are (${a.doors}); same ceiling (${a.ceiling}); same room proportions.`);
  L.push('- Do NOT add, remove, move or resize any window, door, wall, niche, beam, column, radiator, AC unit, socket or built-in.');
  if (a.fixedFeatures.length) L.push(`- Keep these fixed features exactly: ${a.fixedFeatures.join('; ')}.`);
  const floorRequested = /floor|parquet|tiles?|רצפ/i.test(plan.instructions);
  L.push(
    keep.has('floor') || !floorRequested
      ? `- Keep the floor exactly as it is: ${a.floor}.`
      : `- The client asked to change the floor: follow their instructions for the floor finish only; keep the floor plane and perspective identical.`,
  );
  L.push(keep.has('walls') ? '- Keep the wall colour and finish exactly as they are.' : '- Walls may be repainted in a colour from the palette; do not change their position or shape.');
  const keptItems = plan.keep.filter((k) => k !== 'floor' && k !== 'walls');
  if (keptItems.length) {
    const details = keptItems.map((k) => {
      const el = analysis.elements.find((e) => e.kind === k);
      return el ? `${KEEP_LABELS[k]} (${el.description})` : KEEP_LABELS[k];
    });
    L.push(`- The client is KEEPING these existing items — leave them exactly as they are, in place: ${details.join('; ')}.`);
  }
  L.push('- Do not add any furniture, objects or decor other than the products listed below. Remove clutter only if it is loose small items.');
  L.push('');
  L.push('NEW PRODUCTS — use exactly these real products; match their shape, colour, material and proportions to the reference images:');
  plan.items
    .filter((i) => !i.isAccessory)
    .forEach((i, n) => {
      const ref = refLabels.get(i.product.id);
      const size = i.product.dimensionsCm ? `, real size ${i.product.dimensionsCm.join('×')} cm` : '';
      const qty = i.quantity > 1 ? ` ×${i.quantity}` : '';
      L.push(`${n + 1}. ${i.role}${qty}: ${i.product.nameEn}${size}${ref ? ` (see image ${ref})` : ''}. Placement: ${i.placement || 'where a designer would place it'}.`);
    });
  L.push('');
  L.push(`STYLE: ${style.brief}`);
  if (plan.palette.length) L.push(`Palette: ${plan.palette.join(', ')}.`);
  if (plan.concept) L.push(`Concept: ${plan.concept}`);
  if (plan.renderNotes) L.push(`Styling notes: ${plan.renderNotes}`);
  if (plan.instructions.trim()) L.push(`Client instructions (must be followed): "${plan.instructions.trim()}"`);
  L.push('');
  L.push(`LIGHT & PHOTO: keep the light direction of image 1 (${analysis.lighting}); realistic soft shadows and contact shadows; warm lamp glow where lamps are on. Professional interior photograph, photorealistic, true-to-scale products, natural textures. No text, no watermark, no people, no distortion.`);
  return L.join('\n');
}

async function fetchImage(url: string, timeoutMs = 6000): Promise<ImageInput | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'user-agent': 'Mozilla/5.0 (compatible; MyHomeStylist/0.1)' } });
    if (!res.ok) return null;
    const type = res.headers.get('content-type') ?? '';
    const mediaType = type.includes('png') ? 'image/png' : type.includes('webp') ? 'image/webp' : type.includes('jpeg') || type.includes('jpg') ? 'image/jpeg' : null;
    if (!mediaType) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 1000) return null;
    return { base64: buf.toString('base64'), mediaType };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

export async function renderDesign(opts: {
  ai: AIProviders;
  room: ImageInput;
  size: EditRequest['size'];
  plan: DesignPlan;
  analysis: RoomAnalysis;
  padded?: boolean;
}) {
  const { ai, room, size, plan, analysis, padded } = opts;
  const products = plan.items.filter((i) => !i.isAccessory).slice(0, MAX_REFERENCES);

  // Fetch product reference images (real retailer photos). Missing images fall back to text only.
  const refs = await Promise.all(
    products.map(async (i) => {
      const url = IkeaIsraelAdapter.imageUrl(i.product, 'm') ?? i.product.imageUrl;
      const image = url ? await fetchImage(url) : null;
      return image ? { productId: i.product.id, label: i.role, image } : null;
    }),
  );
  const references = refs.filter((r): r is NonNullable<typeof r> => !!r);
  const refLabels = new Map(references.map((r, idx) => [r.productId, idx + 2]));
  let prompt = buildRenderPrompt(plan, analysis, refLabels);
  if (padded) prompt += '\nNote: image 1 has blurred padding bars at its edges to fit the canvas. Leave those bars as they are; edit only the photo area.';

  const out = await ai.editor.editRoom({ room, size, references: references.map(({ label, image }) => ({ label, image })), prompt });
  return {
    image: `data:${out.mediaType};base64,${out.base64}`,
    model: ai.editor.model,
    mode: ai.mode,
    referenceImagesUsed: references.length,
    prompt,
  };
}
