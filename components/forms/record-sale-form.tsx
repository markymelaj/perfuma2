'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Consignment, ConsignmentItem } from '@/lib/types';
import { saleSchema } from '@/lib/validators';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { FormMessage } from '@/components/shared/form-message';

export function RecordSaleForm({ consignments, items }: { consignments: Consignment[]; items: ConsignmentItem[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    const formData = new FormData(event.currentTarget);
    const payload = {
      consignment_id: String(formData.get('consignment_id') ?? ''),
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
    const response = await fetch('/api/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed.data),
    });
    const result = await response.json();
    setLoading(false);

    if (!response.ok) {
      setError(result.error ?? 'No se pudo registrar la venta');
      return;
    }

    setSuccess('Venta registrada.');
    event.currentTarget.reset();
    router.refresh();
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="consignment_id">Consignación</Label>
          <Select id="consignment_id" name="consignment_id" required defaultValue="">
            <option value="" disabled>Selecciona</option>
            {consignments.map((consignment) => <option key={consignment.id} value={consignment.id}>{consignment.id.slice(0, 8)} · {consignment.status}</option>)}
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="consignment_item_id">Ítem</Label>
          <Select id="consignment_item_id" name="consignment_item_id" required defaultValue="">
            <option value="" disabled>Selecciona</option>
            {items.map((item) => <option key={item.id} value={item.id}>{item.products?.name ?? item.product_id}</option>)}
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="quantity">Cantidad</Label>
          <Input id="quantity" name="quantity" type="number" min="1" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="payment_method">Pago</Label>
          <Select id="payment_method" name="payment_method" defaultValue="cash">
            <option value="cash">Efectivo</option>
            <option value="transfer">Transferencia</option>
            <option value="mixed">Mixto</option>
          </Select>
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="notes">Notas</Label>
          <Textarea id="notes" name="notes" />
        </div>
      </div>
      <FormMessage error={error} success={success} />
      <Button disabled={loading} type="submit">{loading ? 'Guardando...' : 'Registrar venta'}</Button>
    </form>
  );
}
