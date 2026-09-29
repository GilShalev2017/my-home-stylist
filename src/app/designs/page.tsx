'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { store, type DesignRecord, type RoomRecord } from '@/lib/client/store';
import { fmtDate, ils } from '@/components/format';
import { IconTrash } from '@/components/icons';

export default function DesignsPage() {
  const [designs, setDesigns] = useState<(DesignRecord & { room?: RoomRecord })[] | null>(null);

  const load = async () => {
    const all = await store.listDesigns();
    const withRooms = await Promise.all(all.map(async (d) => ({ ...d, room: await store.getRoom(d.roomId) })));
    setDesigns(withRooms);
  };
  useEffect(() => {
    load();
  }, []);

  return (
    <section className="px-5 pt-4 md:pt-10">
      <h1 className="font-serif text-[34px] leading-tight">My Designs</h1>
      <p className="mt-1 text-sm text-muted">Saved on this device.</p>

      {designs && designs.length === 0 && (
        <div className="mt-10 rounded-[24px] bg-white p-8 text-center shadow-[var(--shadow-soft)]">
          <p className="font-serif text-xl">No designs yet</p>
          <p className="mt-1 text-sm text-muted">Upload a photo of a room to get started.</p>
          <Link href="/" className="mt-5 inline-block rounded-full bg-ink px-6 py-3 text-[15px] font-medium text-white">
            Design a room
          </Link>
        </div>
      )}

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-5">
        {designs?.map((d) => (
          <div key={d.id} className="group relative overflow-hidden rounded-[20px] bg-white shadow-[var(--shadow-soft)]">
            <Link href={`/?design=${d.id}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={d.image ?? d.room?.image} alt="" className={`aspect-[4/5] w-full object-cover ${d.image ? '' : 'opacity-60 grayscale'}`} />
              <div className="p-3">
                <p className="truncate text-[15px] font-medium">{d.label}</p>
                <p className="text-xs text-muted">
                  {d.plan ? ils(d.plan.total) : d.status === 'error' ? 'Unfinished' : 'In progress'} · {fmtDate(d.createdAt)}
                </p>
              </div>
            </Link>
            <button
              onClick={async () => {
                await store.deleteDesign(d.id);
                load();
              }}
              aria-label="Delete design"
              className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-black/40 text-white backdrop-blur"
            >
              <IconTrash className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
