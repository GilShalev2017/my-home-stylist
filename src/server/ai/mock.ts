import type { Hotspot, RoomAnalysis, Slot } from '@/lib/domain';
import type { EditRequest, ImageEditor, ImageInput, ProductLocator, RoomAnalyzer, Stylist, StylistBrief, StylistInput } from './types';

/**
 * Demo providers: used when API keys are not configured (or AI_MOCK=1).
 * They exercise the full pipeline (catalog, retrieval, budget optimizer, shopping list) without
 * calling any AI service. The "render" returns the original photo unchanged and the UI says so.
 */
export class DemoRoomAnalyzer implements RoomAnalyzer {
  async analyzeRoom(): Promise<RoomAnalysis> {
    return {
      roomType: 'bedroom',
      summary: 'Demo analysis (AI not configured): a bedroom with a double bed against the main wall and a window to the side.',
      camera: 'Standing height, wide angle, facing the bed wall.',
      lighting: 'Daylight from the window, neutral white.',
      architecture: {
        walls: 'Plain light walls',
        floor: 'Light floor tiles',
        ceiling: 'Flat white ceiling',
        windows: 'One window on the side wall',
        doors: 'None visible',
        fixedFeatures: [],
      },
      bedSize: 'double',
      elements: [
        { id: 'bed', kind: 'bed', label: 'Double bed', description: 'Double bed against the main wall', position: { x: 0.5, y: 0.62 } },
        { id: 'window', kind: 'window', label: 'Window', description: 'Window on the side wall', position: { x: 0.85, y: 0.35 } },
      ],
      keepSuggestions: [
        { key: 'bed', present: true, defaultKeep: true },
        { key: 'bedding', present: true, defaultKeep: false },
        { key: 'floor', present: true, defaultKeep: true },
        { key: 'walls', present: true, defaultKeep: true },
        { key: 'curtains', present: false, defaultKeep: false },
        { key: 'rug', present: false, defaultKeep: false },
        { key: 'bedside_tables', present: true, defaultKeep: false },
        { key: 'lighting', present: true, defaultKeep: false },
        { key: 'wall_art', present: false, defaultKeep: false },
        { key: 'mirror', present: false, defaultKeep: false },
        { key: 'plants', present: false, defaultKeep: false },
        { key: 'decor', present: false, defaultKeep: false },
      ],
    };
  }
}

const DEMO_PLAN: Partial<Record<Slot, { priority: 1 | 2 | 3; quantity: number; placement: string }>> = {
  duvet_cover: { priority: 3, quantity: 1, placement: 'On the bed' },
  bedspread: { priority: 2, quantity: 1, placement: 'Folded over the lower third of the bed' },
  cushion_cover: { priority: 2, quantity: 2, placement: 'Against the headboard' },
  throw: { priority: 1, quantity: 1, placement: 'Draped at the foot of the bed' },
  rug: { priority: 3, quantity: 1, placement: 'Under the lower two-thirds of the bed' },
  bedside_table: { priority: 3, quantity: 2, placement: 'Either side of the bed' },
  table_lamp: { priority: 3, quantity: 2, placement: 'On each bedside table' },
  curtains: { priority: 2, quantity: 1, placement: 'Floor-length on the window' },
  wall_art: { priority: 1, quantity: 1, placement: 'Centred above the bed' },
  plant: { priority: 1, quantity: 1, placement: 'On a bedside table' },
  sofa: { priority: 3, quantity: 1, placement: 'Against the main wall' },
  coffee_table: { priority: 2, quantity: 1, placement: 'In front of the sofa' },
  dining_table: { priority: 3, quantity: 1, placement: 'Centre of the dining area' },
  dining_chair: { priority: 3, quantity: 4, placement: 'Around the table' },
};

export class DemoStylist implements Stylist {
  async createBrief(input: StylistInput): Promise<StylistBrief> {
    return {
      concept: `Demo design (AI not configured): a ${input.styleBrief.split(':')[0].toLowerCase()} refresh using real catalog products chosen by style tags and budget.`,
      palette: ['warm white', 'sand', 'oak'],
      renderNotes: '',
      slots: input.slots.map((s) => {
        const plan = DEMO_PLAN[s.slot];
        const cheaper = input.action === 'cheaper';
        return {
          slot: s.slot,
          include: !!plan,
          priority: plan?.priority ?? 1,
          quantity: plan?.quantity ?? 1,
          placement: plan?.placement ?? '',
          ratings: s.candidates.map((c) => ({
            productId: c.id,
            score: Math.round(((c.prior ?? 0.4) * 10 - (cheaper ? c.price / 400 : 0)) * 10) / 10,
          })),
        };
      }),
    };
  }
}

const SLOT_POS: Partial<Record<Slot, [number, number]>> = {
  duvet_cover: [0.5, 0.6],
  bedspread: [0.5, 0.72],
  cushion_cover: [0.45, 0.48],
  throw: [0.6, 0.78],
  rug: [0.5, 0.9],
  bedside_table: [0.18, 0.64],
  table_lamp: [0.18, 0.45],
  curtains: [0.88, 0.35],
  wall_art: [0.5, 0.22],
  plant: [0.82, 0.62],
  mirror: [0.9, 0.45],
  floor_lamp: [0.92, 0.5],
  ceiling_light: [0.5, 0.05],
  sofa: [0.45, 0.62],
  armchair: [0.8, 0.62],
  coffee_table: [0.5, 0.78],
  tv_unit: [0.5, 0.55],
  bookcase: [0.12, 0.45],
  wardrobe: [0.12, 0.45],
  dresser: [0.85, 0.6],
  dining_table: [0.5, 0.7],
  dining_chair: [0.35, 0.72],
  bar_stool: [0.5, 0.72],
};

export class DemoProductLocator implements ProductLocator {
  async locate(_image: ImageInput, items: { productId: string; label: string; description: string }[]): Promise<Hotspot[]> {
    return items.flatMap((i) => {
      const slot = i.label.split(':')[0] as Slot;
      const p = SLOT_POS[slot];
      return p ? [{ productId: i.productId, x: p[0], y: p[1], confidence: 0.3 }] : [];
    });
  }
}

export class DemoImageEditor implements ImageEditor {
  readonly model = 'demo (no image model configured)';
  async editRoom(req: EditRequest) {
    return { base64: req.room.base64, mediaType: req.room.mediaType };
  }
}
