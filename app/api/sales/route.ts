import { NextResponse } from 'next/server';
import { saleSchema } from '@/lib/validators';
import { requireApiProfile } from '@/lib/auth/api-guards';

export async function POST(request: Request) {
  const auth = await requireApiProfile(request);
  if ('response' in auth) return auth.response;

  const json = await request.json();
  const parsed = saleSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }, { status: 400 });
  }

  const itemInfo = await auth.admin
    .from('consignment_items')
    .select('id, consignment_id, unit_sale_price')
    .eq('id', parsed.data.consignment_item_id)
    .single();

  if (itemInfo.error || !itemInfo.data) {
    return NextResponse.json({ error: itemInfo.error?.message ?? 'No se encontró el ítem de stock' }, { status: 400 });
  }

  const consignment = await auth.admin
    .from('consignments')
    .select('id, seller_id, status')
    .eq('id', itemInfo.data.consignment_id)
    .single();

  if (consignment.error || !consignment.data) {
    return NextResponse.json({ error: consignment.error?.message ?? 'No se encontró la cuenta de stock' }, { status: 400 });
  }

  if (auth.profile.role === 'seller' && consignment.data.seller_id !== auth.profile.id) {
    return NextResponse.json({ error: 'No puedes vender stock de otro vendedor' }, { status: 403 });
  }

  const sale = await auth.admin
    .from('sales')
    .insert([
      {
        consignment_id: consignment.data.id,
        payment_method: parsed.data.payment_method,
        notes: parsed.data.notes || null,
        created_by: auth.profile.id,
      },
    ])
    .select('id')
    .single();

  if (sale.error || !sale.data) {
    return NextResponse.json({ error: sale.error?.message ?? 'No se pudo crear la venta' }, { status: 400 });
  }

  const line = await auth.admin.from('sales_items').insert([
    {
      sale_id: sale.data.id,
      consignment_item_id: parsed.data.consignment_item_id,
      quantity: parsed.data.quantity,
      unit_sale_price: itemInfo.data.unit_sale_price,
    },
  ]);

  if (line.error) {
    return NextResponse.json({ error: line.error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
