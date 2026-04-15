'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { supplierSchema } from '@/lib/validators';
import { authFetch, readJsonSafe } from '@/lib/supabase/auth-fetch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FormMessage } from '@/components/shared/form-message';

export function CreateSupplierForm({ currentAdminId }: { currentAdminId: string }) {
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
      name: String(formData.get('name') ?? ''),
      contact_name: String(formData.get('contact_name') ?? ''),
      contact_phone: String(formData.get('contact_phone') ?? ''),
      notes: String(formData.get('notes') ?? ''),
    };

    const parsed = supplierSchema.safeParse(payload);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Datos inválidos');
      return;
    }

    setLoading(true);
    try {
      const response = await authFetch('/api/suppliers', {
        method: 'POST',
        headers: {
          'x-admin-id': currentAdminId,
        },
        body: JSON.stringify(parsed.data),
      });
      const result = await readJsonSafe(response);

      if (!response.ok) {
        throw new Error(String(result.error ?? 'No se pudo guardar'));
      }

      setSuccess('Registro guardado.');
      form.reset();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Nombre</Label>
          <Input id="name" name="name" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contact_name">Contacto</Label>
          <Input id="contact_name" name="contact_name" />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="contact_phone">Teléfono</Label>
          <Input id="contact_phone" name="contact_phone" />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="notes">Notas</Label>
          <Textarea id="notes" name="notes" />
        </div>
      </div>
      <FormMessage error={error} success={success} />
      <Button disabled={loading} type="submit">{loading ? 'Guardando...' : 'Guardar'}</Button>
    </form>
  );
}
