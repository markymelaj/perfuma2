'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

export function Nav({
  items,
  mobile = false,
}: {
  items: Array<{ href: string; label: string }>;
  mobile?: boolean;
}) {
  const pathname = usePathname();

  return (
    <nav className={cn(mobile ? 'grid grid-cols-4 gap-2' : 'flex flex-wrap gap-2')}>
      {items.map((item) => {
        const baseHref = item.href.split('#')[0];
        const active = pathname === baseHref;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'rounded-2xl border px-3 py-2 text-center text-sm transition',
              mobile && 'px-2 py-3 text-xs font-medium',
              active
                ? 'border-white bg-white text-black'
                : 'border-zinc-800 bg-zinc-950 text-zinc-300 hover:bg-zinc-900',
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
