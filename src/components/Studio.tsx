'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { DesignAction, PlanItem, StyleId } from '@/lib/domain';
import { COLOR_DIRECTIONS, STYLE_BY_ID } from '@/lib/styles';
import { api } from '@/lib/client/api';
import { cropRenderResult, prepareForRender, prepareUpload } from '@/lib/client/image';
import { loadProfile, store, uid, type DesignRecord, type RoomRecord } from '@/lib/client/store';
import { UploadHero } from './UploadHero';
import { BriefForm, type Brief } from './BriefForm';
import { RoomImage } from './RoomImage';
import { ShopList } from './ShopList';
import { ProductSheet } from './ProductSheet';
import { Sheet } from './Sheet';
import { ils } from './format';
import { IconPlus, IconRetry } from './icons';

type Phase = 'upload' | 'analyzing' | 'brief' | 'design';

export function Studio() {
  const router = useRouter();
  const params = useSearchParams();
  const [phase, setPhase] = useState<Phase>('upload');
  const [room, setRoom] = useState<RoomRecord | null>(null);
  const [pendingImage, setPendingImage] = useState<{ dataUrl: string; width: number; height: number } | null>(null);
  const [brief, setBrief] = useState<Brief>({ style: 'warm_luxury', budget: 5000, keep: ['bed', 'floor', 'walls'], instructions: '' });
  const [designs, setDesigns] = useState<DesignRecord[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sheetItem, setSheetItem] = useState<PlanItem | null>(null);
  const [colorsOpen, setColorsOpen] = useState(false);
  const designsRef = useRef<DesignRecord[]>([]);

  // The ref is the source of truth so async steps never work on stale state.
  const commit = useCallback((list: DesignRecord[]) => {
    designsRef.current = list;
    setDesigns(list);
  }, []);

  const update = useCallback(
    async (id: string, patch: Partial<DesignRecord>) => {
      const cur = designsRef.current.find((d) => d.id === id);
      if (!cur) return;
      const merged = { ...cur, ...patch };
      commit(designsRef.current.map((d) => (d.id === id ? merged : d)));
      await store.saveDesign(merged);
    },
    [commit],
  );

  // Defaults from profile
  useEffect(() => {
    const p = loadProfile();
    setBrief((b) => ({ ...b, style: p.favoriteStyle, budget: p.defaultBudget }));
  }, []);

  // Open an existing design (?design=id)
  useEffect(() => {
    const id = params.get('design');
    if (!id || designsRef.current.some((d) => d.id === id)) return; // already open in this session
    (async () => {
      const d = await store.getDesign(id);
      if (!d) return;
      const r = await store.getRoom(d.roomId);
      if (!r) return;
      const all = await store.designsForRoom(r.id);
      // Anything left mid-flight from an earlier session can be retried.
      const fixed = all.map((x) =>
        x.status === 'planning' || x.status === 'rendering' ? { ...x, status: 'error' as const, error: 'This design was interrupted.' } : x,
      );
      setRoom(r);
      commit(fixed);
      setActiveId(d.id);
      setBrief({ style: d.style, budget: d.budget, keep: d.keep, instructions: d.instructions });
      setPhase('design');
    })();
  }, [params, commit]);

  // ---------------------------------------------------------------- Upload + analysis
  const onFile = async (file: File) => {
    setError(null);
    try {
      const img = await prepareUpload(file);
      setPendingImage(img);
      setPhase('analyzing');
      const { analysis } = await api.analyze(img.dataUrl);
      const r: RoomRecord = { id: uid(), createdAt: new Date().toISOString(), image: img.dataUrl, width: img.width, height: img.height, analysis };
      await store.saveRoom(r);
      setRoom(r);
      const suggested = analysis.keepSuggestions.filter((k) => k.present && k.defaultKeep).map((k) => k.key);
      setBrief((b) => ({ ...b, keep: [...new Set(['floor', 'walls', ...suggested] as Brief['keep'])] }));
      commit([]);
      setPhase('brief');
    } catch (e) {
      setError((e as Error).message);
      setPhase('upload');
    }
  };

  // ---------------------------------------------------------------- Design pipeline
  const runDesign = async (opts: {
    style: StyleId;
    budget: number | null;
    action: DesignAction;
    label: string;
    colorDirection?: string;
    from?: DesignRecord;
  }) => {
    if (!room) return;
    const from = opts.from?.plan;
    const record: DesignRecord = {
      id: uid(),
      roomId: room.id,
      createdAt: new Date().toISOString(),
      label: opts.label,
      style: opts.style,
      budget: opts.budget,
      keep: brief.keep,
      instructions: brief.instructions,
      status: 'planning',
    };
    commit([...designsRef.current, record]);
    setActiveId(record.id);
    setPhase('design');
    await store.saveDesign(record);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    router.replace(`/?design=${record.id}`, { scroll: false });

    try {
      const { plan } = await api.plan({
        analysis: room.analysis,
        style: opts.style,
        instructions: brief.instructions,
        budget: opts.budget,
        keep: brief.keep,
        action: opts.action,
        colorDirection: opts.colorDirection,
        previous: from
          ? {
              style: from.style,
              concept: from.concept,
              palette: from.palette,
              total: from.total,
              items: from.items.filter((i) => !i.isAccessory).map((i) => ({ productId: i.product.id, slot: i.slot, quantity: i.quantity })),
            }
          : undefined,
      });
      await update(record.id, { plan, status: 'rendering' });
      await render({ ...record, plan, status: 'rendering' });
    } catch (e) {
      await update(record.id, { status: 'error', error: (e as Error).message });
    }
  };

  const render = async (d: DesignRecord) => {
    if (!room || !d.plan) return;
    try {
      await update(d.id, { status: 'rendering', error: undefined });
      const original = { dataUrl: room.image, width: room.width, height: room.height };
      const input = await prepareForRender(original);
      const res = await api.render({ image: input.dataUrl, size: input.size, padded: input.padded, plan: d.plan, analysis: room.analysis });
      const image = await cropRenderResult(res.image, input, original);
      await update(d.id, { image, status: 'ready', renderModel: res.model, referenceImagesUsed: res.referenceImagesUsed });
      api
        .locate(image, d.plan.items)
        .then(({ hotspots }) => update(d.id, { hotspots }))
        .catch(() => {});
    } catch (e) {
      await update(d.id, { status: 'error', error: (e as Error).message });
    }
  };

  const active = designs.find((d) => d.id === activeId) ?? designs[designs.length - 1];

  const variation = (kind: 'style' | 'warmer' | 'cheaper' | 'colors', value?: string) => {
    if (!active?.plan) return;
    const base = { from: active, budget: active.budget, style: active.style };
    if (kind === 'style') return runDesign({ ...base, style: value as StyleId, action: 'style', label: STYLE_BY_ID[value as StyleId].label });
    if (kind === 'warmer') return runDesign({ ...base, action: 'warmer', label: 'Warmer' });
    if (kind === 'colors') return runDesign({ ...base, action: 'colors', colorDirection: value, label: value ?? 'New colours' });
    const target = Math.max(500, Math.floor((active.plan.total * 0.65) / 100) * 100);
    return runDesign({ ...base, budget: target, action: 'cheaper', label: `Under ${ils(target)}` });
  };

  const reset = () => {
    setRoom(null);
    setPendingImage(null);
    commit([]);
    setActiveId(null);
    setPhase('upload');
    router.replace('/', { scroll: false });
  };

  // ---------------------------------------------------------------- Views
  if (phase === 'upload') return <UploadHero onFile={onFile} busy={false} error={error} />;

  if (phase === 'analyzing' && pendingImage)
    return (
      <section className="mx-auto max-w-2xl px-5 pt-4">
        <RoomImage original={pendingImage.dataUrl} width={pendingImage.width} height={pendingImage.height} stage="analyzing" />
        <p className="mt-5 text-center font-serif text-2xl">Getting to know your room</p>
        <p className="mt-1 text-center text-sm text-muted">We map what stays — walls, windows, floor — before choosing anything.</p>
      </section>
    );

  if (phase === 'brief' && room)
    return (
      <BriefForm
        image={room.image}
        analysis={room.analysis}
        brief={brief}
        onChange={setBrief}
        onReset={reset}
        onSubmit={() => runDesign({ style: brief.style, budget: brief.budget, action: 'new', label: STYLE_BY_ID[brief.style].label })}
      />
    );

  if (phase === 'design' && room && active) {
    const stage = active.status === 'planning' ? 'planning' : active.status === 'rendering' ? 'rendering' : null;
    const busy = designs.some((d) => d.status === 'planning' || d.status === 'rendering');
    return (
      <section className="px-5 pt-3 md:grid md:grid-cols-[1.25fr_1fr] md:gap-10 md:pt-8">
        <div className="md:sticky md:top-20 md:self-start">
          <div className="mb-3 flex items-baseline justify-between">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-brass">Your room</p>
              <h1 className="font-serif text-[30px] leading-tight">{active.label}</h1>
            </div>
            {active.plan && <p className="text-lg font-semibold tabular-nums">{ils(active.plan.total)}</p>}
          </div>

          <RoomImage
            original={room.image}
            result={active.image}
            width={room.width}
            height={room.height}
            stage={stage}
            hotspots={active.hotspots}
            items={active.plan?.items}
            onHotspot={setSheetItem}
            demo={active.plan?.mode === 'demo'}
          />

          {active.status === 'error' && (
            <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-[#fbeee4] px-4 py-3">
              <p className="text-sm text-warn">{active.error ?? 'Something went wrong.'}</p>
              <button
                onClick={() => (active.plan ? render(active) : runDesign({ style: active.style, budget: active.budget, action: 'new', label: active.label }))}
                className="flex shrink-0 items-center gap-1.5 rounded-full bg-ink px-3.5 py-2 text-[13px] font-medium text-white"
              >
                <IconRetry className="h-4 w-4" /> Retry
              </button>
            </div>
          )}

          {designs.length > 1 && (
            <div className="no-scrollbar -mx-5 mt-4 flex gap-2 overflow-x-auto px-5">
              {designs.map((d) => (
                <button
                  key={d.id}
                  onClick={() => {
                    setActiveId(d.id);
                    router.replace(`/?design=${d.id}`, { scroll: false });
                  }}
                  className={`shrink-0 overflow-hidden rounded-2xl border-2 ${d.id === active.id ? 'border-ink' : 'border-transparent'}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={d.image ?? room.image} alt="" className={`h-16 w-16 object-cover ${d.image ? '' : 'opacity-50'}`} />
                  <p className="w-16 truncate bg-white px-1 py-0.5 text-[10px]">{d.label}</p>
                </button>
              ))}
            </div>
          )}

          {active.plan && (
            <div className="mt-5">
              {active.plan.concept && <p className="font-serif text-[17px] leading-relaxed text-ink-soft">“{active.plan.concept}”</p>}
              <div className="no-scrollbar -mx-5 mt-4 flex gap-2 overflow-x-auto px-5 pb-1">
                {(['japandi', 'scandinavian', 'luxury_hotel', 'warm_luxury', 'mediterranean', 'modern', 'warm_minimal'] as StyleId[])
                  .filter((s) => s !== active.style)
                  .slice(0, 3)
                  .map((s) => (
                    <Chip key={s} disabled={busy} onClick={() => variation('style', s)}>
                      Try {STYLE_BY_ID[s].label.replace('Luxury Hotel', 'Luxury')}
                    </Chip>
                  ))}
                <Chip disabled={busy} onClick={() => variation('warmer')}>Make it warmer</Chip>
                <Chip disabled={busy} strong onClick={() => variation('cheaper')}>Make it cheaper</Chip>
                <Chip disabled={busy} onClick={() => setColorsOpen(true)}>Change colors</Chip>
              </div>
            </div>
          )}
        </div>

        <div className="mt-8 md:mt-14">
          {active.plan ? (
            <ShopList plan={active.plan} onItem={setSheetItem} />
          ) : (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="shimmer relative h-16 overflow-hidden rounded-2xl bg-sand" />
              ))}
            </div>
          )}
          <button onClick={reset} className="mt-8 flex w-full items-center justify-center gap-2 rounded-full border border-line bg-white py-3.5 text-[15px] font-medium">
            <IconPlus className="h-4 w-4" /> Design another room
          </button>
        </div>

        <ProductSheet item={sheetItem} onClose={() => setSheetItem(null)} />
        <Sheet open={colorsOpen} onClose={() => setColorsOpen(false)} title="Change colors">
          <div className="grid gap-2">
            {COLOR_DIRECTIONS.map((c) => (
              <button
                key={c}
                onClick={() => {
                  setColorsOpen(false);
                  variation('colors', c);
                }}
                className="rounded-2xl border border-line bg-white px-4 py-3.5 text-left text-[15px]"
              >
                {c}
              </button>
            ))}
          </div>
        </Sheet>
      </section>
    );
  }

  return <UploadHero onFile={onFile} busy={false} error={error} />;
}

function Chip({ children, onClick, disabled, strong }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; strong?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`shrink-0 rounded-full border px-4 py-2 text-[14px] font-medium transition active:scale-[0.97] disabled:opacity-40 ${
        strong ? 'border-ink bg-ink text-white' : 'border-line bg-white'
      }`}
    >
      {children}
    </button>
  );
}
