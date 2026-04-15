import Link from 'next/link';
import { InviteUserForm } from '@/components/forms/invite-user-form';
import { CreateProductForm } from '@/components/forms/create-product-form';
import { CreateConsignmentForm } from '@/components/forms/create-consignment-form';
import { CreateReconciliationForm } from '@/components/forms/create-reconciliation-form';
import { CreateMessageForm } from '@/components/forms/create-message-form';
import { SellerFilter } from '@/components/forms/seller-filter';
import { DeleteUserButton } from '@/components/forms/delete-user-button';
import { ToggleUserStatusButton } from '@/components/forms/toggle-user-status-button';
import { ResetAccessButton } from '@/components/forms/reset-access-button';
import { DataTable } from '@/components/shared/data-table';
import { KpiCard } from '@/components/shared/kpi-card';
import { Card } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';
import { getAdminDashboardData } from '@/lib/server-data';
import { requireAdmin } from '@/lib/auth/guards';

export const dynamic = 'force-dynamic';

export default async function OwnerPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const profile = await requireAdmin();
  const params = (await searchParams) ?? {};
  const selectedSellerParam = typeof params.seller === 'string' ? params.seller : undefined;
  const { sellers, products, selectedSellerId, sellerAccount, recentSales, metrics } = await getAdminDashboardData(selectedSellerParam);

  const sellerRows = sellers.map((row) => [
    row.display_name ?? 'Sin nombre',
    row.email ?? '-',
    row.role,
    row.is_active ? 'Activo' : 'Inactivo',
    <div key={row.id} className="flex flex-wrap gap-2">
      <Link className="text-sm underline underline-offset-4" href={`/owner?seller=${row.id}`}>Ver ficha</Link>
      <ToggleUserStatusButton actorId={profile.id} userId={row.id} isActive={row.is_active} />
      <ResetAccessButton actorId={profile.id} userId={row.id} />
      <DeleteUserButton actorId={profile.id} userId={row.id} />
    </div>,
  ]);

  const sellerName = sellerAccount.seller?.display_name ?? sellerAccount.seller?.email ?? 'Sin vendedor';

  return (
    <div className="space-y-8">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Vendedores" value={String(metrics.sellers)} />
        <KpiCard title="Productos" value={String(metrics.products)} />
        <KpiCard title="Pendiente del vendedor" value={formatCurrency(sellerAccount.financial.pendingTotal)} />
        <KpiCard title="Stock valorizado actual" value={formatCurrency(sellerAccount.financial.stockCurrentValue)} />
      </section>

      <Card className="space-y-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <div className="text-sm uppercase tracking-wide text-zinc-500">Seguimiento central</div>
            <h2 className="text-2xl font-semibold text-white">Ficha del vendedor</h2>
          </div>
          <div className="grid gap-3 md:min-w-[320px]">
            <SellerFilter sellers={sellers.filter((row) => row.is_active)} selectedSellerId={selectedSellerId} />
            <Link href="#usuarios" className="text-sm text-zinc-400 underline underline-offset-4">+ Crear vendedor nuevo</Link>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard title="Vendido acumulado" value={formatCurrency(sellerAccount.financial.soldTotal)} />
          <KpiCard title="Rendido acumulado" value={formatCurrency(sellerAccount.financial.renderedTotal)} />
          <KpiCard title="Pendiente por rendir" value={formatCurrency(sellerAccount.financial.pendingTotal)} />
          <KpiCard title="Stock valorizado actual" value={formatCurrency(sellerAccount.financial.stockCurrentValue)} />
        </div>
      </Card>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-2xl font-semibold">Cargar stock</h2>
          <CreateConsignmentForm actorId={profile.id} seller={sellerAccount.seller} products={products} />
        </Card>

        <Card>
          <h2 className="mb-4 text-2xl font-semibold">Registrar rendición</h2>
          <CreateReconciliationForm
            actorId={profile.id}
            consignmentId={sellerAccount.activeConsignment?.id ?? null}
            summary={sellerAccount.financial}
            stockLines={sellerAccount.stockLines}
          />
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-2xl font-semibold">Stock actual de {sellerName}</h2>
          <DataTable
            headers={['Producto', 'Asignado', 'Vendido', 'Devuelto', 'Stock', 'Valor actual']}
            rows={sellerAccount.stockLines.map((line) => [
              line.product_name,
              String(line.quantity_assigned),
              String(line.quantity_sold),
              String(line.quantity_returned),
              String(line.quantity_current),
              formatCurrency(line.current_value),
            ])}
          />
        </Card>

        <Card>
          <h2 className="mb-4 text-2xl font-semibold">Ventas de {sellerName}</h2>
          <DataTable
            headers={['Productos', 'Pago', 'Fecha', 'Total']}
            rows={sellerAccount.sales.map((sale) => [
              sale.product_names.join(', '),
              sale.payment_method,
              new Date(sale.sold_at).toLocaleString('es-CL'),
              formatCurrency(sale.total_value),
            ])}
          />
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-2xl font-semibold">Rendiciones de {sellerName}</h2>
          <DataTable
            headers={['Tipo', 'Fecha', 'Monto', 'Devoluciones']}
            rows={sellerAccount.reconciliations.map((row) => [
              row.type,
              new Date(row.created_at).toLocaleString('es-CL'),
              formatCurrency(row.total_received),
              row.return_items.length ? row.return_items.map((item) => `${item.product_name} (${item.quantity})`).join(', ') : 'Sin devolución',
            ])}
          />
        </Card>

        <Card>
          <h2 className="mb-4 text-2xl font-semibold">Mensaje a vendedor</h2>
          <CreateMessageForm actorId={profile.id} sellers={sellers.filter((row) => row.is_active)} defaultSellerId={selectedSellerId} />
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-2xl font-semibold">Últimas ventas</h2>
          <DataTable
            headers={['Vendedor', 'Pago', 'Fecha', 'Total']}
            rows={recentSales.map((sale) => [
              sale.seller_name,
              sale.payment_method,
              new Date(sale.sold_at).toLocaleString('es-CL'),
              formatCurrency(sale.total),
            ])}
          />
        </Card>

        <Card>
          <h2 className="mb-4 text-2xl font-semibold">Crear producto</h2>
          <CreateProductForm actorId={profile.id} />
        </Card>
      </section>

      <Card id="usuarios">
        <h2 className="mb-4 text-2xl font-semibold">Usuarios cargados</h2>
        <div className="mb-6"><InviteUserForm currentRole={profile.role} actorId={profile.id} /></div>
        <DataTable headers={['Nombre', 'Correo', 'Rol', 'Estado', 'Acciones']} rows={sellerRows} />
      </Card>
    </div>
  );
}
