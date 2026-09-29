#!/usr/bin/env node
/**
 * Re-checks every product in the dev catalog against its live IKEA Israel product page
 * (schema.org JSON-LD) and updates price + verification date. Run from a machine that can
 * reach ikea.com:   npm run catalog:refresh
 * Products whose page can't be read keep their snapshot price and are reported.
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const file = path.join(root, 'src/server/catalog/data/ikea-il.dev.json');
const catalog = JSON.parse(fs.readFileSync(file, 'utf8'));

function parsePrice(html) {
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    let data;
    try { data = JSON.parse(m[1].trim()); } catch { continue; }
    const nodes = [data].flat().flatMap((n) => (n && n['@graph'] ? n['@graph'] : [n]));
    for (const n of nodes) {
      if (!n || (n['@type'] !== 'Product' && !(Array.isArray(n['@type']) && n['@type'].includes('Product')))) continue;
      let o = Array.isArray(n.offers) ? n.offers[0] : n.offers;
      if (o?.['@type'] === 'AggregateOffer') o = Array.isArray(o.offers) ? o.offers[0] : o.offers ?? { price: o.lowPrice };
      const price = Number(String(o?.price ?? '').replace(/[^\d.]/g, ''));
      if (price > 0) return price;
    }
  }
  return null;
}

const today = new Date().toISOString().slice(0, 10);
let updated = 0, changed = 0;
const failed = [];
for (const p of catalog.products) {
  try {
    const res = await fetch(p.url, { headers: { 'user-agent': 'Mozilla/5.0', 'accept-language': 'he-IL,he;q=0.9' } });
    const price = res.ok ? parsePrice(await res.text()) : null;
    if (price == null) { failed.push(p.id); continue; }
    if (price !== p.price) { console.log(`${p.id} ${p.name}: ₪${p.price} → ₪${price}`); changed++; }
    p.price = price;
    p.verification = { status: 'catalog_snapshot', checkedAt: today };
    updated++;
  } catch { failed.push(p.id); }
  await new Promise((r) => setTimeout(r, 400)); // be polite
}
catalog.capturedAt = today;
fs.writeFileSync(file, JSON.stringify(catalog, null, 1));
console.log(`Checked ${updated}/${catalog.products.length}; ${changed} price changes; ${failed.length} not readable${failed.length ? ': ' + failed.join(', ') : ''}`);
