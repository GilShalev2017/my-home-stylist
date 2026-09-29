'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { IconBag, IconGrid, IconHome, IconLock, IconUser } from './icons';
import { Sheet } from './Sheet';
import { getAccessCode, setAccessCode } from '@/lib/client/api';

const TABS = [
  { href: '/', label: 'Home', Icon: IconHome },
  { href: '/designs', label: 'My Designs', Icon: IconGrid },
  { href: '/shop', label: 'Shop', Icon: IconBag },
  { href: '/profile', label: 'Profile', Icon: IconUser },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [askCode, setAskCode] = useState(false);
  const [code, setCode] = useState('');

  useEffect(() => {
    const open = () => {
      setCode(getAccessCode());
      setAskCode(true);
    };
    window.addEventListener('mhs:access-required', open);
    return () => window.removeEventListener('mhs:access-required', open);
  }, []);

  return (
    <div className="mx-auto flex min-h-dvh max-w-6xl flex-col">
      <header className="pt-safe sticky top-0 z-30 bg-paper/85 backdrop-blur-xl">
        <div className="flex h-14 items-center justify-between px-5">
          <Link href="/" className="flex items-baseline gap-2">
            <span className="font-serif text-[21px] tracking-tight">My Home</span>
            <span className="text-[10.5px] font-medium uppercase tracking-[0.22em] text-muted">Private Stylist</span>
          </Link>
          <nav className="hidden gap-7 text-sm md:flex">
            {TABS.map((t) => (
              <Link key={t.href} href={t.href} className={isActive(path, t.href) ? 'text-ink' : 'text-muted hover:text-ink'}>
                {t.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="flex-1 pb-28 md:pb-12">{children}</main>

      <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line/80 bg-paper/90 backdrop-blur-xl md:hidden">
        <div className="mx-auto grid max-w-md grid-cols-4">
          {TABS.map(({ href, label, Icon }) => {
            const active = isActive(path, href);
            return (
              <Link key={href} href={href} className={`flex flex-col items-center gap-0.5 pt-2 text-[10.5px] ${active ? 'text-ink' : 'text-muted'}`}>
                <Icon className="h-6 w-6" />
                {label}
              </Link>
            );
          })}
        </div>
      </nav>

      <Sheet open={askCode} onClose={() => setAskCode(false)} title="Access code">
        <div className="space-y-4">
          <div className="flex items-start gap-3 text-sm text-muted">
            <IconLock className="mt-0.5 h-5 w-5 shrink-0" />
            This preview is private. Enter the access code you were given.
          </div>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoFocus
            className="w-full rounded-2xl border border-line bg-white px-4 py-3.5 text-base outline-none focus:border-ink"
            placeholder="Access code"
          />
          <button
            onClick={() => {
              setAccessCode(code.trim());
              setAskCode(false);
            }}
            className="w-full rounded-full bg-ink py-3.5 text-[15px] font-medium text-white"
          >
            Continue
          </button>
        </div>
      </Sheet>
    </div>
  );
}

function isActive(path: string, href: string) {
  return href === '/' ? path === '/' : path.startsWith(href);
}
