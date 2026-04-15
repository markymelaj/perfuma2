import { InviteUserForm } from '@/components/forms/invite-user-form';
import { CreateSupplierForm } from '@/components/forms/create-supplier-form';
import { CreateProductForm } from '@/components/forms/create-product-form';
import { CreateConsignmentForm } from '@/components/forms/create-consignment-form';
import { CreateReconciliationForm } from '@/components/forms/create-reconciliation-form';
import { CreateMessageForm } from '@/components/forms/create-message-form';
import { DataTable } from '@/components/shared/data-table';
import { KpiCard } from '@/components/shared/kpi-card';
import { ToggleUserStatusButton } from '@/components/forms/toggle-user-status-button';
import { ResetAccessButton } from '@/components/forms/reset-access-button';
import { Card } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';
import { getAdminDashboardData } from '@/lib/server-data';
import { requireAdmin } from '@/lib/auth/guards';

export const dynamic = 'force-dynamic';

export default async function OwnerPage() {
  const profile = await requireAdmin();
  const { profiles, suppliers, products, consignments, items, messages, metrics } =
    await getAdminDashboardData();

  const sellerRows = profiles
    .filter((row) => row.role !== 'super_admin')
    .map((row) => [
      row.display_name ?? 'Sin nombre',
      row.email ?? '-',
      row.role,
      row.is_active ? 'Activo' : 'Inactivo',
      <div key={row.id} className="flex flex-wrap gap-2">
        <ToggleUserStatusButton currentActorId={profile.id} userId={row.id} isActive={row.is_active} />
        <ResetAccessButton currentActorId={profile.id} userId={row.id} />
      </div>,
    ]);

  return (
    <div className="space-y-8">
      <section className="grid gap-4 grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Vendedores" value={String(metrics.sellers)} />
        <KpiCard title="Productos" value={String(metrics.products)} />
        <KpiCard title="Consignaciones abiertas" value={String(metrics.openConsignments)} />
        <KpiCard title="Pendiente por rendir" value={formatCurrency(metrics.pendiente)} />
      </section>

      <section className="-mx-1 overflow-x-auto pb-1 md:hidden">
        <div className="flex gap-2 px-1">
          {[
            ['#usuarios', 'Usuarios'],
            ['#proveedores', 'Proveedores'],
            ['#productos', 'Productos'],
            ['#consignar', 'Consignar'],
            ['#caja', 'Caja'],
            ['#mensajes', 'Mensajes'],
          ].map(([href, label]) => (
            <a
              key={href}
              href={href}
              className="whitespace-nowrap rounded-full border border-zinc-800 bg-zinc-950 px-4 py-2 text-sm text-zinc-200"
            >
              {label}
            </a>
          ))}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card id="usuarios">
          <h2 className="mb-4 text-xl font-semibold">Usuarios</h2>
          <InviteUserForm currentRole={profile.role} currentActorId={profile.id} />
        </Card>

        <Card id="proveedores">
          <h2 className="mb-4 text-xl font-semibold">Proveedores</h2>
          <CreateSupplierForm currentActorId={profile.id} />
        </Card>

        <Card id="productos">
          <h2 className="mb-4 text-xl font-semibold">Productos</h2>
          <CreateProductForm suppliers={suppliers} currentActorId={profile.id} />
        </Card>

        <Card id="consignar">
          <h2 className="mb-4 text-xl font-semibold">Asignar consignación</h2>
          <CreateConsignmentForm
            currentActorId={profile.id}
            sellers={profiles.filter((row) => row.role === 'seller' && row.is_active)}
            suppliers={suppliers}
            products={products}
          />
        </Card>

        <Card id="caja">
          <h2 className="mb-4 text-xl font-semibold">Rendición manual</h2>
          <CreateReconciliationForm currentActorId={profile.id} consignments={consignments} items={items} />
        </Card>

        <Card id="mensajes">
          <h2 className="mb-4 text-xl font-semibold">Mensaje a vendedor</h2>
          <CreateMessageForm currentActorId={profile.id} sellers={profiles.filter((row) => row.role === 'seller')} />
        </Card>
      </section>

      <Card>
        <h2 className="mb-4 text-xl font-semibold">Usuarios cargados</h2>
        <DataTable
          headers={['Nombre', 'Correo', 'Rol', 'Estado', 'Acciones']}
          rows={sellerRows}
        />
      </Card>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-xl font-semibold">Consignaciones</h2>
          <DataTable
            headers={['Vendedor', 'Estado', 'Abierta']}
            rows={consignments.map((row) => [
              row.seller_id,
              row.status,
              new Date(row.opened_at).toLocaleString('es-CL'),
            ])}
          />
        </Card>
        <Card>
          <h2 className="mb-4 text-xl font-semibold">Mensajes recientes</h2>
          <DataTable
            headers={['Vendedor', 'Mensaje', 'Fecha']}
            rows={messages.map((row) => [
              row.seller_id,
              row.body,
              new Date(row.created_at).toLocaleString('es-CL'),
            ])}
          />
        </Card>
      </section>
    </div>
  );
}
