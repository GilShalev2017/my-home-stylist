import type { DesignAction, Hotspot, KeepKey, RoomAnalysis, Slot, StyleId } from '@/lib/domain';

/**
 * Provider abstraction: the app depends on these capabilities, never on a specific vendor.
 *   RoomAnalyzer   — image understanding     (today: Claude)
 *   Stylist        — text reasoning/ranking  (today: Claude)
 *   ProductLocator — image understanding     (today: Claude)
 *   ImageEditor    — image generation/edit   (today: OpenAI GPT Image)
 *   Embedder       — see server/retrieval    (not configured in the MVP)
 */
export interface ImageInput {
  base64: string;
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp';
}

export interface CandidateSummary {
  id: string;
  name: string;
  description: string;
  price: number;
  colors: string[];
  materials: string[];
  dimensionsCm?: number[];
  /** Retrieval prior 0..1 (not shown to the LLM; used by the demo stylist). */
  prior?: number;
}

export interface StylistInput {
  analysis: RoomAnalysis;
  style: StyleId;
  styleBrief: string;
  instructions: string;
  budget: number | null;
  keep: KeepKey[];
  action: DesignAction;
  colorDirection?: string;
  previous?: { concept: string; palette: string[]; items: { productId: string; slot: Slot; quantity: number; price: number }[]; total: number };
  slots: { slot: Slot; label: string; candidates: CandidateSummary[] }[];
}

export interface StylistBrief {
  concept: string;
  palette: string[];
  renderNotes: string;
  slots: {
    slot: Slot;
    include: boolean;
    priority: 1 | 2 | 3;
    quantity: number;
    placement: string;
    ratings: { productId: string; score: number }[];
  }[];
}

export interface RoomAnalyzer {
  analyzeRoom(image: ImageInput): Promise<RoomAnalysis>;
}

export interface Stylist {
  createBrief(input: StylistInput): Promise<StylistBrief>;
}

export interface ProductLocator {
  locate(image: ImageInput, items: { productId: string; label: string; description: string }[]): Promise<Hotspot[]>;
}

export interface EditRequest {
  room: ImageInput;
  size: '1024x1024' | '1536x1024' | '1024x1536';
  references: { label: string; image: ImageInput }[];
  prompt: string;
}

export interface ImageEditor {
  readonly model: string;
  editRoom(req: EditRequest): Promise<{ base64: string; mediaType: ImageInput['mediaType'] }>;
}

export interface AIProviders {
  mode: 'live' | 'demo';
  analyzer: RoomAnalyzer;
  stylist: Stylist;
  locator: ProductLocator;
  editor: ImageEditor;
  status: { analyzer: string; stylist: string; editor: string; missing: string[] };
}
