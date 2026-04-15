'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Select } from '@/components/ui/select';
import type { Profile } from '@/lib/types';

export function SellerFilter({ sellers, selectedSellerId }: { sellers: Profile[]; selectedSellerId: string | null }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function onChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set('seller', value);
    else params.delete('seller');
    router.push(`/owner?${params.toString()}`);
  }

  return (
    <Select value={selectedSellerId ?? ''} onChange={(event) => onChange(event.target.value)}>
      <option value="">Selecciona</option>
      {sellers.map((seller) => (
        <option key={seller.id} value={seller.id}>{seller.display_name ?? seller.email}</option>
      ))}
    </Select>
  );
}
