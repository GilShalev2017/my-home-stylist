import type { Slot } from '@/lib/domain';

/**
 * Understand what the client explicitly asked for in the free-text box, so a request like
 * "use IKEA closets" turns into real catalog slots instead of being silently ignored.
 * Deterministic keyword rules (English + Hebrew) — fast, free and testable.
 */
interface Rule {
  slots: Slot[];
  patterns: RegExp[];
}

const RULES: Rule[] = [
  { slots: ['sofa'], patterns: [/\bsofas?\b/i, /\bcouch(es)?\b/i, /\bsettee\b/i, /ספה|ספות/] },
  { slots: ['armchair'], patterns: [/\barm ?chairs?\b/i, /\baccent chairs?\b/i, /\breading chair\b/i, /כורס/] },
  { slots: ['coffee_table'], patterns: [/\bcoffee tables?\b/i, /\bliving[- ]room table\b/i, /שולחן (קפה|סלון)/] },
  { slots: ['tv_unit'], patterns: [/\btv\b/i, /\bmedia (unit|console|storage)\b/i, /\btv (bench|stand|unit)\b/i, /טלוויזיה|מזנון/] },
  { slots: ['wardrobe'], patterns: [/\bwardrobes?\b/i, /\bclosets?\b/i, /\bcupboards?\b/i, /\barmoires?\b/i, /(?:^|[\s,.])(?:ארון|ארונות|ארונים)(?=[\s,.!?]|$)(?!\s*(?:מטבח|ספרים))/] },
  { slots: ['dresser'], patterns: [/\bdressers?\b/i, /\bchests? of drawers\b/i, /\bdrawers?\b/i, /\bsideboards?\b/i, /שיד(ה|ת) מגירות|שידה(?! ל?לילה)/] },
  { slots: ['bookcase'], patterns: [/\bbook ?cases?\b/i, /\bbook ?shel(f|ves)\b/i, /\bshelving\b/i, /\bshelves\b/i, /\bstorage (unit|furniture)\b/i, /ספרי(יה|ות)|כוננית|מדפים|ארון ספרים/] },
  { slots: ['dining_table', 'dining_chair'], patterns: [/\bdining (table|set|area)\b/i, /\bkitchen table\b/i, /\btable and chairs\b/i, /פינת אוכל|שולחן אוכל|שולחן מטבח/] },
  { slots: ['dining_chair'], patterns: [/\bdining chairs?\b/i, /\bkitchen chairs?\b/i, /כיסאות אוכל|כסאות אוכל/] },
  { slots: ['bar_stool'], patterns: [/\bbar ?stools?\b/i, /\bcounter stools?\b/i, /\bstools?\b/i, /כיסאות בר|כסאות בר|שרפרפ/] },
  { slots: ['bed_frame'], patterns: [/\bnew bed\b/i, /\bbed ?frame\b/i, /\breplace (the|my) bed\b/i, /מיטה חדשה|מסגרת מיטה/] },
  { slots: ['headboard'], patterns: [/\bheadboard\b/i, /ראש מיטה/] },
  { slots: ['rug'], patterns: [/\brugs?\b/i, /\bcarpet\b/i, /שטיח/] },
  { slots: ['curtains'], patterns: [/\bcurtains?\b/i, /\bdrapes\b/i, /וילונ/] },
  { slots: ['mirror'], patterns: [/\bmirrors?\b/i, /מרא(ה|ות)/] },
  { slots: ['floor_lamp'], patterns: [/\bfloor lamps?\b/i, /מנורה עומדת/] },
  { slots: ['ceiling_light'], patterns: [/\bpendant\b/i, /\bceiling (light|lamp)\b/i, /\bchandelier\b/i, /מנורת (תקרה|תלייה)|נברשת/] },
  { slots: ['wall_art'], patterns: [/\bartwork\b/i, /\bwall art\b/i, /\bpictures?\b/i, /\bposters?\b/i, /תמונ/] },
  { slots: ['plant'], patterns: [/\bplants?\b/i, /צמח|עציץ/] },
];

/** Things people ask for that the catalog deliberately doesn't cover (with an honest explanation). */
const UNSUPPORTED: { label: string; patterns: RegExp[]; note: string; fallback?: Slot[] }[] = [
  {
    label: 'kitchen cabinets',
    patterns: [/\bkitchen (cabinets?|closets?|cupboards?|units?)\b/i, /ארונות מטבח|ארון מטבח|מטבח חדש/],
    note: "Fitted kitchen cabinets (IKEA METOD) are made to measure, so they aren't in the catalog. Freestanding storage was used instead.",
    fallback: ['bookcase'],
  },
  {
    label: 'paint / flooring',
    patterns: [/\bparquet\b/i, /\bnew floor(ing)?\b/i, /\bpaint the walls\b/i, /פרקט|צבע(ו)? את הקירות/],
    note: 'Paint and flooring aren’t IKEA products; they may be shown in the image but aren’t in the shopping list.',
  },
];

// Negations like "don't change the sofa" / "keep my wardrobe" must not trigger a request.
const NEGATION = /\b(don'?t|do not|never|no|keep|without|leave)\b[^.,;!?]{0,30}$|(אל ת|לא ל|בלי|השאר|תשאיר)[^.,;!?]{0,20}$/i;

export interface ParsedRequests {
  slots: Slot[];
  notes: string[];
}

export function parseRequestedSlots(text: string): ParsedRequests {
  const slots = new Set<Slot>();
  const notes: string[] = [];
  if (!text?.trim()) return { slots: [], notes };

  const mentioned = (re: RegExp) => {
    const flags = re.flags.includes('g') ? re.flags : re.flags + 'g';
    for (const m of text.matchAll(new RegExp(re.source, flags))) {
      const before = text.slice(Math.max(0, (m.index ?? 0) - 40), m.index ?? 0);
      if (!NEGATION.test(before)) return true;
    }
    return false;
  };

  const covered: string[] = [];
  for (const u of UNSUPPORTED) {
    if (u.patterns.some(mentioned)) {
      notes.push(u.note);
      u.fallback?.forEach((s) => slots.add(s));
      covered.push(u.label);
    }
  }
  const kitchenCabinets = covered.includes('kitchen cabinets');
  for (const r of RULES) {
    // "kitchen cabinets/closets" was handled above — don't also read it as a wardrobe request.
    if (kitchenCabinets && r.slots.includes('wardrobe')) continue;
    if (r.patterns.some(mentioned)) r.slots.forEach((s) => slots.add(s));
  }
  return { slots: [...slots], notes };
}
