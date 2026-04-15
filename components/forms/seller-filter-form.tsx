'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import type { Profile } from '@/lib/types';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';

export function SellerFilterForm({ sellers, value }: { sellers: Profile[]; value?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleChange(nextValue: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (nextValue) params.set('seller', nextValue);
    else params.delete('seller');
    const query = params.toString();
    router.push(query ? `/owner?${query}` : '/owner');
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="seller-filter">Vendedor</Label>
      <Select id="seller-filter" value={value ?? ''} onChange={(e) => handleChange(e.target.value)}>
        <option value="">Selecciona</option>
        {sellers.map((seller) => (
          <option key={seller.id} value={seller.id}>
            {seller.display_name ?? seller.email ?? seller.id}
          </option>
        ))}
      </Select>
    </div>
  );
}
