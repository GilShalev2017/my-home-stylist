'use client';

import { createStore, del, get, keys, set, values } from 'idb-keyval';
import type { DesignPlan, Hotspot, KeepKey, Product, RoomAnalysis, StyleId } from '@/lib/domain';

/**
 * Client-side persistence (MVP): rooms, designs and saved products live in the browser's
 * IndexedDB. The server is stateless. The Postgres schema in db/schema.sql is the target
 * once accounts are added.
 */
export interface RoomRecord {
  id: string;
  createdAt: string;
  image: string; // data URL (downscaled original)
  width: number;
  height: number;
  analysis: RoomAnalysis;
}

export type DesignStatus = 'planning' | 'rendering' | 'ready' | 'error';

export interface DesignRecord {
  id: string;
  roomId: string;
  createdAt: string;
  label: string; // e.g. "Warm Luxury", "Cheaper", "Japandi"
  style: StyleId;
  budget: number | null;
  keep: KeepKey[];
  instructions: string;
  status: DesignStatus;
  error?: string;
  note?: string;
  plan?: DesignPlan;
  image?: string;
  hotspots?: Hotspot[];
  renderModel?: string;
  referenceImagesUsed?: number;
}

export interface Profile {
  defaultBudget: number | null;
  favoriteStyle: StyleId;
}

const isBrowser = typeof indexedDB !== 'undefined';
const rooms = isBrowser ? createStore('mhs-rooms', 'rooms') : undefined;
const designs = isBrowser ? createStore('mhs-designs', 'designs') : undefined;
const saved = isBrowser ? createStore('mhs-saved', 'products') : undefined;

export const store = {
  saveRoom: (r: RoomRecord) => set(r.id, r, rooms),
  getRoom: (id: string) => get<RoomRecord>(id, rooms),
  saveDesign: (d: DesignRecord) => set(d.id, d, designs),
  getDesign: (id: string) => get<DesignRecord>(id, designs),
  deleteDesign: (id: string) => del(id, designs),
  async listDesigns(): Promise<DesignRecord[]> {
    const all = (await values<DesignRecord>(designs)) ?? [];
    return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  async designsForRoom(roomId: string) {
    return (await this.listDesigns()).filter((d) => d.roomId === roomId).reverse();
  },
  saveProduct: (p: Product) => set(p.id, { ...p, savedAt: new Date().toISOString() }, saved),
  unsaveProduct: (id: string) => del(id, saved),
  async isSaved(id: string) {
    return (await get(id, saved)) != null;
  },
  async savedProducts(): Promise<(Product & { savedAt: string })[]> {
    const all = ((await values(saved)) ?? []) as (Product & { savedAt: string })[];
    return all.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  },
  savedIds: async () => new Set(((await keys(saved)) ?? []) as string[]),
};

const PROFILE_KEY = 'mhs.profile';
export function loadProfile(): Profile {
  try {
    const p = JSON.parse(localStorage.getItem(PROFILE_KEY) ?? 'null');
    if (p) return p;
  } catch {}
  return { defaultBudget: 5000, favoriteStyle: 'warm_luxury' };
}
export function saveProfile(p: Profile) {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
  } catch {}
}

export function uid() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2);
}
