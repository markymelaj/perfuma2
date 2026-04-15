import Link from 'next/link';
import { Nav } from '@/components/shared/nav';
import { Badge } from '@/components/ui/badge';
import { requireProfile } from '@/lib/auth/guards';
import { isAdminRole } from '@/lib/auth/guards';

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();

  const items = isAdminRole(profile.role)
    ? [{ href: '/owner', label: 'Panel admin' }]
    : [{ href: '/seller', label: 'Panel vendedor' }];

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-8">
        <header className="mb-8 flex flex-col gap-4 rounded-3xl border border-zinc-800 bg-zinc-950 p-6 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-sm uppercase tracking-wide text-zinc-500">Consigna Privada</div>
            <h1 className="mt-1 text-2xl font-semibold">{profile.display_name ?? profile.email}</h1>
            <div className="mt-2 flex items-center gap-2 text-sm text-zinc-400">
              <Badge>{profile.role}</Badge>
              <span>{profile.email}</span>
            </div>
          </div>
          <div className="flex flex-col gap-3 md:items-end">
            <Nav items={items} />
            <Link className="text-sm text-zinc-400 underline-offset-4 hover:underline" href="/logout">
              Cerrar sesión
            </Link>
          </div>
        </header>
        {children}
      </div>
    </main>
  );
}
