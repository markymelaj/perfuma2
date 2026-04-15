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
  const { consignments, items, stockLines, sales, reconciliations, messages, metrics } = await getSellerDashboardData(profile.id);

  return (
    <div className="space-y-6 pb-24">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Stock actual" value={String(metrics.currentUnits)} hint="Unidades disponibles" />
        <KpiCard title="Líneas de stock" value={String(metrics.stockLines)} />
        <KpiCard title="Vendido" value={formatCurrency(metrics.totalSold)} />
        <KpiCard title="Pendiente" value={formatCurrency(metrics.pendiente)} />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-xl font-semibold">Registrar venta</h2>
          <RecordSaleForm consignments={consignments.filter((row) => row.status === 'open')} items={items} />
        </Card>
        <Card>
          <h2 className="mb-4 text-xl font-semibold">Rendir caja</h2>
          <CreateReconciliationForm consignments={consignments.filter((row) => row.status === 'open')} items={items} />
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

      <Card>
        <h2 className="mb-4 text-xl font-semibold">Mi stock</h2>
        <DataTable
          headers={['Producto', 'Asignado', 'Vendido', 'Devuelto', 'Stock', 'Valor actual']}
          rows={stockLines.map((row) => [
            row.product_name,
            String(row.assigned),
            String(row.sold),
            String(row.returned),
            String(row.current),
            formatCurrency(row.current_value),
          ])}
        />
      </Card>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-xl font-semibold">Ventas recientes</h2>
          <DataTable
            headers={['Fecha', 'Producto', 'Cantidad', 'Pago', 'Monto']}
            rows={sales.slice(0, 20).map((row) => [
              new Date(row.sold_at).toLocaleString('es-CL'),
              row.product_name,
              String(row.quantity),
              row.payment_method,
              formatCurrency(row.amount),
            ])}
          />
        </Card>
        <Card>
          <h2 className="mb-4 text-xl font-semibold">Rendiciones</h2>
          <DataTable
            headers={['Fecha', 'Tipo', 'Monto', 'Notas']}
            rows={reconciliations.slice(0, 20).map((row) => [
              new Date(row.created_at).toLocaleString('es-CL'),
              row.type,
              formatCurrency(row.amount),
              row.notes ?? '-',
            ])}
          />
        </Card>
      </section>

      <Card>
        <h2 className="mb-4 text-xl font-semibold">Mensajes</h2>
        <DataTable
          headers={['Mensaje', 'Fecha']}
          rows={messages.map((row) => [row.body, new Date(row.created_at).toLocaleString('es-CL')])}
        />
      </Card>
    </div>
  );
}
