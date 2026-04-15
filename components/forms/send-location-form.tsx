'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FormMessage } from '@/components/shared/form-message';

export function SendLocationForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!navigator.geolocation) {
      setError('Este dispositivo no soporta geolocalización.');
      return;
    }

    const note = String(new FormData(event.currentTarget).get('note') ?? '');
    setLoading(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const response = await fetch('/api/location', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            note,
          }),
        });
        const result = await response.json();
        setLoading(false);

        if (!response.ok) {
          setError(result.error ?? 'No se pudo guardar la ubicación');
          return;
        }

        setSuccess('Ubicación enviada.');
        event.currentTarget.reset();
        router.refresh();
      },
      () => {
        setLoading(false);
        setError('No se pudo obtener tu ubicación.');
      },
    );
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <Label htmlFor="note">Nota</Label>
        <Textarea id="note" name="note" placeholder="Punto de venta, referencia, etc." />
      </div>
      <FormMessage error={error} success={success} />
      <Button disabled={loading} type="submit">{loading ? 'Enviando...' : 'Enviar ubicación actual'}</Button>
    </form>
  );
}
