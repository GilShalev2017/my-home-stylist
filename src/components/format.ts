import type { Product, Verification } from '@/lib/domain';

export function ils(n: number) {
  return `₪${Math.round(n).toLocaleString('en-US')}`;
}

export function fmtDate(iso: string) {
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function verificationText(v: Verification): { text: string; tone: 'ok' | 'muted' | 'warn' } {
  if (v.status === 'verified_live') {
    const t = new Date(v.checkedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    return { text: `Live IKEA price · checked ${t}`, tone: 'ok' };
  }
  if (v.status === 'catalog_snapshot') return { text: `Catalog price · ${fmtDate(v.checkedAt)}`, tone: 'muted' };
  return { text: 'Product verification required', tone: 'warn' };
}

export function productImage(p: Product, size: 'xs' | 's' | 'm' = 's') {
  return p.imageUrl ? `${p.imageUrl.split('?')[0]}?f=${size}` : undefined;
}

/** "rug high pile off white, 200×300 cm" → "Rug, high pile, off white · 200×300 cm" */
export function descriptor(p: Product) {
  const rest = p.nameEn.slice(p.name.length).trim();
  const [desc, size] = rest.split(/,\s*(?=\d)/);
  const d = desc.charAt(0).toUpperCase() + desc.slice(1);
  return size ? `${d} · ${size}` : d;
}
