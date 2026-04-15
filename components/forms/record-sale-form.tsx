'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { SellerStockLine } from '@/lib/types';
import { saleSchema } from '@/lib/validators';
import { authFetch, readJsonSafe } from '@/lib/supabase/auth-fetch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { FormMessage } from '@/components/shared/form-message';

export function RecordSaleForm({ actorId, consignmentId, stockLines }: { actorId: string; consignmentId: string | null; stockLines: SellerStockLine[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!consignmentId) return <FormMessage error="No tienes una cuenta activa de stock." />;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setError(null);
    setSuccess(null);
    const formData = new FormData(form);
    const payload = {
      consignment_id: consignmentId,
      consignment_item_id: String(formData.get('consignment_item_id') ?? ''),
      quantity: String(formData.get('quantity') ?? '0'),
      payment_method: String(formData.get('payment_method') ?? 'cash'),
      notes: String(formData.get('notes') ?? ''),
    };

    const parsed = saleSchema.safeParse(payload);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Datos inválidos');
      return;
    }

    setLoading(true);
    try {
      const response = await authFetch('/api/sales', {
        method: 'POST',
        headers: { 'x-actor-id': actorId },
        body: JSON.stringify(parsed.data),
      });
      const result = await readJsonSafe(response);
      if (!response.ok) throw new Error(String(result.error ?? 'No se pudo registrar la venta'));
      setSuccess('Venta registrada.');
      form.reset();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar la venta');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-2"><Label htmlFor="consignment_item_id">Producto</Label><Select id="consignment_item_id" name="consignment_item_id" required defaultValue=""><option value="" disabled>Selecciona</option>{stockLines.filter((line)=>line.quantity_current>0).map((line)=><option key={line.consignment_item_id} value={line.consignment_item_id}>{line.product_name} · stock {line.quantity_current}</option>)}</Select></div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2"><Label htmlFor="quantity">Cantidad</Label><Input id="quantity" name="quantity" type="number" min="1" required /></div>
        <div className="space-y-2"><Label htmlFor="payment_method">Pago</Label><Select id="payment_method" name="payment_method" defaultValue="cash"><option value="cash">Efectivo</option><option value="transfer">Transferencia</option><option value="mixed">Mixto</option></Select></div>
      </div>
      <div className="space-y-2"><Label htmlFor="notes">Notas</Label><Textarea id="notes" name="notes" /></div>
      <FormMessage error={error} success={success} />
      <Button disabled={loading} type="submit">{loading ? 'Guardando...' : 'Registrar venta'}</Button>
    </form>
  );
}
