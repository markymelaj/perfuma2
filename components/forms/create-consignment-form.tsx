'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Product, Profile, Supplier } from '@/lib/types';
import { consignmentSchema } from '@/lib/validators';
import { authFetch, readJsonSafe } from '@/lib/supabase/auth-fetch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { FormMessage } from '@/components/shared/form-message';

export function CreateConsignmentForm({
  currentActorId,
  sellers,
  suppliers,
  products,
}: {
  currentActorId: string;
  sellers: Profile[];
  suppliers: Supplier[];
  products: Product[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setError(null);
    setSuccess(null);
    const formData = new FormData(form);
    const payload = {
      seller_id: String(formData.get('seller_id') ?? ''),
      supplier_id: String(formData.get('supplier_id') ?? ''),
      product_id: String(formData.get('product_id') ?? ''),
      quantity_assigned: String(formData.get('quantity_assigned') ?? '0'),
      unit_sale_price: String(formData.get('unit_sale_price') ?? '0'),
      notes: String(formData.get('notes') ?? ''),
    };

    const parsed = consignmentSchema.safeParse(payload);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Datos inválidos');
      return;
    }

    setLoading(true);
    try {
      const response = await authFetch('/api/consignments', {
        method: 'POST',
        headers: {
          'x-actor-id': currentActorId,
        },
        body: JSON.stringify(parsed.data),
      });
      const result = await readJsonSafe(response);

      if (!response.ok) {
        throw new Error(String(result.error ?? 'No se pudo crear la consignación'));
      }

      setSuccess('Consignación creada.');
      form.reset();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la consignación');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="seller_id">Vendedor</Label>
          <Select id="seller_id" name="seller_id" required defaultValue="">
            <option value="" disabled>Selecciona</option>
            {sellers.map((seller) => <option key={seller.id} value={seller.id}>{seller.display_name ?? seller.email}</option>)}
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="supplier_id">Proveedor</Label>
          <Select id="supplier_id" name="supplier_id" defaultValue="">
            <option value="">Sin proveedor</option>
            {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
          </Select>
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="product_id">Producto</Label>
          <Select id="product_id" name="product_id" required defaultValue="">
            <option value="" disabled>Selecciona</option>
            {products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="quantity_assigned">Cantidad</Label>
          <Input id="quantity_assigned" name="quantity_assigned" type="number" min="1" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="unit_sale_price">Precio de venta</Label>
          <Input id="unit_sale_price" name="unit_sale_price" type="number" min="0" required />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="notes">Notas</Label>
          <Textarea id="notes" name="notes" />
        </div>
      </div>
      <FormMessage error={error} success={success} />
      <Button className="w-full sm:w-auto" disabled={loading} type="submit">{loading ? 'Guardando...' : 'Crear consignación'}</Button>
    </form>
  );
}
