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
  const { snapshot, metrics } = await getSellerDashboardData(profile.id);

  return (
    <div className="space-y-8">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Stock actual" value={formatCurrency(metrics.stock_value)} />
        <KpiCard title="Vendido" value={formatCurrency(metrics.sold_value)} />
        <KpiCard title="Rendido" value={formatCurrency(metrics.rendido_value)} />
        <KpiCard title="Pendiente por rendir" value={formatCurrency(metrics.pendiente_value)} />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-xl font-semibold">Registrar venta</h2>
          <RecordSaleForm actorId={profile.id} snapshot={snapshot} />
        </Card>
        <Card>
          <h2 className="mb-4 text-xl font-semibold">Rendir caja</h2>
          <CreateReconciliationForm
            actorId={profile.id}
            defaultSellerId={profile.id}
            isSellerView
            selectedSeller={snapshot}
            sellers={[profile]}
          />
        </Card>
        <Card>
          <h2 className="mb-4 text-xl font-semibold">Enviar ubicación</h2>
          <SendLocationForm actorId={profile.id} />
        </Card>
        <Card>
          <h2 className="mb-4 text-xl font-semibold">Mensaje al dueño</h2>
          <CreateMessageForm actorId={profile.id} />
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-xl font-semibold">Mi stock</h2>
          <DataTable
            headers={['Producto', 'Asignado', 'Vendido', 'Devuelto', 'Stock', 'Valor actual']}
            rows={
              snapshot?.stock_lines.length
                ? snapshot.stock_lines.map((line) => [
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
        </Card>
        <Card>
          <h2 className="mb-4 text-xl font-semibold">Mensajes</h2>
          <DataTable
            headers={['Mensaje', 'Fecha']}
            rows={
              snapshot?.messages.length
                ? snapshot.messages.map((row) => [row.body, new Date(row.created_at).toLocaleString('es-CL')])
                : [['Sin mensajes', '-']]
            }
          />
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-xl font-semibold">Ventas recientes</h2>
          <DataTable
            headers={['Pago', 'Fecha', 'Productos', 'Total']}
            rows={
              snapshot?.recent_sales.length
                ? snapshot.recent_sales.map((row) => [
                    row.payment_method,
                    new Date(row.sold_at).toLocaleString('es-CL'),
                    row.product_names.join(', '),
                    formatCurrency(row.total),
                  ])
                : [['Sin registros', '-', '-', '-']]
            }
          />
        </Card>
        <Card>
          <h2 className="mb-4 text-xl font-semibold">Rendiciones</h2>
          <DataTable
            headers={['Tipo', 'Fecha', 'Total']}
            rows={
              snapshot?.recent_reconciliations.length
                ? snapshot.recent_reconciliations.map((row) => [
                    row.type,
                    new Date(row.created_at).toLocaleString('es-CL'),
                    formatCurrency(row.total_received),
                  ])
                : [['Sin registros', '-', '-']]
            }
          />
        </Card>
      </section>
    </div>
  );
}
