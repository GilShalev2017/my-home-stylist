import type { StyleId } from './domain';

export interface StyleDef {
  id: StyleId;
  label: string;
  tagline: string;
  /** Swatches for the style card (hex). */
  swatches: string[];
  /** Description used in prompts for both the stylist (Claude) and the image model. */
  brief: string;
}

export const STYLES: StyleDef[] = [
  {
    id: 'warm_luxury',
    label: 'Warm Luxury',
    tagline: 'Cream, warm wood, soft brass glow',
    swatches: ['#F3EDE4', '#D9C7AE', '#A07B55', '#C9A96A'],
    brief:
      'Warm luxury: layered cream, ivory, sand and beige textiles; warm wood (oak, walnut) and subtle brass accents; soft, warm, dimmable light; plush, tactile materials; calm, uncluttered, boutique-hotel feel. Avoid loud patterns and cold greys.',
  },
  {
    id: 'warm_minimal',
    label: 'Warm Minimal',
    tagline: 'Quiet, natural, few perfect pieces',
    swatches: ['#F4F1EA', '#E3D9C8', '#B9A58A', '#6F6255'],
    brief:
      'Warm minimal: very few, well-chosen pieces; off-white, oat and natural linen tones; light oak; paper and natural fibres; generous negative space; no clutter, no strong patterns.',
  },
  {
    id: 'modern',
    label: 'Modern',
    tagline: 'Crisp lines, contrast, clean light',
    swatches: ['#F5F5F4', '#A8A29E', '#44403C', '#111111'],
    brief:
      'Modern: clean geometric lines; white, grey and black with crisp contrast; metal and glass accents; tidy and graphic; one strong accent at most.',
  },
  {
    id: 'scandinavian',
    label: 'Scandinavian',
    tagline: 'Light, airy, birch and soft grey',
    swatches: ['#FAFAF7', '#DCDCD5', '#C8B89A', '#7E8B7A'],
    brief:
      'Scandinavian: bright and airy; white and light grey with soft sage or pale blue; pale woods (birch, pine, ash); cosy wool and cotton textiles; simple, functional pieces.',
  },
  {
    id: 'japandi',
    label: 'Japandi',
    tagline: 'Natural fibres, low, calm, grounded',
    swatches: ['#EFE9DF', '#C9BBA4', '#6E6254', '#2B2A28'],
    brief:
      'Japandi: calm, grounded and low; natural fibres (bamboo, rattan, paper); warm neutrals with charcoal or black accents; handmade textures; minimal decor; soft diffused light.',
  },
  {
    id: 'luxury_hotel',
    label: 'Luxury Hotel',
    tagline: 'Crisp white bedding, polished accents',
    swatches: ['#FFFFFF', '#E7E3DD', '#8C8A87', '#B08D57'],
    brief:
      'Luxury hotel: crisp white layered bedding with a tailored bedspread; symmetrical bedside tables and matching lamps; polished metal and glass; dark or walnut accents; plush rug; polished, serene, five-star suite feel.',
  },
  {
    id: 'mediterranean',
    label: 'Mediterranean',
    tagline: 'Sun-washed white, rattan, sea blue',
    swatches: ['#FBF8F2', '#E6D5B8', '#B7835A', '#3F6E8C'],
    brief:
      'Mediterranean: sun-washed whites and sand; rattan, sedge and handwoven textures; accents of sea blue or olive green; relaxed linen; airy sheer curtains; a few natural plants.',
  },
];

export const STYLE_BY_ID: Record<StyleId, StyleDef> = Object.fromEntries(STYLES.map((s) => [s.id, s])) as Record<StyleId, StyleDef>;

export const COLOR_DIRECTIONS = [
  'Cream, ivory and warm oak',
  'Greige with black accents',
  'Sage green and natural linen',
  'Navy blue with brass',
  'Terracotta and sand',
  'All-white and pale wood',
];
