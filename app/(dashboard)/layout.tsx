import Link from 'next/link';
import { Nav } from '@/components/shared/nav';
import { Badge } from '@/components/ui/badge';
import { requireProfile } from '@/lib/auth/guards';
import { isAdminRole } from '@/lib/auth/guards';

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();

  const items = isAdminRole(profile.role)
    ? [{ href: '/owner', label: 'Admin' }]
    : [{ href: '/seller', label: 'Mi panel' }];

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-7xl px-4 pb-24 pt-4 md:px-8 md:pb-10 md:pt-6">
        <header className="mb-6 flex flex-col gap-4 rounded-3xl border border-zinc-800 bg-zinc-950 p-5 md:flex-row md:items-center md:justify-between md:p-6">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">Consigna Privada</div>
            <h1 className="mt-2 text-2xl font-semibold md:text-3xl">{profile.display_name ?? profile.username ?? profile.email}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-zinc-400">
              <Badge>{profile.role}</Badge>
              {profile.username ? <span>@{profile.username}</span> : null}
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
