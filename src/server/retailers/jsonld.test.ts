import { describe, expect, it } from 'vitest';
import { parseProductJsonLd } from './jsonld';

// Synthetic fixtures in the schema.org shape (not copies of a real page).
const wrap = (o: unknown) => `<html><head><script type="application/ld+json">${JSON.stringify(o)}</script></head></html>`;

describe('parseProductJsonLd', () => {
  it('reads a simple Offer', () => {
    const r = parseProductJsonLd(wrap({ '@context': 'https://schema.org', '@type': 'Product', name: 'X', offers: { '@type': 'Offer', price: '495', priceCurrency: 'ILS', availability: 'https://schema.org/InStock' } }));
    expect(r).toMatchObject({ price: 495, currency: 'ILS', availability: 'in_stock' });
  });
  it('uses the nested current Offer of an AggregateOffer, not highPrice', () => {
    const r = parseProductJsonLd(wrap({ '@type': 'Product', offers: { '@type': 'AggregateOffer', highPrice: 600, lowPrice: 450, offers: [{ '@type': 'Offer', price: 450 }] } }));
    expect(r?.price).toBe(450);
  });
  it('finds products inside @graph and ignores other blocks', () => {
    const html = `<script type="application/ld+json">{bad json</script>` + wrap({ '@graph': [{ '@type': 'BreadcrumbList' }, { '@type': 'Product', offers: [{ price: 129 }] }] });
    expect(parseProductJsonLd(html)?.price).toBe(129);
  });
  it('returns null when there is no product', () => {
    expect(parseProductJsonLd('<html></html>')).toBeNull();
  });
});
