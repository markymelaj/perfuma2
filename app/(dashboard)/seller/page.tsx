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
  const { consignments, items, sales, reconciliations, messages, metrics } =
    await getSellerDashboardData(profile.id);

  return (
    <div className="space-y-8">
      <section className="grid gap-4 grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Consignaciones abiertas" value={String(metrics.openConsignments)} />
        <KpiCard title="Líneas de stock" value={String(metrics.stockLines)} />
        <KpiCard title="Vendido" value={formatCurrency(metrics.totalSold)} />
        <KpiCard title="Pendiente por rendir" value={formatCurrency(metrics.pendiente)} />
      </section>

      <section className="-mx-1 overflow-x-auto pb-1 md:hidden">
        <div className="flex gap-2 px-1">
          {[
            ['#venta', 'Venta'],
            ['#rendir', 'Rendir'],
            ['#ubicacion', 'Ubicación'],
            ['#mensajes', 'Mensajes'],
            ['#stock', 'Stock'],
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
        <Card id="venta">
          <h2 className="mb-4 text-xl font-semibold">Registrar venta</h2>
          <RecordSaleForm currentActorId={profile.id} consignments={consignments} items={items} />
        </Card>
        <Card id="rendir">
          <h2 className="mb-4 text-xl font-semibold">Rendir caja</h2>
          <CreateReconciliationForm currentActorId={profile.id} consignments={consignments} items={items} />
        </Card>
        <Card id="ubicacion">
          <h2 className="mb-4 text-xl font-semibold">Enviar ubicación</h2>
          <SendLocationForm currentActorId={profile.id} />
        </Card>
        <Card id="mensajes">
          <h2 className="mb-4 text-xl font-semibold">Mensaje al dueño</h2>
          <CreateMessageForm currentActorId={profile.id} />
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card id="stock">
          <h2 className="mb-4 text-xl font-semibold">Mi stock</h2>
          <DataTable
            headers={['Producto', 'Cantidad asignada', 'Precio venta']}
            rows={items.map((row) => [
              row.products?.name ?? row.product_id,
              String(row.quantity_assigned),
              formatCurrency(Number(row.unit_sale_price)),
            ])}
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
            rows={(
              sales as Array<{ payment_method: string; sold_at: string; consignment_id: string }>
            ).map((row) => [row.payment_method, new Date(row.sold_at).toLocaleString('es-CL'), row.consignment_id])}
          />
        </Card>
        <Card>
          <h2 className="mb-4 text-xl font-semibold">Rendiciones</h2>
          <DataTable
            headers={['Tipo', 'Fecha', 'Monto']}
            rows={(
              reconciliations as Array<{
                type: string;
                created_at: string;
                cash_received: number | string;
                transfer_received: number | string;
              }>
            ).map((row) => [
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
