import { LoginForm } from '@/components/forms/login-form';
import { Card } from '@/components/ui/card';

export const dynamic = 'force-dynamic';

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-black px-4 py-10 text-white">
      <div className="mx-auto max-w-md">
        <Card className="p-8">
          <div className="mb-6">
            <div className="text-sm uppercase tracking-wide text-zinc-500">Uso interno</div>
            <h1 className="mt-2 text-3xl font-semibold">Consigna Privada</h1>
            <p className="mt-2 text-sm text-zinc-500">Ingresa con tu correo y contraseña. El alta y la recuperación operativa las gestiona el super usuario.</p>
          </div>
          <LoginForm />
        </Card>
      </div>
    </main>
  );
}
