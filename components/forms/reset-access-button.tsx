'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { authFetch, readJsonSafe } from '@/lib/supabase/auth-fetch';
import { Button } from '@/components/ui/button';

export function ResetAccessButton({ userId, actorId }: { userId: string; actorId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    const password = window.prompt('Nueva contraseña temporal:');
    if (!password) return;

    setLoading(true);
    try {
      const response = await authFetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'x-actor-id': actorId },
        body: JSON.stringify({ action: 'reset-password', userId, password }),
      });
      const result = await readJsonSafe(response);
      if (!response.ok) {
        throw new Error(String(result.error ?? 'No se pudo resetear la contraseña'));
      }
      router.refresh();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'No se pudo resetear la contraseña');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button disabled={loading} onClick={handleClick} type="button" variant="ghost">
      {loading ? '...' : 'Reset contraseña'}
    </Button>
  );
}
