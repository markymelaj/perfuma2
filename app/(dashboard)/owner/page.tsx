import { InviteUserForm } from '@/components/forms/invite-user-form';
import { CreateProductForm } from '@/components/forms/create-product-form';
import { CreateConsignmentForm } from '@/components/forms/create-consignment-form';
import { CreateReconciliationForm } from '@/components/forms/create-reconciliation-form';
import { CreateMessageForm } from '@/components/forms/create-message-form';
import { DeleteUserButton } from '@/components/forms/delete-user-button';
import { ResetAccessButton } from '@/components/forms/reset-access-button';
import { ToggleUserStatusButton } from '@/components/forms/toggle-user-status-button';
import { DataTable } from '@/components/shared/data-table';
import { KpiCard } from '@/components/shared/kpi-card';
import { SellerPicker } from '@/components/shared/seller-picker';
import { Card } from '@/components/ui/card';
import { requireAdmin } from '@/lib/auth/guards';
import { getAdminDashboardData } from '@/lib/server-data';
import { formatCurrency } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function OwnerPage({
  searchParams,
}: {
  searchParams?: Promise<{ seller?: string }> | { seller?: string };
}) {
  const profile = await requireAdmin();
  const resolvedSearchParams = (searchParams && 'then' in searchParams ? await searchParams : searchParams) ?? {};
  const selectedSellerId = resolvedSearchParams.seller;

  const { profiles, sellers, products, selectedSeller, recentSales, recentReconciliations, metrics } =
    await getAdminDashboardData(selectedSellerId);

  const sellerRows = profiles
    .filter((row) => row.role === 'seller')
    .map((row) => [
      row.display_name ?? 'Sin nombre',
      row.email ?? '-',
      row.role,
      row.is_active ? 'Activo' : 'Inactivo',
      <div key={row.id} className="flex flex-wrap gap-2">
        <a className="rounded-full border border-zinc-800 px-3 py-2 text-sm text-zinc-300" href={`/owner?seller=${row.id}`}>
          Ver ficha
        </a>
        <ToggleUserStatusButton actorId={profile.id} isActive={row.is_active} userId={row.id} />
        <ResetAccessButton actorId={profile.id} userId={row.id} />
        <DeleteUserButton actorId={profile.id} userId={row.id} />
      </div>,
    ]);

  return (
    <div className="space-y-8">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Vendedores activos" value={String(metrics.sellers)} />
        <KpiCard title="Productos activos" value={String(metrics.products)} />
        <KpiCard title="Stock valorizado" value={formatCurrency(metrics.stockValue)} />
        <KpiCard title="Pendiente por rendir" value={formatCurrency(metrics.pendiente)} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <h2 className="mb-4 text-xl font-semibold">Seleccionar vendedor</h2>
          <SellerPicker
            sellers={sellers.map((seller) => ({
              id: seller.id,
              label: seller.display_name ?? seller.email ?? 'Sin nombre',
            }))}
            value={selectedSeller?.seller.id}
          />

          {selectedSeller ? (
            <div className="mt-6 grid gap-3 md:grid-cols-2">
              <KpiCard title="Stock actual" value={formatCurrency(selectedSeller.financials.stock_value)} />
              <KpiCard title="Vendido acumulado" value={formatCurrency(selectedSeller.financials.sold_value)} />
              <KpiCard title="Rendido acumulado" value={formatCurrency(selectedSeller.financials.rendido_value)} />
              <KpiCard title="Pendiente" value={formatCurrency(selectedSeller.financials.pendiente_value)} />
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-zinc-800 bg-black p-4 text-sm text-zinc-400">
              Selecciona un vendedor para ver su stock, ventas, rendiciones y saldo pendiente.
            </div>
          )}
        </Card>

        <Card>
          <h2 className="mb-4 text-xl font-semibold">Stock actual del vendedor</h2>
          {selectedSeller ? (
            <DataTable
              headers={['Producto', 'Asignado', 'Vendido', 'Devuelto', 'Stock', 'Valor actual']}
              rows={
                selectedSeller.stock_lines.length
                  ? selectedSeller.stock_lines.map((line) => [
                      line.product_name,
                      String(line.quantity_assigned),
                      String(line.quantity_sold),
                      String(line.quantity_returned),
                      String(line.quantity_current),
                      formatCurrency(line.current_value),
                    ])
                  : [['Sin stock', '-', '-', '-', '-', '-']]
              }
            />
          ) : (
            <div className="text-sm text-zinc-500">Sin vendedor seleccionado.</div>
          )}
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-xl font-semibold">Cargar stock</h2>
          <CreateConsignmentForm
            actorId={profile.id}
            defaultSellerId={selectedSeller?.seller.id}
            products={products}
            sellers={sellers}
          />
        </Card>
        <Card>
          <h2 className="mb-4 text-xl font-semibold">Registrar rendición</h2>
          <CreateReconciliationForm
            actorId={profile.id}
            defaultSellerId={selectedSeller?.seller.id}
            selectedSeller={selectedSeller}
            sellers={sellers}
          />
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-xl font-semibold">Producto nuevo</h2>
          <CreateProductForm actorId={profile.id} />
        </Card>
        <Card>
          <h2 className="mb-4 text-xl font-semibold">Mensaje a vendedor</h2>
          <CreateMessageForm actorId={profile.id} defaultSellerId={selectedSeller?.seller.id} sellers={sellers} />
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-xl font-semibold">Ventas del vendedor</h2>
          {selectedSeller ? (
            <DataTable
              headers={['Fecha', 'Pago', 'Productos', 'Total']}
              rows={
                selectedSeller.recent_sales.length
                  ? selectedSeller.recent_sales.map((sale) => [
                      new Date(sale.sold_at).toLocaleString('es-CL'),
                      sale.payment_method,
                      sale.product_names.join(', '),
                      formatCurrency(sale.total),
                    ])
                  : [['Sin registros', '-', '-', '-']]
              }
            />
          ) : (
            <div className="text-sm text-zinc-500">Sin vendedor seleccionado.</div>
          )}
        </Card>

        <Card>
          <h2 className="mb-4 text-xl font-semibold">Rendiciones del vendedor</h2>
          {selectedSeller ? (
            <DataTable
              headers={['Fecha', 'Tipo', 'Efectivo', 'Transferencia', 'Total']}
              rows={
                selectedSeller.recent_reconciliations.length
                  ? selectedSeller.recent_reconciliations.map((row) => [
                      new Date(row.created_at).toLocaleString('es-CL'),
                      row.type,
                      formatCurrency(row.cash_received),
                      formatCurrency(row.transfer_received),
                      formatCurrency(row.total_received),
                    ])
                  : [['Sin registros', '-', '-', '-', '-']]
              }
            />
          ) : (
            <div className="text-sm text-zinc-500">Sin vendedor seleccionado.</div>
          )}
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-xl font-semibold">Ventas recientes</h2>
          <DataTable
            headers={['Vendedor', 'Pago', 'Fecha', 'Total']}
            rows={
              recentSales.length
                ? recentSales.map((sale) => [
                    sale.seller_name,
                    sale.payment_method,
                    new Date(sale.sold_at).toLocaleString('es-CL'),
                    formatCurrency(sale.total),
                  ])
                : [['Sin registros', '-', '-', '-']]
            }
          />
        </Card>
        <Card>
          <h2 className="mb-4 text-xl font-semibold">Usuarios</h2>
          <InviteUserForm actorId={profile.id} currentRole={profile.role} />
          <div className="mt-6">
            <DataTable headers={['Nombre', 'Correo', 'Rol', 'Estado', 'Acciones']} rows={sellerRows} />
          </div>
        </Card>
      </section>
    </div>
  );
}
