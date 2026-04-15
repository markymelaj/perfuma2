import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-[28px] border border-zinc-800 bg-zinc-950 p-5 shadow-sm md:p-6',
        className,
      )}
      {...props}
    />
  );
}
