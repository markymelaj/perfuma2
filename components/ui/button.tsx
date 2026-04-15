import * as React from 'react';
import { cn } from '@/lib/utils';

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
};

export function Button({ className, variant = 'primary', ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-xl border px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50',
        variant === 'primary' && 'border-white bg-white text-black hover:bg-zinc-200',
        variant === 'secondary' && 'border-zinc-700 bg-zinc-900 text-white hover:bg-zinc-800',
        variant === 'ghost' && 'border-transparent bg-transparent text-zinc-300 hover:bg-zinc-900',
        variant === 'danger' && 'border-red-900 bg-red-950 text-red-200 hover:bg-red-900/60',
        className,
      )}
      {...props}
    />
  );
}
