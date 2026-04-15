'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import type { Profile, SellerSnapshot } from '@/lib/types';
import { reconciliationSchema } from '@/lib/validators';
import { authFetch, readJsonSafe } from '@/lib/supabase/auth-fetch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { FormMessage } from '@/components/shared/form-message';
import { formatCurrency } from '@/lib/utils';

export function CreateReconciliationForm({
  actorId,
  sellers,
  defaultSellerId,
  selectedSeller,
  isSellerView = false,
}: {
  actorId: string;
  sellers: Profile[];
  defaultSellerId?: string;
  selectedSeller?: SellerSnapshot | null;
  isSellerView?: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const sellerOptions = useMemo(
    () => sellers.filter((seller) => seller.is_active).sort((a, b) => (a.display_name ?? '').localeCompare(b.display_name ?? '', 'es')),
    [sellers],
  );

  const stockOptions = selectedSeller?.stock_lines.filter((line) => line.quantity_current > 0) ?? [];

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setError(null);
    setSuccess(null);

    const formData = new FormData(form);
    const payload = {
      seller_id: String(formData.get('seller_id') ?? defaultSellerId ?? ''),
      type: String(formData.get('type') ?? 'partial'),
      cash_received: String(formData.get('cash_received') ?? '0'),
      transfer_received: String(formData.get('transfer_received') ?? '0'),
      consignment_item_id: String(formData.get('consignment_item_id') ?? ''),
      quantity_returned: String(formData.get('quantity_returned') ?? '0'),
      notes: String(formData.get('notes') ?? ''),
    };

    const parsed = reconciliationSchema.safeParse(payload);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Datos inválidos');
      return;
    }

    setLoading(true);
    try {
      const response = await authFetch('/api/reconciliations', {
        method: 'POST',
        headers: { 'x-actor-id': actorId },
        body: JSON.stringify(parsed.data),
      });
      const result = await readJsonSafe(response);
      if (!response.ok) {
        throw new Error(String(result.error ?? 'No se pudo registrar la rendición'));
      }
      setSuccess('Rendición registrada.');
      form.reset();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar la rendición');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      {!isSellerView ? (
        <div className="space-y-2">
          <Label htmlFor="seller_id">Vendedor</Label>
          <Select id="seller_id" name="seller_id" required defaultValue={defaultSellerId ?? ''}>
            <option value="" disabled>Selecciona</option>
            {sellerOptions.map((seller) => (
              <option key={seller.id} value={seller.id}>
                {seller.display_name ?? seller.email}
              </option>
            ))}
          </Select>
        </div>
      ) : null}

      {selectedSeller ? (
        <div className="grid gap-3 rounded-2xl border border-zinc-800 bg-black p-4 md:grid-cols-4">
          <div>
            <div className="text-xs text-zinc-500">Vendido acumulado</div>
            <div className="mt-1 font-semibold">{formatCurrency(selectedSeller.financials.sold_value)}</div>
          </div>
          <div>
            <div className="text-xs text-zinc-500">Rendido acumulado</div>
            <div className="mt-1 font-semibold">{formatCurrency(selectedSeller.financials.rendido_value)}</div>
          </div>
          <div>
            <div className="text-xs text-zinc-500">Pendiente por rendir</div>
            <div className="mt-1 font-semibold">{formatCurrency(selectedSeller.financials.pendiente_value)}</div>
          </div>
          <div>
            <div className="text-xs text-zinc-500">Stock valorizado actual</div>
            <div className="mt-1 font-semibold">{formatCurrency(selectedSeller.financials.stock_value)}</div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="type">Tipo</Label>
          <Select id="type" name="type" defaultValue="partial">
            <option value="partial">Parcial</option>
            <option value="total">Total</option>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="cash_received">Efectivo</Label>
          <Input id="cash_received" name="cash_received" type="number" min="0" defaultValue="0" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="transfer_received">Transferencia</Label>
          <Input id="transfer_received" name="transfer_received" type="number" min="0" defaultValue="0" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="consignment_item_id">Producto devuelto</Label>
          <Select id="consignment_item_id" name="consignment_item_id" defaultValue="">
            <option value="">Sin devolución</option>
            {stockOptions.map((line) => (
              <option key={line.product_id} value={line.consignment_item_ids[0]}>
                {line.product_name}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="quantity_returned">Cantidad devuelta</Label>
          <Input id="quantity_returned" name="quantity_returned" type="number" min="0" defaultValue="0" />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="notes">Notas</Label>
          <Textarea id="notes" name="notes" />
        </div>
      </div>

      <FormMessage error={error} success={success} />
      <Button disabled={loading} type="submit">{loading ? 'Guardando...' : 'Registrar rendición'}</Button>
    </form>
  );
}
