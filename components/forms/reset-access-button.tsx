'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

export function ResetAccessButton({ userId }: { userId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    const password = window.prompt('Nueva contraseña temporal:');
    if (!password) return;

    setLoading(true);
    await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reset-password', userId, password }),
    });
    setLoading(false);
    router.refresh();
  }

  return (
    <Button disabled={loading} onClick={handleClick} type="button" variant="ghost">
      {loading ? '...' : 'Reset contraseña'}
    </Button>
  );
}
