import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { requireProfile } from '@/lib/auth/guards';
import { isAdminRole } from '@/lib/auth/guards';

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();
  const homeHref = isAdminRole(profile.role) ? '/owner' : '/seller';

  return (
    <main className="min-h-screen bg-black pb-24 text-white md:pb-8">
      <div className="mx-auto max-w-7xl px-4 py-4 md:px-8 md:py-6">
        <header className="mb-6 flex flex-col gap-4 rounded-3xl border border-zinc-800 bg-zinc-950 p-5 md:flex-row md:items-center md:justify-between md:p-6">
          <div>
            <div className="text-xs uppercase tracking-wide text-zinc-500">Consigna Privada</div>
            <h1 className="mt-1 text-2xl font-semibold">{profile.display_name ?? profile.email}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-zinc-400">
              <Badge>{profile.role}</Badge>
              <span>{profile.email}</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Link className="rounded-full border border-zinc-800 px-3 py-2 text-sm text-zinc-200" href={homeHref}>
              {isAdminRole(profile.role) ? 'Panel admin' : 'Panel vendedor'}
            </Link>
            <Link className="text-sm text-zinc-400 underline-offset-4 hover:underline" href="/logout">Cerrar sesión</Link>
          </div>
        </header>
        {children}
      </div>
    </main>
  );
}
