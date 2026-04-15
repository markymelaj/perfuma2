'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

export function ToggleUserStatusButton({ userId, isActive }: { userId: string; isActive: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'toggle-status', userId, isActive: !isActive }),
    });
    setLoading(false);
    router.refresh();
  }

  return (
    <Button disabled={loading} onClick={handleClick} type="button" variant="secondary">
      {loading ? '...' : isActive ? 'Desactivar' : 'Activar'}
    </Button>
  );
}
