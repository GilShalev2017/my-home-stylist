/**
 * Extracts price/availability from a product page's schema.org JSON-LD.
 * Used for live price verification of the products the stylist selected.
 */
export interface JsonLdOffer {
  price: number;
  currency?: string;
  availability?: 'in_stock' | 'out_of_stock' | 'unknown';
  name?: string;
  image?: string;
}

function toNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v.replace(/[^\d.]/g, ''));
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  return null;
}

function mapAvailability(v: unknown): JsonLdOffer['availability'] {
  if (typeof v !== 'string') return 'unknown';
  if (/InStock|LimitedAvailability|OnlineOnly/i.test(v)) return 'in_stock';
  if (/OutOfStock|SoldOut|Discontinued/i.test(v)) return 'out_of_stock';
  return 'unknown';
}

function* walk(node: unknown): Generator<Record<string, unknown>> {
  if (Array.isArray(node)) for (const n of node) yield* walk(n);
  else if (node && typeof node === 'object') {
    const obj = node as Record<string, unknown>;
    yield obj;
    if (obj['@graph']) yield* walk(obj['@graph']);
  }
}

export function parseProductJsonLd(html: string): JsonLdOffer | null {
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    let data: unknown;
    try {
      data = JSON.parse(m[1].trim());
    } catch {
      continue;
    }
    for (const obj of walk(data)) {
      const type = obj['@type'];
      const isProduct = type === 'Product' || (Array.isArray(type) && type.includes('Product'));
      if (!isProduct) continue;
      let offers = obj['offers'] as unknown;
      if (Array.isArray(offers)) offers = offers[0];
      if (!offers || typeof offers !== 'object') continue;
      let offer = offers as Record<string, unknown>;
      // Discounted products: AggregateOffer whose nested Offer holds the *current* price
      // (highPrice is the pre-sale figure and must not be used).
      if (offer['@type'] === 'AggregateOffer') {
        const nested = offer['offers'];
        const first = Array.isArray(nested) ? nested[0] : nested;
        if (first && typeof first === 'object') offer = first as Record<string, unknown>;
        else if (offer['lowPrice'] != null) offer = { ...offer, price: offer['lowPrice'] };
      }
      const price = toNumber(offer['price']);
      if (price == null) continue;
      const image = Array.isArray(obj['image']) ? (obj['image'][0] as string) : (obj['image'] as string | undefined);
      return {
        price,
        currency: typeof offer['priceCurrency'] === 'string' ? (offer['priceCurrency'] as string) : undefined,
        availability: mapAvailability(offer['availability']),
        name: typeof obj['name'] === 'string' ? (obj['name'] as string) : undefined,
        image: typeof image === 'string' ? image : undefined,
      };
    }
  }
  return null;
}
