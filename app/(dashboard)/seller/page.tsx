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
  const { consignments, items, sales, reconciliations, messages, metrics, stockRows } = await getSellerDashboardData(profile.id);

  return (
    <div className="space-y-8">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Cuentas abiertas" value={String(metrics.openConsignments)} />
        <KpiCard title="Líneas de stock" value={String(metrics.stockLines)} />
        <KpiCard title="Vendidos" value={formatCurrency(metrics.totalSold)} />
        <KpiCard title="Pendiente por rendir" value={formatCurrency(metrics.pending)} />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-xl font-semibold">Registrar venta</h2>
          <RecordSaleForm consignments={consignments.filter((row) => row.status !== 'closed')} items={items} />
        </Card>
        <Card>
          <h2 className="mb-4 text-xl font-semibold">Registrar rendición</h2>
          <CreateReconciliationForm consignments={consignments.filter((row) => row.status !== 'closed')} items={items} />
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
            headers={['Producto', 'Asignado', 'Vendido', 'Devuelto', 'Stock', 'Valor']}
            rows={stockRows.map((row) => [row.product_name, String(row.assigned), String(row.sold), String(row.returned), String(row.stock), formatCurrency(row.current_value)])}
          />
        </Card>
        <Card>
          <h2 className="mb-4 text-xl font-semibold">Mensajes</h2>
          <DataTable headers={['Mensaje', 'Fecha']} rows={messages.map((row) => [row.body, new Date(row.created_at).toLocaleString('es-CL')])} />
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-xl font-semibold">Ventas recientes</h2>
          <DataTable headers={['Pago', 'Fecha', 'Cuenta']} rows={sales.map((row) => [row.payment_method, new Date(row.sold_at).toLocaleString('es-CL'), row.consignment_id.slice(0, 8)])} />
        </Card>
        <Card>
          <h2 className="mb-4 text-xl font-semibold">Rendiciones</h2>
          <DataTable
            headers={['Tipo', 'Fecha', 'Monto']}
            rows={reconciliations.map((row) => [row.type, new Date(row.created_at).toLocaleString('es-CL'), formatCurrency(Number(row.cash_received) + Number(row.transfer_received))])}
          />
        </Card>
      </section>
    </div>
  );
}
