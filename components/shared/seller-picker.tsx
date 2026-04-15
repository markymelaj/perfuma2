'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Select } from '@/components/ui/select';

type SellerOption = {
  id: string;
  label: string;
};

export function SellerPicker({ sellers, value }: { sellers: SellerOption[]; value?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const next = event.target.value;
    const params = new URLSearchParams(searchParams.toString());
    if (next) {
      params.set('seller', next);
    } else {
      params.delete('seller');
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="space-y-2">
      <div className="text-sm text-zinc-400">Vendedor</div>
      <Select value={value ?? ''} onChange={handleChange}>
        <option value="">Selecciona</option>
        {sellers.map((seller) => (
          <option key={seller.id} value={seller.id}>
            {seller.label}
          </option>
        ))}
      </Select>
    </div>
  );
}
