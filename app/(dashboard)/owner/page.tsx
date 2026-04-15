import Link from 'next/link';
import { InviteUserForm } from '@/components/forms/invite-user-form';
import { CreateProductForm } from '@/components/forms/create-product-form';
import { CreateConsignmentForm } from '@/components/forms/create-consignment-form';
import { CreateReconciliationForm } from '@/components/forms/create-reconciliation-form';
import { CreateMessageForm } from '@/components/forms/create-message-form';
import { SellerFilterForm } from '@/components/forms/seller-filter-form';
import { DeleteUserButton } from '@/components/forms/delete-user-button';
import { DataTable } from '@/components/shared/data-table';
import { KpiCard } from '@/components/shared/kpi-card';
import { ToggleUserStatusButton } from '@/components/forms/toggle-user-status-button';
import { ResetAccessButton } from '@/components/forms/reset-access-button';
import { Card } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';
import { getAdminDashboardData } from '@/lib/server-data';
import { requireAdmin } from '@/lib/auth/guards';

export const dynamic = 'force-dynamic';

export default async function OwnerPage({ searchParams }: { searchParams?: Promise<{ seller?: string }> | { seller?: string } }) {
  const profile = await requireAdmin();
  const params = await Promise.resolve(searchParams ?? {});
  const selectedSellerId = typeof params.seller === 'string' ? params.seller : undefined;
  const { profiles, products, sellers, activeSeller, sellerConsignments, sellerItems, sellerStock, sellerSales, recentSales, messages, metrics } =
    await getAdminDashboardData(selectedSellerId);

  const userRows = profiles
    .filter((row) => row.role !== 'super_admin')
    .map((row) => [
      row.display_name ?? 'Sin nombre',
      row.email ?? '-',
      row.role,
      row.is_active ? 'Activo' : 'Inactivo',
      <div key={row.id} className="flex flex-wrap gap-2">
        <Link className="text-sm text-zinc-300 underline-offset-4 hover:underline" href={`/owner?seller=${row.id}`}>
          Ver ficha
        </Link>
        <ToggleUserStatusButton userId={row.id} isActive={row.is_active} />
        <ResetAccessButton userId={row.id} />
        {row.role === 'seller' ? <DeleteUserButton userId={row.id} /> : null}
      </div>,
    ]);

  return (
    <div className="space-y-8">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Vendedores" value={String(metrics.sellers)} />
        <KpiCard title="Productos" value={String(metrics.products)} />
        <KpiCard title="En poder del vendedor" value={formatCurrency(metrics.sellerStockValue)} hint={activeSeller?.display_name ?? 'Selecciona un vendedor'} />
        <KpiCard title="Pendiente por rendir" value={formatCurrency(metrics.sellerPendingValue)} hint={activeSeller?.display_name ?? 'Selecciona un vendedor'} />
      </section>

      <Card>
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <SellerFilterForm sellers={sellers.filter((row) => row.is_active)} value={activeSeller?.id} />
          <div className="grid gap-4 sm:grid-cols-3">
            <KpiCard title="Vendido" value={formatCurrency(metrics.sellerSoldValue)} />
            <KpiCard title="Rendido" value={formatCurrency(metrics.sellerRenderedValue)} />
            <KpiCard title="Stock actual" value={formatCurrency(metrics.sellerStockValue)} />
          </div>
        </div>
      </Card>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-xl font-semibold">Usuarios</h2>
          <InviteUserForm currentRole={profile.role} />
        </Card>
        <Card>
          <h2 className="mb-4 text-xl font-semibold">Productos</h2>
          <CreateProductForm />
        </Card>
        <Card>
          <h2 className="mb-4 text-xl font-semibold">Cargar stock</h2>
          <CreateConsignmentForm sellers={sellers.filter((row) => row.is_active)} products={products.filter((row) => row.is_active)} defaultSellerId={activeSeller?.id} />
        </Card>
        <Card>
          <h2 className="mb-4 text-xl font-semibold">Registrar rendición</h2>
          <CreateReconciliationForm consignments={sellerConsignments} items={sellerItems} />
        </Card>
        <Card>
          <h2 className="mb-4 text-xl font-semibold">Mensaje a vendedor</h2>
          <CreateMessageForm sellers={sellers.filter((row) => row.is_active)} defaultSellerId={activeSeller?.id} />
        </Card>
      </section>

      <Card>
        <h2 className="mb-4 text-xl font-semibold">Usuarios cargados</h2>
        <DataTable headers={['Nombre', 'Correo', 'Rol', 'Estado', 'Acciones']} rows={userRows} />
      </Card>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-xl font-semibold">Stock actual del vendedor</h2>
          <DataTable
            headers={['Producto', 'Asignado', 'Vendido', 'Devuelto', 'Stock', 'Valor actual']}
            rows={sellerStock.map((row) => [row.product_name, String(row.assigned), String(row.sold), String(row.returned), String(row.stock), formatCurrency(row.current_value)])}
          />
        </Card>
        <Card>
          <h2 className="mb-4 text-xl font-semibold">Ventas del vendedor</h2>
          <DataTable
            headers={['Pago', 'Fecha', 'Total']}
            rows={sellerSales.map((row) => [row.payment_method, new Date(row.sold_at).toLocaleString('es-CL'), formatCurrency(row.total)])}
          />
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-xl font-semibold">Ventas recientes</h2>
          <DataTable
            headers={['Vendedor', 'Pago', 'Fecha', 'Total']}
            rows={recentSales.map((row) => [row.seller_name, row.payment_method, new Date(row.sold_at).toLocaleString('es-CL'), formatCurrency(row.total)])}
          />
        </Card>
        <Card>
          <h2 className="mb-4 text-xl font-semibold">Mensajes recientes</h2>
          <DataTable
            headers={['Vendedor', 'Mensaje', 'Fecha']}
            rows={messages.map((row) => [profiles.find((profileRow) => profileRow.id === row.seller_id)?.display_name ?? row.seller_id, row.body, new Date(row.created_at).toLocaleString('es-CL')])}
          />
        </Card>
      </section>
    </div>
  );
}
