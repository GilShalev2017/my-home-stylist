/**
 * Shared domain types (safe to import from client and server).
 * Retailer-agnostic: nothing here is IKEA-specific.
 */

export type Currency = 'ILS';

export type ProductCategory =
  | 'bed_frame'
  | 'headboard'
  | 'duvet_cover'
  | 'bedspread'
  | 'throw'
  | 'cushion_cover'
  | 'cushion'
  | 'cushion_pad'
  | 'rug'
  | 'bedside_table'
  | 'table_lamp'
  | 'floor_lamp'
  | 'ceiling_light'
  | 'curtains'
  | 'mirror'
  | 'wall_art'
  | 'plant'
  | 'decor'
  | 'sofa'
  | 'armchair'
  | 'coffee_table'
  | 'tv_unit'
  | 'bookcase'
  | 'wardrobe'
  | 'dresser'
  | 'dining_table'
  | 'dining_chair'
  | 'bar_stool';

/** Design "slots" the stylist can fill. Every slot maps to one catalog category. */
export type Slot = Exclude<ProductCategory, 'cushion_pad'>;

export const SLOT_LABELS: Record<Slot, string> = {
  bed_frame: 'Bed',
  headboard: 'Headboard',
  duvet_cover: 'Bedding',
  bedspread: 'Bedspread',
  throw: 'Throw',
  cushion_cover: 'Cushions',
  cushion: 'Bolster cushion',
  rug: 'Rug',
  bedside_table: 'Bedside table',
  table_lamp: 'Bedside lamp',
  floor_lamp: 'Floor lamp',
  ceiling_light: 'Ceiling light',
  curtains: 'Curtains',
  mirror: 'Mirror',
  wall_art: 'Wall art',
  plant: 'Plant',
  decor: 'Decor',
  sofa: 'Sofa',
  armchair: 'Armchair',
  coffee_table: 'Coffee table',
  tv_unit: 'TV unit',
  bookcase: 'Storage / bookcase',
  wardrobe: 'Wardrobe',
  dresser: 'Chest of drawers',
  dining_table: 'Dining table',
  dining_chair: 'Dining chairs',
  bar_stool: 'Bar stools',
};

/** Large pieces: replacing them changes the room a lot, so they're kept unless unticked or asked for. */
export const LARGE_SLOTS: Slot[] = ['bed_frame', 'headboard', 'sofa', 'armchair', 'wardrobe', 'dresser', 'bookcase', 'tv_unit', 'dining_table', 'dining_chair', 'bar_stool', 'coffee_table'];

export type VerificationStatus = 'verified_live' | 'catalog_snapshot' | 'verification_required';

export interface Verification {
  status: VerificationStatus;
  /** ISO date or datetime of the last price check (live) or catalog capture (snapshot). */
  checkedAt: string;
  /** When a live check found a different price than the catalog. */
  previousPrice?: number;
  message?: string;
}

export interface Product {
  id: string; // `${retailerId}:${retailerProductId}`
  retailerId: string;
  retailerProductId: string;
  name: string; // brand/series name, e.g. "ÄRENDE"
  nameLocal: string; // full name as shown on the retailer site (may be Hebrew)
  nameEn: string; // English descriptor derived from the retailer's own URL slug
  category: ProductCategory;
  categoryLabel: string;
  price: number;
  currency: Currency;
  url: string;
  imageUrl?: string;
  dimensionsCm?: number[];
  colors: string[];
  materials: string[];
  patterns: string[];
  tags: string[];
  styles: Partial<Record<StyleId, number>>;
  availability: 'unknown' | 'in_stock' | 'out_of_stock';
  country: string;
  description?: string;
  source: { kind: 'dev_dataset' | 'feed' | 'api' | 'live'; method: string; capturedAt: string };
  verification: Verification;
  requires?: { productId: string; quantityPerUnit: number; reason: string }[];
  notes?: string[];
}

export interface RetailerInfo {
  id: string;
  name: string;
  country: string;
  currency: Currency;
  homepage: string;
}

// ---------------- Styles ----------------

export type StyleId =
  | 'warm_luxury'
  | 'warm_minimal'
  | 'modern'
  | 'scandinavian'
  | 'japandi'
  | 'luxury_hotel'
  | 'mediterranean';

// ---------------- Room understanding ----------------

export type KeepKey =
  | 'bed'
  | 'bedding'
  | 'floor'
  | 'walls'
  | 'curtains'
  | 'rug'
  | 'bedside_tables'
  | 'lighting'
  | 'wall_art'
  | 'mirror'
  | 'plants'
  | 'decor'
  | 'sofa'
  | 'armchairs'
  | 'coffee_table'
  | 'storage'
  | 'dining';

export const KEEP_LABELS: Record<KeepKey, string> = {
  bed: 'Bed',
  bedding: 'Bedding',
  floor: 'Floor',
  walls: 'Wall colour',
  curtains: 'Curtains',
  rug: 'Rug',
  bedside_tables: 'Side tables',
  lighting: 'Lighting',
  wall_art: 'Wall art',
  mirror: 'Mirror',
  plants: 'Plants',
  decor: 'Decor',
  sofa: 'Sofa',
  armchairs: 'Armchairs',
  coffee_table: 'Coffee table',
  storage: 'Wardrobes & storage',
  dining: 'Table & chairs',
};

/** Which design slots each "keep" toggle locks. */
export const KEEP_TO_SLOTS: Record<KeepKey, Slot[]> = {
  bed: ['bed_frame', 'headboard'],
  bedding: ['duvet_cover', 'bedspread'],
  floor: [],
  walls: [],
  curtains: ['curtains'],
  rug: ['rug'],
  bedside_tables: ['bedside_table'],
  lighting: ['table_lamp', 'floor_lamp', 'ceiling_light'],
  wall_art: ['wall_art'],
  mirror: ['mirror'],
  plants: ['plant'],
  decor: ['decor'],
  sofa: ['sofa'],
  armchairs: ['armchair'],
  coffee_table: ['coffee_table'],
  storage: ['wardrobe', 'dresser', 'bookcase', 'tv_unit'],
  dining: ['dining_table', 'dining_chair', 'bar_stool'],
};

export interface DetectedElement {
  id: string;
  kind: KeepKey | 'window' | 'door' | 'ceiling' | 'chair' | 'desk' | 'other';
  label: string;
  description: string;
  /** Approximate normalized centre in the photo (0..1), if the model could place it. */
  position?: { x: number; y: number };
}

export interface RoomAnalysis {
  roomType: 'bedroom' | 'living_room' | 'dining_room' | 'kitchen' | 'other';
  summary: string;
  camera: string;
  lighting: string;
  architecture: {
    walls: string;
    floor: string;
    ceiling: string;
    windows: string;
    doors: string;
    fixedFeatures: string[];
  };
  bedSize: 'single' | 'double' | 'queen' | 'king' | 'none' | 'unknown';
  elements: DetectedElement[];
  /** Keep toggles that apply to this room (things that exist) and their suggested default. */
  keepSuggestions: { key: KeepKey; present: boolean; defaultKeep: boolean; note?: string }[];
}

// ---------------- Design ----------------

export type DesignAction = 'new' | 'style' | 'cheaper' | 'warmer' | 'colors' | 'refine';

export interface DesignRequest {
  analysis: RoomAnalysis;
  style: StyleId;
  instructions: string;
  budget: number | null; // null = no limit
  keep: KeepKey[];
  action: DesignAction;
  /** For variations: the previous plan, so the stylist can keep the aesthetic. */
  previous?: { style: StyleId; concept: string; palette: string[]; items: { productId: string; slot: Slot; quantity: number }[]; total: number };
  colorDirection?: string;
}

export interface PlanItem {
  slot: Slot;
  role: string;
  placement: string;
  quantity: number;
  product: Product;
  lineTotal: number;
  /** 0..1: how confident the stylist is in this pick for the brief. */
  confidence: number;
  isAccessory?: boolean;
  accessoryFor?: string;
}

export interface DesignPlan {
  id: string;
  createdAt: string;
  style: StyleId;
  action: DesignAction;
  instructions: string;
  budget: number | null;
  keep: KeepKey[];
  concept: string;
  palette: string[];
  renderNotes: string;
  items: PlanItem[];
  total: number;
  currency: Currency;
  withinBudget: boolean;
  notes: string[];
  catalogCapturedAt: string;
  mode: 'live' | 'demo';
}

export interface Hotspot {
  productId: string;
  x: number; // 0..1
  y: number; // 0..1
  confidence: number; // 0..1
}

export interface RenderResult {
  image: string; // data URL
  model: string;
  mode: 'live' | 'demo';
  referenceImagesUsed: number;
  prompt: string;
  quality?: string;
}
