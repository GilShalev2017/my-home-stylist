import type { Product } from '@/lib/domain';
import ikeaIlCatalog from '@/server/catalog/data/ikea-il.dev.json';
import { JsonCatalogSource } from '@/server/catalog/sources';
import { CatalogRetailerAdapter } from './catalog-adapter';
import { IkeaIsraelAdapter } from './ikea-israel';

/**
 * Retailer registry. To add Zara Home / FOX Home / ACE later:
 *   1. implement an adapter (extend CatalogRetailerAdapter or implement RetailerAdapter),
 *   2. register it here,
 *   3. list its id in ENABLED_RETAILERS.
 */
type Factory = () => CatalogRetailerAdapter;

const FACTORIES: Record<string, Factory> = {
  'ikea-il': () => new IkeaIsraelAdapter(new JsonCatalogSource(ikeaIlCatalog as never)),
};

let instances: Map<string, CatalogRetailerAdapter> | null = null;

export function getRetailers(): CatalogRetailerAdapter[] {
  if (!instances) {
    const enabled = (process.env.ENABLED_RETAILERS ?? 'ikea-il').split(',').map((s) => s.trim()).filter(Boolean);
    instances = new Map(enabled.filter((id) => FACTORIES[id]).map((id) => [id, FACTORIES[id]()]));
  }
  return [...instances.values()];
}

export function getRetailer(id: string): CatalogRetailerAdapter | undefined {
  getRetailers();
  return instances!.get(id);
}

export async function getAllProducts(): Promise<Product[]> {
  const lists = await Promise.all(getRetailers().map((r) => r.getProducts()));
  return lists.flat();
}

export async function getProductById(id: string): Promise<Product | null> {
  const retailer = getRetailer(id.split(':')[0]);
  return retailer ? retailer.getProduct(id) : null;
}

export function catalogCapturedAt(): string {
  return getRetailers().map((r) => r.catalogCapturedAt).sort()[0] ?? '';
}
