import { InviteUserForm } from '@/components/forms/invite-user-form';
import { CreateProductForm } from '@/components/forms/create-product-form';
import { SellerFocusForm } from '@/components/forms/seller-focus-form';
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

export default async function OwnerPage({
  searchParams,
}: {
  searchParams?: Promise<{ seller?: string }>;
}) {
  const profile = await requireAdmin();
  const params = (await searchParams) ?? {};
  const { profiles, products, consignments, items, sellerOverviews, selectedSeller, metrics } =
    await getAdminDashboardData(params.seller);

  const sellers = profiles.filter((row) => row.role === 'seller' && row.is_active);
  const selectedConsignments = selectedSeller
    ? consignments.filter((row) => row.seller_id === selectedSeller.profile.id)
    : [];
  const selectedItems = selectedSeller
    ? items.filter((row) => row.consignment_id === selectedSeller.openConsignmentId)
    : [];

  const userRows = profiles
    .filter((row) => row.role !== 'super_admin')
    .map((row) => [
      row.display_name ?? row.username ?? row.email ?? 'Sin nombre',
      row.username ?? '-',
      row.role,
      row.is_active ? 'Activo' : 'Inactivo',
      <div key={row.id} className="flex flex-wrap gap-2">
        <ToggleUserStatusButton userId={row.id} isActive={row.is_active} currentAdminId={profile.id} />
        <ResetAccessButton userId={row.id} currentAdminId={profile.id} />
      </div>,
    ]);

  return (
    <div className="space-y-6 pb-24">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Vendedores" value={String(metrics.sellers)} hint="Usuarios de venta activos" />
        <KpiCard title="Productos" value={String(metrics.products)} hint="Catálogo operativo" />
        <KpiCard title="Con stock activo" value={String(metrics.activeSellersWithStock)} hint="Vendedores con mercadería" />
        <KpiCard title="Pendiente por rendir" value={formatCurrency(metrics.pendiente)} hint="Venta acumulada menos rendido" />
      </section>

      <Card className="space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-2xl font-semibold">Cuenta del vendedor</h2>
            <p className="mt-1 text-sm text-zinc-500">Selecciona un vendedor para ver stock, ventas, rendiciones y saldo pendiente en tiempo real.</p>
          </div>
          <SellerFocusForm
            options={sellerOverviews.map((seller) => ({ id: seller.seller_id, label: seller.seller_name }))}
            value={selectedSeller?.profile.id ?? sellerOverviews[0]?.seller_id ?? ''}
          />
        </div>

        {selectedSeller ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard title="Stock actual" value={String(selectedSeller.overview.current_units)} hint="Unidades disponibles" />
              <KpiCard title="Vendido" value={formatCurrency(selectedSeller.overview.sold_amount)} hint={`${selectedSeller.overview.sold_units} unidades`} />
              <KpiCard title="Rendido" value={formatCurrency(selectedSeller.overview.rendido_amount)} hint="Caja recibida" />
              <KpiCard title="Pendiente" value={formatCurrency(selectedSeller.overview.pendiente_amount)} hint="Lo que aún debe rendir" />
            </div>

            <DataTable
              headers={['Producto', 'Asignado', 'Vendido', 'Devuelto', 'Stock', 'Valor actual']}
              rows={selectedSeller.stockLines.map((row) => [
                row.product_name,
                String(row.assigned),
                String(row.sold),
                String(row.returned),
                String(row.current),
                formatCurrency(row.current_value),
              ])}
            />
          </>
        ) : (
          <div className="text-sm text-zinc-500">No hay vendedores cargados.</div>
        )}
      </Card>

      <section className="grid gap-6 xl:grid-cols-2" id="acciones">
        <Card id="stock">
          <h2 className="mb-4 text-xl font-semibold">Cargar stock</h2>
          <CreateConsignmentForm sellers={sellers} products={products} currentAdminId={profile.id} />
        </Card>

        <Card id="caja">
          <h2 className="mb-4 text-xl font-semibold">Registrar rendición</h2>
          <CreateReconciliationForm consignments={selectedConsignments} items={selectedItems} currentAdminId={profile.id} />
        </Card>

        <Card id="productos">
          <h2 className="mb-4 text-xl font-semibold">Productos</h2>
          <CreateProductForm currentAdminId={profile.id} />
        </Card>

        <Card id="usuarios">
          <h2 className="mb-4 text-xl font-semibold">Alta de usuario</h2>
          <InviteUserForm currentRole={profile.role} currentAdminId={profile.id} />
        </Card>

        <Card className="xl:col-span-2" id="mensajes">
          <h2 className="mb-4 text-xl font-semibold">Mensaje a vendedor</h2>
          <CreateMessageForm sellers={sellers} currentAdminId={profile.id} />
        </Card>
      </section>

      <Card>
        <h2 className="mb-4 text-xl font-semibold">Usuarios cargados</h2>
        <DataTable headers={['Nombre', 'Usuario', 'Rol', 'Estado', 'Acciones']} rows={userRows} />
      </Card>

      {selectedSeller ? (
        <section className="grid gap-6 xl:grid-cols-2">
          <Card>
            <h2 className="mb-4 text-xl font-semibold">Ventas recientes</h2>
            <DataTable
              headers={['Fecha', 'Producto', 'Cantidad', 'Pago', 'Monto']}
              rows={selectedSeller.sales.map((row) => [
                new Date(row.sold_at).toLocaleString('es-CL'),
                row.product_name,
                String(row.quantity),
                row.payment_method,
                formatCurrency(row.amount),
              ])}
            />
          </Card>
          <Card>
            <h2 className="mb-4 text-xl font-semibold">Rendiciones recientes</h2>
            <DataTable
              headers={['Fecha', 'Tipo', 'Monto', 'Notas']}
              rows={selectedSeller.reconciliations.map((row) => [
                new Date(row.created_at).toLocaleString('es-CL'),
                row.type,
                formatCurrency(row.amount),
                row.notes ?? '-',
              ])}
            />
          </Card>
        </section>
      ) : null}
    </div>
  );
}
