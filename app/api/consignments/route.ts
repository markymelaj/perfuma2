import { NextResponse } from 'next/server';
import { consignmentSchema } from '@/lib/validators';
import { requireApiAdmin } from '@/lib/auth/api-guards';
import { toNumber } from '@/lib/utils';

export async function POST(request: Request) {
  const auth = await requireApiAdmin(request);
  if ('response' in auth) return auth.response;

  const json = await request.json();
  const parsed = consignmentSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }, { status: 400 });
  }

  let consignmentId: string | null = null;

  const openConsignment = await auth.admin
    .from('consignments')
    .select('id')
    .eq('seller_id', parsed.data.seller_id)
    .eq('status', 'open')
    .order('opened_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (openConsignment.error) {
    return NextResponse.json({ error: openConsignment.error.message }, { status: 400 });
  }

  if (openConsignment.data?.id) {
    consignmentId = openConsignment.data.id;
  } else {
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
      return NextResponse.json({ error: inserted.error?.message ?? 'No se pudo crear la cuenta de stock' }, { status: 400 });
    }

    consignmentId = inserted.data.id;
  }

  const existingItem = await auth.admin
    .from('consignment_items')
    .select('id, quantity_assigned, unit_sale_price')
    .eq('consignment_id', consignmentId)
    .eq('product_id', parsed.data.product_id)
    .maybeSingle();

  if (existingItem.error) {
    return NextResponse.json({ error: existingItem.error.message }, { status: 400 });
  }

  if (existingItem.data?.id) {
    const currentQty = toNumber(existingItem.data.quantity_assigned);
    const currentPrice = toNumber(existingItem.data.unit_sale_price);
    const incomingQty = parsed.data.quantity_assigned;
    const incomingPrice = parsed.data.unit_sale_price;
    const nextQty = currentQty + incomingQty;
    const weightedPrice = nextQty > 0 ? ((currentQty * currentPrice) + (incomingQty * incomingPrice)) / nextQty : incomingPrice;

    const updated = await auth.admin
      .from('consignment_items')
      .update({
        quantity_assigned: nextQty,
        unit_sale_price: Number(weightedPrice.toFixed(2)),
      })
      .eq('id', existingItem.data.id);

    if (updated.error) {
      return NextResponse.json({ error: updated.error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, consignmentId, consignmentItemId: existingItem.data.id, accumulated: true });
  }

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

  return NextResponse.json({ ok: true, consignmentId, accumulated: false });
}
