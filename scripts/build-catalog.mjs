#!/usr/bin/env node
/**
 * Builds the normalized development catalog for IKEA Israel from the raw capture file.
 *
 *   node scripts/build-catalog.mjs [raw.jsonl] [out.json]
 *
 * Raw captures contain ONLY values read verbatim from ikea.com/il/he category pages
 * (name, price, product URL, image URL). Everything else here is *derived* from those
 * values (article number and English descriptor from IKEA's own URL slug, dimensions
 * from the product name, colour/material tags from the slug). Nothing is invented.
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const rawPath = process.argv[2] ?? path.join(root, 'data/raw/ikea-il-2026-09-29.jsonl');
const outPath = process.argv[3] ?? path.join(root, 'src/server/catalog/data/ikea-il.dev.json');
const CAPTURED_AT = '2026-09-29';

// ---- vocabularies (matched against IKEA's English URL slug) ----
const COLOR_WORDS = [
  'off-white', 'light-beige', 'grey-beige', 'dark-grey-beige', 'light-grey', 'dark-grey', 'grey-green', 'dark-grey-green',
  'pale-grey-green', 'grey-brown', 'grey-blue', 'dark-grey-blue', 'blue-grey', 'dark-blue', 'light-blue', 'pale-blue',
  'pale-pink', 'light-pink', 'bright-blue', 'dark-green', 'green-grey', 'beige-yellow', 'brown-red', 'red-brown',
  'yellow-brown', 'light-brown', 'dark-brown', 'light-orange-pink', 'beige-brown', 'beige-grey',
  'white', 'beige', 'grey', 'black', 'anthracite', 'natural', 'unbleached', 'green', 'blue', 'pink', 'brown', 'red',
  'yellow', 'orange', 'multicolour', 'turquoise',
];
const MATERIAL_WORDS = [
  'brass', 'brass-plated', 'nickel-plated', 'chrome-plated', 'chrome', 'aluminium', 'walnut', 'walnut-veneer', 'walnut-effect',
  'oak', 'oak-veneer', 'oak-effect', 'pine', 'birch', 'ash', 'beech', 'bamboo', 'rattan', 'sedge', 'glass', 'opal-white-glass',
  'clear-glass', 'textile', 'paper-pulp', 'moulded-paper-pulp', 'handwoven', 'handmade', 'flatwoven', 'high-pile', 'low-pile',
  'upholstered', 'velvet', 'plastic', 'stainless-steel', 'mother-of-pearl-colour', 'brass-colour',
];
const PATTERN_WORDS = ['check', 'striped', 'stripe', 'dotted', 'floral', 'pattern', 'ornament', 'giraffe', 'grid', 'melange', 'harlequin'];

const CATEGORY_LABELS = {
  rug: 'Rug', duvet_cover: 'Duvet cover set', bedspread: 'Bedspread', throw: 'Throw', cushion_cover: 'Cushion cover',
  cushion: 'Cushion', cushion_pad: 'Inner cushion', bedside_table: 'Bedside table', table_lamp: 'Table lamp',
  floor_lamp: 'Floor lamp', ceiling_light: 'Ceiling light', curtains: 'Curtains', mirror: 'Mirror', wall_art: 'Wall art',
  headboard: 'Headboard', bed_frame: 'Bed frame', plant: 'Artificial plant', decor: 'Decor',
};

// ---- style affinity heuristics (0..1). Only a prior: the AI stylist re-ranks candidates. ----
const STYLE_SIGNALS = {
  warm_luxury: { plus: ['off-white', 'beige', 'light-beige', 'grey-beige', 'natural', 'brass', 'brass-plated', 'brass-colour', 'walnut', 'walnut-veneer', 'walnut-effect', 'oak', 'oak-veneer', 'opal-white-glass', 'high-pile', 'upholstered', 'unbleached', 'mother-of-pearl-colour'], minus: ['multicolour', 'pattern', 'floral', 'check', 'dotted', 'giraffe', 'plastic', 'bright-blue', 'orange'] },
  warm_minimal: { plus: ['off-white', 'beige', 'light-beige', 'natural', 'unbleached', 'oak', 'oak-veneer', 'ash', 'white', 'grey-beige', 'paper-pulp', 'moulded-paper-pulp', 'flatwoven', 'low-pile'], minus: ['multicolour', 'pattern', 'floral', 'dotted', 'giraffe', 'bright-blue', 'chrome-plated'] },
  scandinavian: { plus: ['white', 'light-grey', 'grey', 'birch', 'pine', 'ash', 'oak', 'beech', 'natural', 'off-white', 'light-blue', 'grey-green', 'check'], minus: ['brass', 'velvet', 'multicolour', 'giraffe'] },
  japandi: { plus: ['natural', 'unbleached', 'bamboo', 'rattan', 'sedge', 'oak', 'ash', 'black', 'anthracite', 'beige', 'dark-grey', 'grey-green', 'paper-pulp', 'moulded-paper-pulp', 'handmade', 'flatwoven', 'walnut'], minus: ['multicolour', 'floral', 'pink', 'bright-blue', 'chrome-plated', 'giraffe'] },
  luxury_hotel: { plus: ['white', 'off-white', 'light-grey', 'grey', 'brass', 'brass-plated', 'nickel-plated', 'chrome-plated', 'opal-white-glass', 'glass', 'walnut', 'walnut-veneer', 'black', 'dark-blue', 'upholstered', 'high-pile', 'dark-grey'], minus: ['multicolour', 'floral', 'giraffe', 'pine', 'plastic', 'check'] },
  modern: { plus: ['black', 'white', 'grey', 'anthracite', 'dark-grey', 'chrome-plated', 'nickel-plated', 'glass', 'light-grey', 'stainless-steel'], minus: ['floral', 'rattan', 'pine', 'giraffe', 'check'] },
  mediterranean: { plus: ['natural', 'unbleached', 'rattan', 'sedge', 'bamboo', 'white', 'off-white', 'blue', 'dark-blue', 'light-blue', 'grey-green', 'orange', 'light-orange-pink', 'handwoven', 'flatwoven', 'handmade', 'beige'], minus: ['chrome-plated', 'plastic', 'anthracite'] },
};

function swedishToSlug(s) {
  return s.toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/å/g, 'a').replace(/é/g, 'e').replace(/ü/g, 'ue')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function parseRecord(r) {
  const m = r.url.match(/\/p\/([a-z0-9-]+)-(s?\d{8})\/?$/);
  if (!m) throw new Error(`Cannot parse article from ${r.url}`);
  const [, slugBody, article] = m;

  // Swedish product name = the Latin-script prefix before the Hebrew text (e.g. "ÄRENDE", "STOCKHOLM 2025", "KAPPELAND / HAVSDJUP")
  const nameMatch = r.name.match(/^([A-ZÅÄÖÉÜ0-9][A-ZÅÄÖÉÜ0-9 /.\-]*?)\s+(?=[֐-׿])/);
  const brandName = (nameMatch ? nameMatch[1] : r.name.split(' ')[0]).trim();
  const brandSlug = swedishToSlug(brandName);
  let descriptorSlug = slugBody.startsWith(brandSlug + '-') ? slugBody.slice(brandSlug.length + 1) : slugBody;

  const words = descriptorSlug.split('-');
  // Greedy longest-first matching of multi-word terms over the slug tokens, so that
  // "off-white" is one colour (not "off-white" + "white").
  const extract = (vocab) => {
    const sorted = [...vocab].sort((a, b) => b.split('-').length - a.split('-').length);
    const used = new Array(words.length).fill(false);
    const found = [];
    for (const term of sorted) {
      const t = term.split('-');
      for (let i = 0; i + t.length <= words.length; i++) {
        if (t.every((w, j) => words[i + j] === w && !used[i + j])) {
          t.forEach((_, j) => (used[i + j] = true));
          if (!found.includes(term)) found.push(term);
        }
      }
    }
    return found;
  };
  const colorsClean = extract(COLOR_WORDS);
  const materials = extract(MATERIAL_WORDS);
  const has = (w) => colorsClean.includes(w) || materials.includes(w);
  const patterns = PATTERN_WORDS.filter((p) => words.includes(p));

  const dims = [...r.name.matchAll(/(\d{2,3})x(\d{2,3})(?:x(\d{2,3}))?/g)][0];
  const single = r.name.match(/,\s*(\d{2,3})\s*ס"מ/);
  const dimensionsCm = dims ? dims.slice(1).filter(Boolean).map(Number) : single ? [Number(single[1])] : undefined;

  const descriptorEn = descriptorSlug.replace(/-/g, ' ');
  const sizeText = dimensionsCm ? `, ${dimensionsCm.join('×')} cm` : '';
  const nameEn = `${brandName} ${descriptorEn}${sizeText}`;

  const allTags = new Set([...colorsClean, ...materials, ...patterns, ...words.filter((w) => w.length > 2)]);
  const styles = {};
  for (const [style, { plus, minus }] of Object.entries(STYLE_SIGNALS)) {
    let s = 0.35;
    for (const t of allTags) {
      if (plus.includes(t)) s += 0.18;
      if (minus.includes(t)) s -= 0.25;
    }
    styles[style] = Math.max(0, Math.min(1, Number(s.toFixed(2))));
  }

  const notes = [];
  if (/נורה נמכרת בנפרד|נורות נמכרות בנפרד|הנורה נמכרת בנפרד/.test(r.desc ?? '') || ['table_lamp', 'floor_lamp', 'ceiling_light'].includes(r.cat)) {
    notes.push('Light bulb may be sold separately — check the product page.');
  }
  if (r.cat === 'curtains') notes.push('Curtain rod/rail sold separately.');
  if (r.cat === 'bed_frame') notes.push('Mattress and bedding sold separately.');

  return {
    id: `ikea-il:${article}`,
    retailerId: 'ikea-il',
    retailerProductId: article,
    name: brandName,
    nameLocal: r.name.replace(/[‎‏]/g, '').trim(),
    nameEn,
    category: r.cat,
    categoryLabel: CATEGORY_LABELS[r.cat] ?? r.cat,
    price: r.price,
    currency: 'ILS',
    url: r.url,
    imageUrl: r.img,
    dimensionsCm,
    colors: colorsClean,
    materials,
    patterns,
    tags: [...allTags],
    styles,
    availability: 'unknown',
    country: 'IL',
    source: { kind: 'dev_dataset', method: 'category-page capture (ikea.com/il/he)', capturedAt: CAPTURED_AT },
    verification: { status: 'catalog_snapshot', checkedAt: CAPTURED_AT },
    requires: r.cat === 'cushion_cover' ? [{ productId: 'ikea-il:50550702', quantityPerUnit: 1, reason: 'Inner cushion sold separately' }] : undefined,
    notes: notes.length ? notes : undefined,
  };
}

const lines = fs.readFileSync(rawPath, 'utf8').split('\n').filter(Boolean);
const seen = new Set();
const products = [];
for (const line of lines) {
  const p = parseRecord(JSON.parse(line));
  if (seen.has(p.id)) continue;
  seen.add(p.id);
  products.push(p);
}

const out = {
  retailerId: 'ikea-il',
  datasetKind: 'DEVELOPMENT DATASET',
  notice:
    'Development dataset: real IKEA Israel products captured from public category pages on ' + CAPTURED_AT +
    '. Prices may have changed; the app re-checks prices live when possible and otherwise labels them as catalog snapshots.',
  capturedAt: CAPTURED_AT,
  count: products.length,
  products,
};
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(out, null, 1));
const byCat = products.reduce((a, p) => ((a[p.category] = (a[p.category] ?? 0) + 1), a), {});
console.log(`Wrote ${products.length} products → ${path.relative(root, outPath)}`);
console.log(byCat);
