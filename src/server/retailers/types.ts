import type { Product, ProductCategory, RetailerInfo, Verification } from '@/lib/domain';

export interface ProductFilter {
  categories?: ProductCategory[];
  maxPrice?: number;
  minPrice?: number;
}

export interface SearchQuery extends ProductFilter {
  text?: string;
  colors?: string[];
  materials?: string[];
  limit?: number;
}

export interface PriceInfo {
  productId: string;
  price: number;
  currency: Product['currency'];
  verification: Verification;
}

export interface AvailabilityInfo {
  productId: string;
  availability: Product['availability'];
  checkedAt: string;
}

/**
 * Every retailer (IKEA Israel, Zara Home, FOX Home, …) implements this interface.
 * The design engine only ever talks to retailers through it.
 */
export interface RetailerAdapter {
  readonly info: RetailerInfo;
  getProducts(filter?: ProductFilter): Promise<Product[]>;
  getProduct(productId: string): Promise<Product | null>;
  searchProducts(query: SearchQuery): Promise<Product[]>;
  /** Current price. Implementations should try a live check and fall back to the catalog snapshot. */
  getPrice(productId: string): Promise<PriceInfo | null>;
  getAvailability(productId: string): Promise<AvailabilityInfo | null>;
  getProductUrl(productId: string): string | null;
}

/**
 * Where a retailer's catalog comes from. Swappable: a bundled JSON dataset (MVP), an approved
 * product feed / API export, or a database table.
 */
export interface CatalogSource {
  readonly description: string;
  readonly capturedAt: string;
  load(): Promise<Product[]>;
}
