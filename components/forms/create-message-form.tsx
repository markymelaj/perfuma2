'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Profile } from '@/lib/types';
import { messageSchema } from '@/lib/validators';
import { authFetch, readJsonSafe } from '@/lib/supabase/auth-fetch';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { FormMessage } from '@/components/shared/form-message';

export function CreateMessageForm({ sellers, actorId, defaultSellerId }: { sellers?: Profile[]; actorId: string; defaultSellerId?: string | null }) {
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
      seller_id: String(formData.get('seller_id') ?? defaultSellerId ?? ''),
      body: String(formData.get('body') ?? ''),
    };

    const parsed = messageSchema.safeParse(payload);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Datos inválidos');
      return;
    }

    setLoading(true);
    try {
      const response = await authFetch('/api/messages', {
        method: 'POST',
        headers: { 'x-actor-id': actorId },
        body: JSON.stringify(parsed.data),
      });
      const result = await readJsonSafe(response);
      if (!response.ok) throw new Error(String(result.error ?? 'No se pudo enviar el mensaje'));
      setSuccess('Mensaje enviado.');
      form.reset();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar el mensaje');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      {sellers ? <div className="space-y-2"><Label htmlFor="seller_id">Vendedor</Label><Select id="seller_id" name="seller_id" defaultValue={defaultSellerId ?? ''} required><option value="" disabled>Selecciona</option>{sellers.map((seller)=><option key={seller.id} value={seller.id}>{seller.display_name ?? seller.email}</option>)}</Select></div> : null}
      <div className="space-y-2"><Label htmlFor="body">Mensaje</Label><Textarea id="body" name="body" required /></div>
      <FormMessage error={error} success={success} />
      <Button disabled={loading} type="submit">{loading ? 'Enviando...' : 'Enviar mensaje'}</Button>
    </form>
  );
}
