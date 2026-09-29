'use client';

import { useEffect } from 'react';
import { IconClose } from './icons';

/** Bottom sheet on phones, centered dialog on larger screens. */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: string; children: React.ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center" role="dialog" aria-modal="true">
      <div className="fade-in absolute inset-0 bg-black/35 backdrop-blur-[2px]" onClick={onClose} />
      <div className="sheet-up relative max-h-[88dvh] w-full overflow-y-auto rounded-t-[28px] bg-paper px-5 pb-safe pt-3 shadow-[var(--shadow-float)] md:max-w-lg md:rounded-[28px] md:pb-6">
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-line md:hidden" />
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-serif text-xl">{title}</h2>
          <button onClick={onClose} className="-mr-2 rounded-full p-2 text-muted hover:bg-sand" aria-label="Close">
            <IconClose className="h-5 w-5" />
          </button>
        </div>
        <div className="pb-4">{children}</div>
      </div>
    </div>
  );
}
