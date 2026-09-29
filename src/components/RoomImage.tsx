'use client';

import { useEffect, useRef, useState } from 'react';
import type { Hotspot, PlanItem } from '@/lib/domain';
import { IconCompare } from './icons';

const STAGES: Record<string, string[]> = {
  analyzing: ['Understanding your room…', 'Finding the walls, windows and light…'],
  planning: ['Choosing real IKEA pieces…', 'Balancing your budget…'],
  rendering: ['Designing your room…', 'Placing the rug and bedding…', 'Matching the light…', 'Adding the final touches…'],
};

export function RoomImage({
  original,
  result,
  width,
  height,
  stage,
  hotspots,
  items,
  onHotspot,
  demo,
}: {
  original: string;
  result?: string;
  width: number;
  height: number;
  stage?: 'analyzing' | 'planning' | 'rendering' | null;
  hotspots?: Hotspot[];
  items?: PlanItem[];
  onHotspot?: (item: PlanItem) => void;
  demo?: boolean;
}) {
  const [compare, setCompare] = useState(false);
  const [pos, setPos] = useState(50);
  const [elapsed, setElapsed] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  useEffect(() => {
    if (!stage) return;
    setElapsed(0);
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [stage]);

  const move = (clientX: number) => {
    const r = box.current?.getBoundingClientRect();
    if (!r) return;
    setPos(Math.max(0, Math.min(100, ((clientX - r.left) / r.width) * 100)));
  };

  const messages = stage ? STAGES[stage] : [];
  const message = messages[Math.floor(elapsed / 6) % Math.max(1, messages.length)];
  const showAfter = !!result && !stage;

  return (
    <div className="relative">
      <div
        ref={box}
        className="relative w-full select-none overflow-hidden rounded-[24px] bg-sand shadow-[var(--shadow-soft)] md:rounded-[28px]"
        style={{ aspectRatio: `${width} / ${height}` }}
        onPointerDown={(e) => {
          if (!compare) return;
          dragging.current = true;
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          move(e.clientX);
        }}
        onPointerMove={(e) => dragging.current && move(e.clientX)}
        onPointerUp={() => (dragging.current = false)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={showAfter ? result : original} alt={showAfter ? 'Redesigned room' : 'Your room'} className="absolute inset-0 h-full w-full object-cover" draggable={false} />

        {showAfter && compare && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={original}
              alt="Before"
              className="absolute inset-0 h-full w-full object-cover"
              style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
              draggable={false}
            />
            <div className="absolute inset-y-0 w-0.5 bg-white shadow" style={{ left: `${pos}%` }}>
              <div className="absolute top-1/2 left-1/2 grid h-10 w-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white shadow-[var(--shadow-float)]">
                <IconCompare className="h-5 w-5" />
              </div>
            </div>
            <span className="absolute left-3 top-3 rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur">Before</span>
            <span className="absolute right-3 top-3 rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur">After</span>
          </>
        )}

        {showAfter && !compare &&
          hotspots?.map((h) => {
            const item = items?.find((i) => i.product.id === h.productId && !i.isAccessory);
            if (!item) return null;
            return (
              <button
                key={h.productId}
                aria-label={item.role}
                onClick={() => onHotspot?.(item)}
                className="hotspot absolute grid h-7 w-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full"
                style={{ left: `${h.x * 100}%`, top: `${h.y * 100}%` }}
              >
                <span className="relative h-3.5 w-3.5 rounded-full border-2 border-white bg-ink/80 shadow-[0_0_0_1px_rgba(0,0,0,0.15)]" />
              </button>
            );
          })}

        {stage && (
          <div className="shimmer absolute inset-0 bg-paper/25 backdrop-blur-[1.5px]">
            <div className="absolute inset-x-0 bottom-4 flex justify-center px-4">
              <div className="flex items-center gap-3 rounded-full bg-black/55 py-2.5 pl-3 pr-4 text-sm text-white backdrop-blur-md">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                <span>{message}</span>
                {stage === 'rendering' && <span className="tabular-nums text-white/60">{fmt(elapsed)}</span>}
              </div>
            </div>
          </div>
        )}

        {showAfter && demo && (
          <div className="absolute inset-x-3 top-3 rounded-2xl bg-black/55 px-3 py-2 text-center text-[12px] leading-snug text-white backdrop-blur">
            Demo mode — AI image model not connected, so this is your original photo. Products and prices below are real.
          </div>
        )}
      </div>

      {showAfter && (
        <div className="mt-3 flex items-center justify-between">
          <p className="text-xs text-muted">{compare ? 'Drag to compare' : hotspots?.length ? 'Tap a dot to see the product' : ''}</p>
          <button
            onClick={() => setCompare((c) => !c)}
            className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13px] font-medium ${compare ? 'border-ink bg-ink text-white' : 'border-line bg-white'}`}
          >
            <IconCompare className="h-4 w-4" /> Before / After
          </button>
        </div>
      )}
    </div>
  );
}

function fmt(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
