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

  let consignmentId = '';
  const existing = await auth.admin
    .from('consignments')
    .select('id')
    .eq('seller_id', parsed.data.seller_id)
    .eq('status', 'open')
    .order('opened_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existing.error) {
    return NextResponse.json({ error: existing.error.message }, { status: 400 });
  }

  if (existing.data?.id) {
    consignmentId = existing.data.id;
  } else {
    const inserted = await auth.admin
      .from('consignments')
      .insert([{ seller_id: parsed.data.seller_id, opened_by: auth.profile.id, notes: parsed.data.notes || null }])
      .select('id')
      .single();
    if (inserted.error || !inserted.data) {
      return NextResponse.json({ error: inserted.error?.message ?? 'No se pudo crear la cuenta de stock' }, { status: 400 });
    }
    consignmentId = inserted.data.id;
  }

  const currentItem = await auth.admin
    .from('consignment_items')
    .select('id, quantity_assigned')
    .eq('consignment_id', consignmentId)
    .eq('product_id', parsed.data.product_id)
    .maybeSingle();

  if (currentItem.error) {
    return NextResponse.json({ error: currentItem.error.message }, { status: 400 });
  }

  if (currentItem.data?.id) {
    const nextQty = Number(currentItem.data.quantity_assigned) + Number(parsed.data.quantity_assigned);
    const updated = await auth.admin
      .from('consignment_items')
      .update({ quantity_assigned: nextQty, unit_sale_price: parsed.data.unit_sale_price })
      .eq('id', currentItem.data.id);
    if (updated.error) return NextResponse.json({ error: updated.error.message }, { status: 400 });
  } else {
    const item = await auth.admin.from('consignment_items').insert([
      {
        consignment_id: consignmentId,
        product_id: parsed.data.product_id,
        quantity_assigned: parsed.data.quantity_assigned,
        unit_sale_price: parsed.data.unit_sale_price,
      },
    ]);
    if (item.error) return NextResponse.json({ error: item.error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, consignmentId });
}
