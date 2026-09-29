'use client';

import { useEffect, useState } from 'react';
import { STYLES } from '@/lib/styles';
import { api, getAccessCode, setAccessCode } from '@/lib/client/api';
import { loadProfile, saveProfile, type Profile } from '@/lib/client/store';
import { fmtDate, ils } from '@/components/format';

type Health = Awaited<ReturnType<typeof api.health>>;

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [code, setCode] = useState('');

  useEffect(() => {
    setProfile(loadProfile());
    setCode(getAccessCode());
    api.health().then(setHealth).catch(() => {});
  }, []);

  const set = (p: Profile) => {
    setProfile(p);
    saveProfile(p);
  };
  if (!profile) return null;

  return (
    <section className="mx-auto max-w-2xl px-5 pt-4 md:pt-10">
      <h1 className="font-serif text-[34px] leading-tight">Profile</h1>

      <h2 className="mt-8 text-sm font-medium uppercase tracking-[0.16em] text-muted">Default budget</h2>
      <div className="mt-3 grid grid-cols-4 gap-2 rounded-full bg-sand p-1">
        {[2000, 5000, 10000, null].map((b) => (
          <button
            key={String(b)}
            onClick={() => set({ ...profile, defaultBudget: b })}
            className={`rounded-full py-2.5 text-[14px] font-medium ${profile.defaultBudget === b ? 'bg-white shadow-[var(--shadow-soft)]' : 'text-muted'}`}
          >
            {b == null ? 'No limit' : ils(b)}
          </button>
        ))}
      </div>

      <h2 className="mt-8 text-sm font-medium uppercase tracking-[0.16em] text-muted">Favourite style</h2>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {STYLES.map((s) => (
          <button
            key={s.id}
            onClick={() => set({ ...profile, favoriteStyle: s.id })}
            className={`rounded-2xl border px-4 py-3 text-left text-[15px] ${profile.favoriteStyle === s.id ? 'border-ink bg-white' : 'border-line bg-white/60'}`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {health?.accessCodeRequired && (
        <>
          <h2 className="mt-8 text-sm font-medium uppercase tracking-[0.16em] text-muted">Access code</h2>
          <input
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              setAccessCode(e.target.value.trim());
            }}
            className="mt-3 w-full rounded-2xl border border-line bg-white px-4 py-3 text-base outline-none focus:border-ink"
            placeholder="Access code"
          />
        </>
      )}

      <h2 className="mt-8 text-sm font-medium uppercase tracking-[0.16em] text-muted">About this preview</h2>
      <div className="mt-3 space-y-2 rounded-[20px] bg-white p-4 text-sm leading-relaxed shadow-[var(--shadow-soft)]">
        {health ? (
          <>
            <Row k="Mode" v={health.mode === 'live' ? 'Live AI' : 'Demo (AI keys not configured)'} />
            <Row k="Room understanding" v={health.providers.analyzer} />
            <Row k="Product selection" v={health.providers.stylist} />
            <Row k="Image redesign" v={health.providers.editor} />
            <Row k="Catalog" v={`IKEA Israel · ${health.catalog.products} products · ${fmtDate(health.catalog.capturedAt)}`} />
            <p className="pt-2 text-xs text-muted">
              Development dataset of real IKEA Israel products. Prices are re-checked live on IKEA where possible; otherwise they are labelled as catalog prices.
            </p>
          </>
        ) : (
          <p className="text-muted">Checking…</p>
        )}
      </div>
    </section>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted">{k}</span>
      <span className="text-right">{v}</span>
    </div>
  );
}
