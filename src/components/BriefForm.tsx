'use client';

import { KEEP_LABELS, type KeepKey, type RoomAnalysis, type StyleId } from '@/lib/domain';
import { STYLES } from '@/lib/styles';
import { IconCheck, IconSpark } from './icons';
import { ils } from './format';

export interface Brief {
  style: StyleId;
  budget: number | null;
  keep: KeepKey[];
  instructions: string;
}

const BUDGETS: (number | null)[] = [2000, 5000, 10000, null];
const ALWAYS_SHOW: KeepKey[] = ['bed', 'floor', 'walls', 'curtains', 'bedside_tables', 'rug', 'lighting'];

export function BriefForm({
  image,
  analysis,
  brief,
  onChange,
  onSubmit,
  onReset,
}: {
  image: string;
  analysis: RoomAnalysis;
  brief: Brief;
  onChange: (b: Brief) => void;
  onSubmit: () => void;
  onReset: () => void;
}) {
  const keepOptions = analysis.keepSuggestions.filter((k) => k.present || ALWAYS_SHOW.includes(k.key));
  const toggleKeep = (k: KeepKey) =>
    onChange({ ...brief, keep: brief.keep.includes(k) ? brief.keep.filter((x) => x !== k) : [...brief.keep, k] });

  return (
    <section className="px-5 pt-4 md:grid md:grid-cols-[1fr_1.1fr] md:gap-10 md:pt-10">
      <div className="md:sticky md:top-20 md:self-start">
        <div className="relative overflow-hidden rounded-[24px] shadow-[var(--shadow-soft)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image} alt="Your room" className="w-full object-cover" />
          <button onClick={onReset} className="absolute right-3 top-3 rounded-full bg-black/45 px-3 py-1.5 text-xs font-medium text-white backdrop-blur">
            Change photo
          </button>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          <span className="font-medium text-ink">We see:</span> {analysis.summary}
        </p>
      </div>

      <div className="mt-7 space-y-8 md:mt-0">
        <div>
          <h2 className="font-serif text-[26px] leading-tight">Choose a style</h2>
          <div className="no-scrollbar -mx-5 mt-4 flex snap-x gap-3 overflow-x-auto px-5 pb-1 md:mx-0 md:grid md:grid-cols-2 md:px-0">
            {STYLES.map((s) => {
              const active = brief.style === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => onChange({ ...brief, style: s.id })}
                  className={`w-[44vw] max-w-[190px] shrink-0 snap-start rounded-[20px] border p-3 text-left transition md:w-auto md:max-w-none ${
                    active ? 'border-ink bg-white shadow-[var(--shadow-soft)]' : 'border-line bg-white/60'
                  }`}
                >
                  <div className="flex h-14 overflow-hidden rounded-xl">
                    {s.swatches.map((c) => (
                      <div key={c} className="flex-1" style={{ background: c }} />
                    ))}
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-[15px] font-medium">{s.label}</span>
                    {active && <IconCheck className="h-4 w-4" />}
                  </div>
                  <p className="mt-0.5 text-xs leading-snug text-muted">{s.tagline}</p>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <h2 className="font-serif text-[26px] leading-tight">Budget</h2>
          <div className="mt-4 grid grid-cols-4 gap-2 rounded-full bg-sand p-1">
            {BUDGETS.map((b) => (
              <button
                key={String(b)}
                onClick={() => onChange({ ...brief, budget: b })}
                className={`rounded-full py-2.5 text-[14px] font-medium transition ${brief.budget === b ? 'bg-white shadow-[var(--shadow-soft)]' : 'text-muted'}`}
              >
                {b == null ? 'No limit' : ils(b)}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">Totals are calculated from actual IKEA prices.</p>
        </div>

        <div>
          <h2 className="font-serif text-[26px] leading-tight">Keep what I have</h2>
          <p className="mt-1 text-sm text-muted">Checked items stay exactly as they are. Untick big pieces (sofa, wardrobe, table) to let the stylist replace them with IKEA furniture.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {keepOptions.map((k) => {
              const on = brief.keep.includes(k.key);
              return (
                <button
                  key={k.key}
                  onClick={() => toggleKeep(k.key)}
                  className={`flex items-center gap-1.5 rounded-full border px-4 py-2 text-[14px] transition ${
                    on ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink-soft'
                  }`}
                >
                  {on && <IconCheck className="h-3.5 w-3.5" />}
                  {KEEP_LABELS[k.key]}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <h2 className="font-serif text-[26px] leading-tight">Anything else?</h2>
          <textarea
            value={brief.instructions}
            onChange={(e) => onChange({ ...brief, instructions: e.target.value })}
            rows={3}
            maxLength={600}
            placeholder="e.g. Replace the sofa with a beige IKEA sofa and add a wardrobe. Use cream and warm wood. Don't change the doors."
            className="mt-4 w-full resize-none rounded-[20px] border border-line bg-white px-4 py-3.5 text-[15px] leading-relaxed outline-none placeholder:text-muted/70 focus:border-ink"
          />
        </div>

        <button
          onClick={onSubmit}
          className="sticky bottom-24 z-10 flex w-full items-center justify-center gap-2 rounded-full bg-ink py-4 text-[16px] font-medium text-white shadow-[var(--shadow-float)] active:scale-[0.99] md:bottom-6"
        >
          <IconSpark className="h-5 w-5" /> Design my room
        </button>
      </div>
    </section>
  );
}
