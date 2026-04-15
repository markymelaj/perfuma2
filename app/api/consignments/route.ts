import { NextResponse } from 'next/server';
import { consignmentSchema } from '@/lib/validators';
import { requireApiAdmin } from '@/lib/auth/api-guards';

export async function POST(request: Request) {
  const auth = await requireApiAdmin(request);
  if ('response' in auth) return auth.response;

  const json = await request.json();
  const parsed = consignmentSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }, { status: 400 });
  }

  const activeConsignmentRes = await auth.admin
    .from('consignments')
    .select('id')
    .eq('seller_id', parsed.data.seller_id)
    .in('status', ['open', 'partially_reconciled'])
    .order('opened_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let consignmentId = activeConsignmentRes.data?.id ?? '';

  if (!consignmentId) {
    const inserted = await auth.admin
      .from('consignments')
      .insert([
        {
          seller_id: parsed.data.seller_id,
          opened_by: auth.profile.id,
          notes: parsed.data.notes || null,
        },
      ])
      .select('id')
      .single();

    if (inserted.error || !inserted.data) {
      return NextResponse.json({ error: inserted.error?.message ?? 'No se pudo abrir la cuenta de stock' }, { status: 400 });
    }

    consignmentId = inserted.data.id;
  }

  const existingItem = await auth.admin
    .from('consignment_items')
    .select('id, quantity_assigned, unit_sale_price')
    .eq('consignment_id', consignmentId)
    .eq('product_id', parsed.data.product_id)
    .maybeSingle();

  if (existingItem.data) {
    const currentQty = Number(existingItem.data.quantity_assigned) || 0;
    const currentPrice = Number(existingItem.data.unit_sale_price) || 0;
    const newQty = parsed.data.quantity_assigned;
    const newPrice = parsed.data.unit_sale_price;
    const mergedQty = currentQty + newQty;
    const mergedPrice = mergedQty > 0 ? ((currentQty * currentPrice) + (newQty * newPrice)) / mergedQty : newPrice;

    const updated = await auth.admin
      .from('consignment_items')
      .update({
        quantity_assigned: mergedQty,
        unit_sale_price: mergedPrice,
      })
      .eq('id', existingItem.data.id);

    if (updated.error) {
      return NextResponse.json({ error: updated.error.message }, { status: 400 });
    }
  } else {
    const item = await auth.admin.from('consignment_items').insert([
      {
        consignment_id: consignmentId,
        product_id: parsed.data.product_id,
        quantity_assigned: parsed.data.quantity_assigned,
        unit_sale_price: parsed.data.unit_sale_price,
      },
    ]);

    if (item.error) {
      return NextResponse.json({ error: item.error.message }, { status: 400 });
    }
  }

  return NextResponse.json({ ok: true, consignmentId });
}
