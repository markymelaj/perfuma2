'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { authFetch, readJsonSafe } from '@/lib/supabase/auth-fetch';
import { Button } from '@/components/ui/button';

export function ToggleUserStatusButton({ userId, isActive, actorId }: { userId: string; isActive: boolean; actorId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const response = await authFetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'x-actor-id': actorId },
        body: JSON.stringify({ action: 'toggle-status', userId, isActive: !isActive }),
      });
      const result = await readJsonSafe(response);
      if (!response.ok) {
        throw new Error(String(result.error ?? 'No se pudo actualizar el usuario'));
      }
      router.refresh();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'No se pudo actualizar el usuario');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button disabled={loading} onClick={handleClick} type="button" variant="secondary">
      {loading ? '...' : isActive ? 'Desactivar' : 'Activar'}
    </Button>
  );
}
