'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createUserSchema } from '@/lib/validators';
import type { AppRole } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { FormMessage } from '@/components/shared/form-message';

export function InviteUserForm({ currentRole }: { currentRole: AppRole }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    const payload = {
      email: String(formData.get('email') ?? ''),
      password: String(formData.get('password') ?? ''),
      display_name: String(formData.get('display_name') ?? ''),
      phone: String(formData.get('phone') ?? ''),
      role: String(formData.get('role') ?? 'seller'),
    };

    const parsed = createUserSchema.safeParse(payload);
    if (!parsed.success) {
      setLoading(false);
      setError(parsed.error.issues[0]?.message ?? 'Datos inválidos');
      return;
    }

    const response = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed.data),
    });
    const result = await response.json();
    setLoading(false);

    if (!response.ok) {
      setError(result.error ?? 'No se pudo crear el usuario');
      return;
    }

    setSuccess('Usuario creado correctamente.');
    event.currentTarget.reset();
    router.refresh();
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="display_name">Nombre</Label>
          <Input id="display_name" name="display_name" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Teléfono</Label>
          <Input id="phone" name="phone" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Correo</Label>
          <Input id="email" name="email" type="email" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Contraseña temporal</Label>
          <Input id="password" name="password" type="password" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="role">Rol</Label>
          <Select defaultValue="seller" id="role" name="role">
            <option value="seller">seller</option>
            <option value="owner" disabled={currentRole !== 'super_admin'}>
              owner
            </option>
          </Select>
        </div>
      </div>
      <FormMessage error={error} success={success} />
      <Button disabled={loading} type="submit">{loading ? 'Creando...' : 'Crear usuario'}</Button>
    </form>
  );
}
