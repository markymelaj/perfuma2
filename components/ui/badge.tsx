import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export function Badge({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn('inline-flex rounded-full border border-zinc-800 bg-black px-2.5 py-1 text-xs text-zinc-300', className)} {...props} />;
}
