import type { Product, RetailerInfo } from '@/lib/domain';
import { CatalogRetailerAdapter } from './catalog-adapter';

/**
 * IKEA Israel (ikea.com/il/he — ikea.co.il redirects there).
 * MVP catalog: bundled development dataset of real products captured from public category pages.
 * Live checks read the product page's schema.org JSON-LD for the current price.
 */
export class IkeaIsraelAdapter extends CatalogRetailerAdapter {
  readonly info: RetailerInfo = {
    id: 'ikea-il',
    name: 'IKEA',
    country: 'IL',
    currency: 'ILS',
    homepage: 'https://www.ikea.com/il/he/',
  };

  protected async fetchProductPage(product: Product, signal: AbortSignal): Promise<string | null> {
    if (process.env.DISABLE_LIVE_PRICE_CHECK === '1') return null;
    const res = await fetch(product.url, {
      signal,
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; MyHomeStylist/0.1; price-check)',
        accept: 'text/html',
        'accept-language': 'he-IL,he;q=0.9,en;q=0.8',
      },
      redirect: 'follow',
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return res.text();
  }

  /** IKEA image URLs accept a size parameter (?f=xxs … xl). */
  static imageUrl(product: Product, size: 'xs' | 's' | 'm' | 'l' = 's'): string | undefined {
    if (!product.imageUrl) return undefined;
    const base = product.imageUrl.split('?')[0];
    return `${base}?f=${size}`;
  }
}
