type P = { className?: string };
const base = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

export const IconHome = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}><path d="M3.5 10.5 12 4l8.5 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-6v6H4.5a1 1 0 0 1-1-1z" /></svg>
);
export const IconGrid = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="7" height="7" rx="1.5" /></svg>
);
export const IconBag = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}><path d="M5 8h14l-1 12H6z" /><path d="M9 8V6.5a3 3 0 0 1 6 0V8" /></svg>
);
export const IconUser = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}><circle cx="12" cy="8.5" r="3.5" /><path d="M5 20c1.2-3.5 4-5 7-5s5.8 1.5 7 5" /></svg>
);
export const IconCamera = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}><path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1.5-2h6l1.5 2h2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z" /><circle cx="12" cy="12.5" r="3.5" /></svg>
);
export const IconPhoto = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}><rect x="3.5" y="5" width="17" height="14" rx="2" /><circle cx="9" cy="10" r="1.5" /><path d="m20.5 16-5-5-8.5 8" /></svg>
);
export const IconSpark = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}><path d="M12 3.5 13.8 9l5.7 1.8-5.7 1.9L12 18.5l-1.8-5.8L4.5 10.8 10.2 9z" /><path d="M19 3v3M17.5 4.5h3" /></svg>
);
export const IconHeart = ({ className, filled }: P & { filled?: boolean }) => (
  <svg viewBox="0 0 24 24" className={className} {...base} fill={filled ? 'currentColor' : 'none'}><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" /></svg>
);
export const IconArrowUpRight = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}><path d="M7 17 17 7M9 7h8v8" /></svg>
);
export const IconClose = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}><path d="M6 6l12 12M18 6 6 18" /></svg>
);
export const IconCheck = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
);
export const IconLock = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}><rect x="5" y="10.5" width="14" height="9.5" rx="2" /><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" /></svg>
);
export const IconCompare = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}><path d="M12 3v18" /><path d="M8 8 4 12l4 4M16 8l4 4-4 4" /></svg>
);
export const IconPlus = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}><path d="M12 5v14M5 12h14" /></svg>
);
export const IconTrash = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}><path d="M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13" /></svg>
);
export const IconCopy = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}><rect x="8" y="8" width="11" height="12" rx="2" /><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-8A1.5 1.5 0 0 0 5 5.5v10A1.5 1.5 0 0 0 6.5 17H8" /></svg>
);
export const IconRetry = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}><path d="M4 12a8 8 0 0 1 13.7-5.7L20 8.5M20 4v4.5h-4.5" /><path d="M20 12a8 8 0 0 1-13.7 5.7L4 15.5M4 20v-4.5h4.5" /></svg>
);
