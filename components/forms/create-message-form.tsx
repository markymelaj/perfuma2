'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Profile } from '@/lib/types';
import { messageSchema } from '@/lib/validators';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { FormMessage } from '@/components/shared/form-message';

export function CreateMessageForm({ sellers }: { sellers?: Profile[] }) {
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
      seller_id: String(formData.get('seller_id') ?? ''),
      body: String(formData.get('body') ?? ''),
    };

    const parsed = messageSchema.safeParse(payload);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Datos inválidos');
      return;
    }

    setLoading(true);
    const response = await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed.data),
    });
    const result = await response.json();
    setLoading(false);

    if (!response.ok) {
      setError(result.error ?? 'No se pudo enviar el mensaje');
      return;
    }

    setSuccess('Mensaje enviado.');
    event.currentTarget.reset();
    router.refresh();
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      {sellers ? (
        <div className="space-y-2">
          <Label htmlFor="seller_id">Vendedor</Label>
          <Select id="seller_id" name="seller_id" defaultValue="" required>
            <option value="" disabled>Selecciona</option>
            {sellers.map((seller) => <option key={seller.id} value={seller.id}>{seller.display_name ?? seller.email}</option>)}
          </Select>
        </div>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="body">Mensaje</Label>
        <Textarea id="body" name="body" required />
      </div>
      <FormMessage error={error} success={success} />
      <Button disabled={loading} type="submit">{loading ? 'Enviando...' : 'Enviar mensaje'}</Button>
    </form>
  );
}
