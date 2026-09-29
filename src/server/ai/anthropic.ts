import Anthropic from '@anthropic-ai/sdk';
import type { Hotspot, KeepKey, RoomAnalysis } from '@/lib/domain';
import type { ImageInput, ProductLocator, RoomAnalyzer, Stylist, StylistBrief, StylistInput } from './types';

const KEEP_KEYS: KeepKey[] = ['bed', 'bedding', 'floor', 'walls', 'curtains', 'rug', 'bedside_tables', 'lighting', 'wall_art', 'mirror', 'plants', 'decor'];

function client() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 2, timeout: 90_000 });
}

function model() {
  return process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';
}

async function callTool<T>(opts: {
  system: string;
  content: Anthropic.Messages.ContentBlockParam[];
  tool: { name: string; description: string; input_schema: Record<string, unknown> };
  maxTokens?: number;
}): Promise<T> {
  const res = await client().messages.create({
    model: model(),
    max_tokens: opts.maxTokens ?? 4000,
    system: opts.system,
    tools: [{ name: opts.tool.name, description: opts.tool.description, input_schema: opts.tool.input_schema as Anthropic.Messages.Tool.InputSchema }],
    tool_choice: { type: 'tool', name: opts.tool.name },
    messages: [{ role: 'user', content: opts.content }],
  });
  const block = res.content.find((b) => b.type === 'tool_use');
  if (!block || block.type !== 'tool_use') throw new Error('Model did not return structured output');
  return block.input as T;
}

function imageBlock(img: ImageInput): Anthropic.Messages.ImageBlockParam {
  return { type: 'image', source: { type: 'base64', media_type: img.mediaType, data: img.base64 } };
}

// ---------------------------------------------------------------- Room analysis

const ANALYSIS_SCHEMA = {
  type: 'object',
  required: ['roomType', 'summary', 'camera', 'lighting', 'architecture', 'bedSize', 'elements', 'keepSuggestions'],
  properties: {
    roomType: { type: 'string', enum: ['bedroom', 'living_room', 'dining_room', 'other'] },
    summary: { type: 'string', description: 'One or two sentences describing the room as photographed.' },
    camera: { type: 'string', description: 'Camera position, height, angle and lens feel (e.g. "standing height from the doorway, wide angle, looking at the bed wall").' },
    lighting: { type: 'string', description: 'Light sources and direction, time of day feel, colour temperature.' },
    architecture: {
      type: 'object',
      required: ['walls', 'floor', 'ceiling', 'windows', 'doors', 'fixedFeatures'],
      properties: {
        walls: { type: 'string', description: 'Which walls are visible, their colour/finish.' },
        floor: { type: 'string', description: 'Floor material, colour, pattern (e.g. "light grey 60x60 porcelain tiles").' },
        ceiling: { type: 'string' },
        windows: { type: 'string', description: 'Exact count, sizes and positions of windows (and shutters/blinds), or "none visible".' },
        doors: { type: 'string', description: 'Exact count and positions of doors, or "none visible".' },
        fixedFeatures: { type: 'array', items: { type: 'string' }, description: 'Built-ins, AC units, radiators, sockets, beams, columns, niches, built-in wardrobes.' },
      },
    },
    bedSize: { type: 'string', enum: ['single', 'double', 'queen', 'king', 'none', 'unknown'] },
    elements: {
      type: 'array',
      description: 'Movable furniture and decor currently visible.',
      items: {
        type: 'object',
        required: ['id', 'kind', 'label', 'description'],
        properties: {
          id: { type: 'string' },
          kind: { type: 'string', enum: [...KEEP_KEYS, 'window', 'door', 'ceiling', 'wardrobe', 'chair', 'desk', 'sofa', 'other'] },
          label: { type: 'string' },
          description: { type: 'string', description: 'Colour, material, size, position in frame.' },
          position: { type: 'object', properties: { x: { type: 'number' }, y: { type: 'number' } }, description: 'Normalized centre (0..1) in the image.' },
        },
      },
    },
    keepSuggestions: {
      type: 'array',
      description: `One entry for each of: ${KEEP_KEYS.join(', ')}.`,
      items: {
        type: 'object',
        required: ['key', 'present', 'defaultKeep'],
        properties: {
          key: { type: 'string', enum: KEEP_KEYS },
          present: { type: 'boolean', description: 'Is this currently in the room?' },
          defaultKeep: { type: 'boolean', description: 'Should it be kept by default? Keep floor, walls and large furniture (bed) by default; soft furnishings and decor are usually replaceable.' },
          note: { type: 'string' },
        },
      },
    },
  },
};

export class ClaudeRoomAnalyzer implements RoomAnalyzer {
  async analyzeRoom(image: ImageInput): Promise<RoomAnalysis> {
    const result = await callTool<RoomAnalysis>({
      system:
        'You are a senior interior designer and architectural photographer. You analyse a photo of a real room so that a redesign can preserve it faithfully. Describe only what is actually visible; be precise about architecture (walls, windows, doors, floor, ceiling), camera viewpoint and light. Never invent features.',
      content: [imageBlock(image), { type: 'text', text: 'Analyse this room photo and report it with the tool.' }],
      tool: { name: 'report_room_analysis', description: 'Structured analysis of the room photo.', input_schema: ANALYSIS_SCHEMA },
      maxTokens: 3000,
    });
    // Ensure every keep key is present.
    const got = new Map(result.keepSuggestions?.map((k) => [k.key, k]) ?? []);
    result.keepSuggestions = KEEP_KEYS.map((key) => got.get(key) ?? { key, present: false, defaultKeep: key === 'floor' || key === 'walls' || key === 'bed' });
    result.elements = result.elements ?? [];
    return result;
  }
}

// ---------------------------------------------------------------- Stylist

const BRIEF_SCHEMA = {
  type: 'object',
  required: ['concept', 'palette', 'renderNotes', 'slots'],
  properties: {
    concept: { type: 'string', description: 'Two sentences max: the design idea for THIS room.' },
    palette: { type: 'array', items: { type: 'string' }, description: '3-5 colour/material names.' },
    renderNotes: { type: 'string', description: 'Extra guidance for the photo-realistic render (mood, lamp glow, styling details). Never architecture changes.' },
    slots: {
      type: 'array',
      items: {
        type: 'object',
        required: ['slot', 'include', 'priority', 'quantity', 'placement', 'ratings'],
        properties: {
          slot: { type: 'string' },
          include: { type: 'boolean', description: 'Should this slot be part of the design at all?' },
          priority: { type: 'integer', enum: [1, 2, 3], description: '3 = essential to the look, 2 = important, 1 = nice to have.' },
          quantity: { type: 'integer', minimum: 1, maximum: 4 },
          placement: { type: 'string', description: 'Exactly where in THIS room it goes, relative to visible features.' },
          ratings: {
            type: 'array',
            description: 'Rate EVERY candidate id given for this slot, 0-10, for fit with the concept, the room and the user instructions.',
            items: { type: 'object', required: ['productId', 'score'], properties: { productId: { type: 'string' }, score: { type: 'number' } } },
          },
        },
      },
    },
  },
};

function fmtCandidate(c: StylistInput['slots'][number]['candidates'][number]) {
  const dims = c.dimensionsCm ? ` | ${c.dimensionsCm.join('x')}cm` : '';
  const attrs = [...c.colors, ...c.materials].join(', ');
  return `  - ${c.id} | ${c.name} — ${c.description} | ₪${c.price}${dims}${attrs ? ` | ${attrs}` : ''}`;
}

export function buildStylistPrompt(input: StylistInput): string {
  const a = input.analysis;
  const lines: string[] = [];
  lines.push(`ROOM: ${a.roomType}. ${a.summary}`);
  lines.push(`Architecture: walls ${a.architecture.walls}; floor ${a.architecture.floor}; windows ${a.architecture.windows}; doors ${a.architecture.doors}.`);
  lines.push(`Bed size: ${a.bedSize}. Existing items: ${a.elements.map((e) => `${e.label} (${e.description})`).join('; ') || 'none listed'}.`);
  lines.push('');
  lines.push(`STYLE: ${input.styleBrief}`);
  lines.push(`BUDGET: ${input.budget == null ? 'no limit' : `₪${input.budget} total for everything new`}. A separate optimizer enforces the budget exactly using your ratings, so rate honestly; when the budget is tight, give good-value pieces fair scores.`);
  lines.push(`KEEP AS IS (do not replace): ${input.keep.length ? input.keep.join(', ') : 'nothing specified'}.`);
  if (input.instructions.trim()) lines.push(`USER INSTRUCTIONS (highest priority — override style defaults): "${input.instructions.trim()}"`);
  if (input.colorDirection) lines.push(`COLOUR DIRECTION requested: ${input.colorDirection}.`);
  if (input.previous) {
    lines.push('');
    lines.push(`PREVIOUS DESIGN (total ₪${input.previous.total}): concept "${input.previous.concept}", palette ${input.previous.palette.join(', ')}.`);
    lines.push(`Previous picks: ${input.previous.items.map((i) => `${i.slot}=${i.productId} (₪${i.price}×${i.quantity})`).join(', ')}.`);
    if (input.action === 'cheaper') lines.push('TASK: make it cheaper while preserving the same look and palette. Prefer cheaper candidates that read the same visually; drop low-impact extras first.');
    if (input.action === 'warmer') lines.push('TASK: same design direction but warmer: warmer whites, sand/beige, warm wood, softer warm lighting.');
    if (input.action === 'colors') lines.push('TASK: keep the style but move to the requested colour direction.');
    if (input.action === 'style') lines.push('TASK: redesign in the new style; you may reuse previous picks only if they truly fit.');
  }
  lines.push('');
  lines.push('CANDIDATE PRODUCTS (real catalog items — you may ONLY use these ids):');
  for (const s of input.slots) {
    lines.push(`[${s.slot}] ${s.label}`);
    for (const c of s.candidates) lines.push(fmtCandidate(c));
  }
  lines.push('');
  lines.push(
    'Decide which slots to include (a calm, professional result usually needs 6-9 purchases — do not clutter), rate every candidate, choose quantity (e.g. 2 bedside tables/lamps for a double bed when both sides are visible; 2-4 cushions), and describe placement in this specific room. Check size fit: bedding and bedspreads must suit the bed size; rugs must suit the floor area. Respond with the tool.',
  );
  return lines.join('\n');
}

export class ClaudeStylist implements Stylist {
  async createBrief(input: StylistInput): Promise<StylistBrief> {
    return callTool<StylistBrief>({
      system:
        'You are a top interior designer working ONLY with a given retailer catalog. You improve the client\'s actual room — never a different room. You follow the client\'s explicit instructions over generic taste. You never invent products: you only rate the candidate ids provided.',
      content: [{ type: 'text', text: buildStylistPrompt(input) }],
      tool: { name: 'submit_design_brief', description: 'Design brief with product ratings per slot.', input_schema: BRIEF_SCHEMA },
      maxTokens: 6000,
    });
  }
}

// ---------------------------------------------------------------- Product location (hotspots)

export class ClaudeProductLocator implements ProductLocator {
  async locate(image: ImageInput, items: { productId: string; label: string; description: string }[]): Promise<Hotspot[]> {
    const list = items.map((i) => `- ${i.productId}: ${i.label} — ${i.description}`).join('\n');
    const out = await callTool<{ hotspots: { productId: string; visible: boolean; x: number; y: number; confidence: number }[] }>({
      system: 'You locate products in an interior photo. Coordinates are normalized: x from left (0) to right (1), y from top (0) to bottom (1). Point at the visual centre of the object. If an item is not clearly visible, mark visible=false.',
      content: [imageBlock(image), { type: 'text', text: `Locate each of these items in the image:\n${list}` }],
      tool: {
        name: 'report_locations',
        description: 'Location of each item.',
        input_schema: {
          type: 'object',
          required: ['hotspots'],
          properties: {
            hotspots: {
              type: 'array',
              items: {
                type: 'object',
                required: ['productId', 'visible', 'x', 'y', 'confidence'],
                properties: { productId: { type: 'string' }, visible: { type: 'boolean' }, x: { type: 'number' }, y: { type: 'number' }, confidence: { type: 'number', description: '0..1' } },
              },
            },
          },
        },
      },
      maxTokens: 1500,
    });
    return out.hotspots
      .filter((h) => h.visible && h.x >= 0 && h.x <= 1 && h.y >= 0 && h.y <= 1)
      .map(({ productId, x, y, confidence }) => ({ productId, x, y, confidence: Math.max(0, Math.min(1, confidence)) }));
  }
}
