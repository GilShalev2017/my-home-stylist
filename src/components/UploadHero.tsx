'use client';

import { useRef } from 'react';
import { IconCamera, IconPhoto } from './icons';

export function UploadHero({ onFile, busy, error }: { onFile: (f: File) => void; busy: boolean; error?: string | null }) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);
  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (f) onFile(f);
  };

  return (
    <section className="px-5 pt-6 md:grid md:grid-cols-2 md:items-center md:gap-12 md:pt-16">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-brass">Your personal AI interior designer</p>
        <h1 className="mt-3 font-serif text-[40px] leading-[1.05] tracking-tight md:text-6xl">
          Imagine it.
          <br />
          Design it.
          <br />
          <span className="text-muted">Shop it.</span>
        </h1>
        <p className="mt-5 max-w-md text-[16px] leading-relaxed text-ink-soft">
          Upload a photo of your room and we&apos;ll redesign it while keeping the room itself recognizable — using real IKEA
          Israel products you can buy today.
        </p>
      </div>

      <div className="mt-8 md:mt-0">
        <div className="relative overflow-hidden rounded-[28px] bg-sand shadow-[var(--shadow-soft)]">
          <div className="grid aspect-[4/5] place-items-center bg-[radial-gradient(ellipse_at_top,_#fff_0%,_#f1ece4_70%)] md:aspect-[4/4.2]">
            <div className="px-8 text-center">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-white shadow-[var(--shadow-soft)]">
                <IconCamera className="h-7 w-7" />
              </div>
              <p className="mt-5 font-serif text-2xl">Start with your room</p>
              <p className="mx-auto mt-2 max-w-[17rem] text-sm leading-relaxed text-muted">
                Stand in a corner at chest height and capture as much of the room as you can. Daylight works best.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            disabled={busy}
            onClick={() => cameraRef.current?.click()}
            className="flex items-center justify-center gap-2 rounded-full bg-ink py-4 text-[15px] font-medium text-white active:scale-[0.98] disabled:opacity-50"
          >
            <IconCamera className="h-5 w-5" /> Take photo
          </button>
          <button
            disabled={busy}
            onClick={() => libraryRef.current?.click()}
            className="flex items-center justify-center gap-2 rounded-full border border-line bg-white py-4 text-[15px] font-medium active:scale-[0.98] disabled:opacity-50"
          >
            <IconPhoto className="h-5 w-5" /> Choose photo
          </button>
        </div>
        {error && <p className="mt-3 rounded-2xl bg-[#fbeee4] px-4 py-3 text-sm text-warn">{error}</p>}
        <p className="mt-4 text-center text-xs text-muted">JPG, PNG or HEIC · Your photo is only used to design your room.</p>

        <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={pick} />
        <input ref={libraryRef} type="file" accept="image/*,.heic,.heif" className="hidden" onChange={pick} />
      </div>
    </section>
  );
}
