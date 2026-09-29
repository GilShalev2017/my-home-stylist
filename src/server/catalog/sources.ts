import type { Product } from '@/lib/domain';
import type { CatalogSource } from '@/server/retailers/types';

interface CatalogFile {
  retailerId: string;
  datasetKind: string;
  capturedAt: string;
  products: Product[];
}

/** Catalog loaded from a JSON document (bundled dev dataset, or an approved feed export). */
export class JsonCatalogSource implements CatalogSource {
  readonly description: string;
  readonly capturedAt: string;
  private readonly file: CatalogFile;

  constructor(file: CatalogFile) {
    this.file = file;
    this.capturedAt = file.capturedAt;
    this.description = `${file.datasetKind} (${file.products.length} products, captured ${file.capturedAt})`;
  }

  async load(): Promise<Product[]> {
    return this.file.products;
  }
}

/**
 * Placeholder for a future approved feed/API (e.g. an affiliate or partner product feed).
 * Implement `load()` to fetch and normalize into `Product` — nothing else in the app changes.
 */
export class FeedCatalogSource implements CatalogSource {
  readonly description = 'Approved retailer feed (not configured)';
  readonly capturedAt = '';
  constructor(private readonly feedUrl: string) {}
  async load(): Promise<Product[]> {
    throw new Error(`FeedCatalogSource not implemented yet (feed: ${this.feedUrl})`);
  }
}
