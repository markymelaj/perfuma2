import Link from 'next/link';
import { Nav } from '@/components/shared/nav';
import { Badge } from '@/components/ui/badge';
import { requireProfile, isAdminRole } from '@/lib/auth/guards';

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();

  const items = isAdminRole(profile.role)
    ? [
        { href: '/owner', label: 'Resumen' },
        { href: '/owner#usuarios', label: 'Usuarios' },
        { href: '/owner#productos', label: 'Productos' },
        { href: '/owner#caja', label: 'Caja' },
      ]
    : [
        { href: '/seller', label: 'Inicio' },
        { href: '/seller#venta', label: 'Venta' },
        { href: '/seller#rendir', label: 'Rendir' },
        { href: '/seller#mensajes', label: 'Mensajes' },
      ];

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-7xl px-4 pb-24 pt-4 md:px-8 md:pb-10 md:pt-6">
        <header className="mb-6 rounded-[28px] border border-zinc-800 bg-zinc-950 p-5 md:mb-8 md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">Consigna privada</div>
              <h1 className="mt-2 text-2xl font-semibold leading-tight md:text-3xl">
                {profile.display_name ?? profile.email}
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-zinc-400">
                <Badge>{profile.role}</Badge>
                <span className="truncate">{profile.email}</span>
              </div>
            </div>
            <div className="flex flex-col gap-3 md:items-end">
              <Nav items={items} />
              <Link className="text-sm text-zinc-400 underline-offset-4 hover:underline" href="/logout">
                Cerrar sesión
              </Link>
            </div>
          </div>
        </header>
        {children}
      </div>
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-800 bg-zinc-950/95 px-3 py-2 backdrop-blur md:hidden">
        <Nav items={items} mobile />
      </div>
    </main>
  );
}
