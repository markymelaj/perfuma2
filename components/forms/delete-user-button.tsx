'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { authFetch, readJsonSafe } from '@/lib/supabase/auth-fetch';
import { Button } from '@/components/ui/button';

export function DeleteUserButton({ userId, actorId, label }: { userId: string; actorId: string; label?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    const ok = window.confirm('Esto eliminará al usuario y sus datos operativos. ¿Continuar?');
    if (!ok) return;

    setLoading(true);
    try {
      const response = await authFetch('/api/admin/users', {
        method: 'DELETE',
        headers: { 'x-actor-id': actorId },
        body: JSON.stringify({ userId }),
      });
      const result = await readJsonSafe(response);
      if (!response.ok) {
        throw new Error(String(result.error ?? 'No se pudo eliminar el usuario'));
      }
      router.refresh();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'No se pudo eliminar el usuario');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button disabled={loading} onClick={handleClick} type="button" variant="ghost">
      {loading ? '...' : label ?? 'Eliminar'}
    </Button>
  );
}
