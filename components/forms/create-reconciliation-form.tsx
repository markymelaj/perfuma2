'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Consignment, ConsignmentItem } from '@/lib/types';
import { reconciliationSchema } from '@/lib/validators';
import { authFetch, readJsonSafe } from '@/lib/supabase/auth-fetch';
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
  const [consignmentId, setConsignmentId] = useState(consignments[0]?.id ?? '');

  const visibleItems = useMemo(() => items.filter((row) => !consignmentId || row.consignment_id === consignmentId), [items, consignmentId]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setError(null);
    setSuccess(null);
    const data = new FormData(form);
    const payload = {
      consignment_id: String(data.get('consignment_id') ?? ''),
      type: String(data.get('type') ?? 'partial'),
      cash_received: String(data.get('cash_received') ?? '0'),
      transfer_received: String(data.get('transfer_received') ?? '0'),
      consignment_item_id: String(data.get('consignment_item_id') ?? ''),
      quantity_returned: String(data.get('quantity_returned') ?? '0'),
      notes: String(data.get('notes') ?? ''),
    };
    const parsed = reconciliationSchema.safeParse(payload);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Datos inválidos');
      return;
    }
    setLoading(true);
    try {
      const response = await authFetch('/api/reconciliations', { method: 'POST', body: JSON.stringify(parsed.data) });
      const result = await readJsonSafe(response);
      if (!response.ok) throw new Error(String(result.error ?? 'No se pudo registrar la rendición'));
      setSuccess('Rendición registrada.');
      form.reset();
      if (consignments[0]?.id) setConsignmentId(consignments[0].id);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar la rendición');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2"><Label htmlFor="consignment_id">Cuenta de stock</Label><Select id="consignment_id" name="consignment_id" required value={consignmentId} onChange={(e)=>setConsignmentId(e.target.value)}><option value="" disabled>Selecciona</option>{consignments.map((c)=><option key={c.id} value={c.id}>{c.id.slice(0,8)} · {c.status}</option>)}</Select></div>
        <div className="space-y-2"><Label htmlFor="type">Tipo</Label><Select id="type" name="type" defaultValue="partial"><option value="partial">Parcial</option><option value="total">Total</option></Select></div>
        <div className="space-y-2"><Label htmlFor="cash_received">Efectivo</Label><Input id="cash_received" name="cash_received" type="number" min="0" defaultValue="0" required /></div>
        <div className="space-y-2"><Label htmlFor="transfer_received">Transferencia</Label><Input id="transfer_received" name="transfer_received" type="number" min="0" defaultValue="0" required /></div>
        <div className="space-y-2"><Label htmlFor="consignment_item_id">Producto devuelto</Label><Select id="consignment_item_id" name="consignment_item_id" defaultValue=""><option value="">Sin devolución</option>{visibleItems.map((item)=><option key={item.id} value={item.id}>{item.products?.name ?? item.product_id}</option>)}</Select></div>
        <div className="space-y-2"><Label htmlFor="quantity_returned">Cantidad devuelta</Label><Input id="quantity_returned" name="quantity_returned" type="number" min="0" defaultValue="0" /></div>
        <div className="space-y-2 md:col-span-2"><Label htmlFor="notes">Notas</Label><Textarea id="notes" name="notes" /></div>
      </div>
      <FormMessage error={error} success={success} />
      <Button disabled={loading} type="submit">{loading ? 'Guardando...' : 'Registrar rendición'}</Button>
    </form>
  );
}
