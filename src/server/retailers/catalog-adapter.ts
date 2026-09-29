import type { Product, RetailerInfo } from '@/lib/domain';
import type { AvailabilityInfo, CatalogSource, PriceInfo, ProductFilter, RetailerAdapter, SearchQuery } from './types';
import { parseProductJsonLd } from './jsonld';

interface LiveCheck {
  price: number;
  availability: Product['availability'];
  checkedAt: string;
}

const LIVE_CACHE_MS = 6 * 60 * 60 * 1000;

/**
 * Generic adapter for any retailer whose catalog comes from a CatalogSource and whose product
 * pages publish schema.org JSON-LD. Retailer-specific adapters extend this and only override
 * what differs (info, URLs, image sizing, request headers).
 */
export abstract class CatalogRetailerAdapter implements RetailerAdapter {
  abstract readonly info: RetailerInfo;
  private products: Product[] | null = null;
  private liveCache = new Map<string, { at: number; value: LiveCheck | null }>();

  constructor(protected readonly source: CatalogSource) {}

  protected async all(): Promise<Product[]> {
    if (!this.products) this.products = await this.source.load();
    return this.products;
  }

  get catalogCapturedAt() {
    return this.source.capturedAt;
  }

  async getProducts(filter?: ProductFilter): Promise<Product[]> {
    const all = await this.all();
    return all.filter(
      (p) =>
        (!filter?.categories || filter.categories.includes(p.category)) &&
        (filter?.maxPrice == null || p.price <= filter.maxPrice) &&
        (filter?.minPrice == null || p.price >= filter.minPrice),
    );
  }

  async getProduct(productId: string): Promise<Product | null> {
    return (await this.all()).find((p) => p.id === productId) ?? null;
  }

  async searchProducts(q: SearchQuery): Promise<Product[]> {
    const base = await this.getProducts(q);
    const terms = (q.text ?? '').toLowerCase().split(/[^a-z0-9-]+/).filter((t) => t.length > 2);
    const scored = base.map((p) => {
      let s = 0;
      for (const t of terms) if (p.tags.includes(t) || p.nameEn.toLowerCase().includes(t)) s += 1;
      for (const c of q.colors ?? []) if (p.colors.includes(c)) s += 2;
      for (const m of q.materials ?? []) if (p.materials.includes(m)) s += 2;
      return { p, s };
    });
    scored.sort((a, b) => b.s - a.s || a.p.price - b.p.price);
    return scored.slice(0, q.limit ?? 50).map((x) => x.p);
  }

  getProductUrl(productId: string): string | null {
    return this.products?.find((p) => p.id === productId)?.url ?? null;
  }

  /** Retailer-specific fetch of the product page HTML. Return null when not reachable. */
  protected abstract fetchProductPage(product: Product, signal: AbortSignal): Promise<string | null>;

  async liveCheck(product: Product, timeoutMs = 4000): Promise<LiveCheck | null> {
    const cached = this.liveCache.get(product.id);
    if (cached && Date.now() - cached.at < LIVE_CACHE_MS) return cached.value;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    let value: LiveCheck | null = null;
    try {
      const html = await this.fetchProductPage(product, ctrl.signal);
      const offer = html ? parseProductJsonLd(html) : null;
      if (offer) value = { price: offer.price, availability: offer.availability ?? 'unknown', checkedAt: new Date().toISOString() };
    } catch {
      value = null;
    } finally {
      clearTimeout(timer);
    }
    this.liveCache.set(product.id, { at: Date.now(), value });
    return value;
  }

  async getPrice(productId: string): Promise<PriceInfo | null> {
    const product = await this.getProduct(productId);
    if (!product) return null;
    const live = await this.liveCheck(product);
    if (live) {
      return {
        productId,
        price: live.price,
        currency: product.currency,
        verification: {
          status: 'verified_live',
          checkedAt: live.checkedAt,
          previousPrice: live.price !== product.price ? product.price : undefined,
        },
      };
    }
    return { productId, price: product.price, currency: product.currency, verification: product.verification };
  }

  async getAvailability(productId: string): Promise<AvailabilityInfo | null> {
    const product = await this.getProduct(productId);
    if (!product) return null;
    const live = await this.liveCheck(product);
    return { productId, availability: live?.availability ?? 'unknown', checkedAt: live?.checkedAt ?? product.source.capturedAt };
  }
}
