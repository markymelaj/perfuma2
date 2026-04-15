'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { authFetch, readJsonSafe } from '@/lib/supabase/auth-fetch';
import { Button } from '@/components/ui/button';

export function DeleteUserButton({ userId }: { userId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    if (!window.confirm('Esto eliminará el usuario y sus datos relacionados. ¿Continuar?')) return;

    setLoading(true);
    try {
      const response = await authFetch('/api/admin/users', {
        method: 'PATCH',
        body: JSON.stringify({ action: 'delete-user', userId }),
      });
      const result = await readJsonSafe(response);
      if (!response.ok) throw new Error(String(result.error ?? 'No se pudo eliminar el usuario'));
      router.refresh();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'No se pudo eliminar el usuario');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button type="button" variant="ghost" disabled={loading} onClick={handleClick}>
      {loading ? '...' : 'Eliminar'}
    </Button>
  );
}
