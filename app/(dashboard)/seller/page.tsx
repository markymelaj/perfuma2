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
  const { consignments, items, sales, reconciliations, messages, metrics } = await getSellerDashboardData(profile.id);

  return (
    <div className="space-y-8">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Consignaciones abiertas" value={String(metrics.openConsignments)} />
        <KpiCard title="Líneas de stock" value={String(metrics.stockLines)} />
        <KpiCard title="Vendido" value={formatCurrency(metrics.totalSold)} />
        <KpiCard title="Pendiente por rendir" value={formatCurrency(metrics.pendiente)} />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-xl font-semibold">Registrar venta</h2>
          <RecordSaleForm consignments={consignments} items={items} />
        </Card>
        <Card>
          <h2 className="mb-4 text-xl font-semibold">Rendir caja</h2>
          <CreateReconciliationForm consignments={consignments} items={items} />
        </Card>
        <Card>
          <h2 className="mb-4 text-xl font-semibold">Enviar ubicación</h2>
          <SendLocationForm />
        </Card>
        <Card>
          <h2 className="mb-4 text-xl font-semibold">Mensaje al dueño</h2>
          <CreateMessageForm />
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-xl font-semibold">Mi stock</h2>
          <DataTable
            headers={['Producto', 'Cantidad asignada', 'Precio venta']}
            rows={items.map((row) => [row.products?.name ?? row.product_id, String(row.quantity_assigned), formatCurrency(Number(row.unit_sale_price))])}
          />
        </Card>
        <Card>
          <h2 className="mb-4 text-xl font-semibold">Mensajes</h2>
          <DataTable
            headers={['Mensaje', 'Fecha']}
            rows={messages.map((row) => [row.body, new Date(row.created_at).toLocaleString('es-CL')])}
          />
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-xl font-semibold">Ventas recientes</h2>
          <DataTable
            headers={['Pago', 'Fecha', 'Consignación']}
            rows={(sales as Array<{ payment_method: string; sold_at: string; consignment_id: string }>).map((row) => [row.payment_method, new Date(row.sold_at).toLocaleString('es-CL'), row.consignment_id])}
          />
        </Card>
        <Card>
          <h2 className="mb-4 text-xl font-semibold">Rendiciones</h2>
          <DataTable
            headers={['Tipo', 'Fecha', 'Monto']}
            rows={(reconciliations as Array<{ type: string; created_at: string; cash_received: number | string; transfer_received: number | string }>).map((row) => [
              row.type,
              new Date(row.created_at).toLocaleString('es-CL'),
              formatCurrency(Number(row.cash_received) + Number(row.transfer_received)),
            ])}
          />
        </Card>
      </section>
    </div>
  );
}
