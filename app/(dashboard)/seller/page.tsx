import { CreateMessageForm } from '@/components/forms/create-message-form';
import { CreateReconciliationForm } from '@/components/forms/create-reconciliation-form';
import { RecordSaleForm } from '@/components/forms/record-sale-form';
import { SendLocationForm } from '@/components/forms/send-location-form';
import { DataTable } from '@/components/shared/data-table';
import { KpiCard } from '@/components/shared/kpi-card';
import { Card } from '@/components/ui/card';
import { requireSeller } from '@/lib/auth/guards';
import { getSellerDashboardData } from '@/lib/server-data';
import { formatCurrency } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function SellerPage() {
  const profile = await requireSeller();
  const { sellerAccount, metrics } = await getSellerDashboardData(profile.id);

  return (
    <div className="space-y-8">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Stock valorizado actual" value={formatCurrency(metrics.stockCurrentValue)} />
        <KpiCard title="Vendido acumulado" value={formatCurrency(metrics.totalSold)} />
        <KpiCard title="Rendido acumulado" value={formatCurrency(metrics.totalRendido)} />
        <KpiCard title="Pendiente por rendir" value={formatCurrency(metrics.pendiente)} />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-2xl font-semibold">Registrar venta</h2>
          <RecordSaleForm actorId={profile.id} consignmentId={sellerAccount.activeConsignment?.id ?? null} stockLines={sellerAccount.stockLines} />
        </Card>
        <Card>
          <h2 className="mb-4 text-2xl font-semibold">Rendir caja</h2>
          <CreateReconciliationForm actorId={profile.id} consignmentId={sellerAccount.activeConsignment?.id ?? null} summary={sellerAccount.financial} stockLines={sellerAccount.stockLines} />
        </Card>
        <Card>
          <h2 className="mb-4 text-2xl font-semibold">Enviar ubicación</h2>
          <SendLocationForm actorId={profile.id} />
        </Card>
        <Card>
          <h2 className="mb-4 text-2xl font-semibold">Mensaje al dueño</h2>
          <CreateMessageForm actorId={profile.id} />
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-2xl font-semibold">Mi stock</h2>
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
          <h2 className="mb-4 text-2xl font-semibold">Mensajes</h2>
          <DataTable
            headers={['Mensaje', 'Fecha']}
            rows={sellerAccount.messages.map((row) => [row.body, new Date(row.created_at).toLocaleString('es-CL')])}
          />
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-2xl font-semibold">Ventas recientes</h2>
          <DataTable
            headers={['Productos', 'Pago', 'Fecha', 'Total']}
            rows={sellerAccount.sales.map((row) => [
              row.product_names.join(', '),
              row.payment_method,
              new Date(row.sold_at).toLocaleString('es-CL'),
              formatCurrency(row.total_value),
            ])}
          />
        </Card>
        <Card>
          <h2 className="mb-4 text-2xl font-semibold">Rendiciones</h2>
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
      </section>
    </div>
  );
}
