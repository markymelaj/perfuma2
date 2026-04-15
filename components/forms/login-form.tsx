'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { loginSchema } from '@/lib/validators';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormMessage } from '@/components/shared/form-message';

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Datos inválidos');
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    router.push('/');
    router.refresh();
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <Label htmlFor="email">Correo</Label>
        <Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Contraseña</Label>
        <Input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
      </div>
      <FormMessage error={error} />
      <Button className="w-full" disabled={loading} type="submit">
        {loading ? 'Ingresando...' : 'Ingresar'}
      </Button>
    </form>
  );
}
