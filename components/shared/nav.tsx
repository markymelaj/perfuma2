'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

export function Nav({ items }: { items: Array<{ href: string; label: string }> }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-2">
      {items.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'rounded-full border px-3 py-2 text-sm transition',
              active ? 'border-white bg-white text-black' : 'border-zinc-800 bg-zinc-950 text-zinc-300 hover:bg-zinc-900',
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
