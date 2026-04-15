'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Consignment, ConsignmentItem } from '@/lib/types';
import { reconciliationSchema } from '@/lib/validators';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { FormMessage } from '@/components/shared/form-message';

export function CreateReconciliationForm({ consignments, items }: { consignments: Consignment[]; items: ConsignmentItem[] }) {
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
    const response = await fetch('/api/reconciliations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed.data),
    });
    const result = await response.json();
    setLoading(false);

    if (!response.ok) {
      setError(result.error ?? 'No se pudo registrar la rendición');
      return;
    }

    setSuccess('Rendición registrada.');
    event.currentTarget.reset();
    router.refresh();
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="consignment_id">Consignación</Label>
          <Select id="consignment_id" name="consignment_id" required defaultValue="">
            <option value="" disabled>Selecciona</option>
            {consignments.map((consignment) => <option key={consignment.id} value={consignment.id}>{consignment.id.slice(0, 8)} · {consignment.status}</option>)}
          </Select>
        </div>
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
          <Label htmlFor="consignment_item_id">Ítem devuelto</Label>
          <Select id="consignment_item_id" name="consignment_item_id" defaultValue="">
            <option value="">Sin devolución</option>
            {items.map((item) => <option key={item.id} value={item.id}>{item.products?.name ?? item.product_id}</option>)}
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
