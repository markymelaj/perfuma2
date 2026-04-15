'use client';

import { useRouter, useSearchParams } from 'next/navigation';

type Option = { id: string; label: string };

export function SellerFocusForm({ options, value }: { options: Option[]; value: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  return (
    <div className="grid w-full gap-2 md:max-w-sm">
      <label className="text-sm font-medium text-zinc-200" htmlFor="seller">Vendedor</label>
      <select
        id="seller"
        value={value}
        onChange={(event) => {
          const params = new URLSearchParams(searchParams.toString());
          params.set('seller', event.target.value);
          router.replace(`/owner?${params.toString()}`);
        }}
        className="w-full rounded-xl border border-zinc-800 bg-black px-3 py-3 text-sm text-white outline-none focus:border-zinc-600"
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
