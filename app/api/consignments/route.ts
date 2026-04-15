import { NextResponse } from 'next/server';
import { consignmentSchema } from '@/lib/validators';
import { getHeaderAdminContext } from '@/lib/auth/admin-header-context';

export async function POST(request: Request) {
  const ctx = await getHeaderAdminContext(request);
  if ('error' in ctx) return ctx.error;

  const json = await request.json();
  const parsed = consignmentSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }, { status: 400 });
  }

  let consignmentId: string | null = null;

  const existingOpen = await ctx.admin
    .from('consignments')
    .select('id')
    .eq('seller_id', parsed.data.seller_id)
    .eq('status', 'open')
    .order('opened_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existingOpen.data?.id) {
    consignmentId = existingOpen.data.id;
  } else {
    const inserted = await ctx.admin
      .from('consignments')
      .insert([
        {
          seller_id: parsed.data.seller_id,
          opened_by: ctx.profile.id,
          notes: parsed.data.notes || null,
        },
      ])
      .select('id')
      .single();

    if (inserted.error || !inserted.data) {
      return NextResponse.json({ error: inserted.error?.message ?? 'No se pudo crear la asignación' }, { status: 400 });
    }

    consignmentId = inserted.data.id;
  }

  const existingItem = await ctx.admin
    .from('consignment_items')
    .select('id, quantity_assigned, unit_sale_price')
    .eq('consignment_id', consignmentId)
    .eq('product_id', parsed.data.product_id)
    .maybeSingle();

  if (existingItem.data?.id) {
    const updated = await ctx.admin
      .from('consignment_items')
      .update({
        quantity_assigned: Number(existingItem.data.quantity_assigned) + parsed.data.quantity_assigned,
        unit_sale_price: parsed.data.unit_sale_price,
      })
      .eq('id', existingItem.data.id);

    if (updated.error) {
      return NextResponse.json({ error: updated.error.message }, { status: 400 });
    }
  } else {
    const item = await ctx.admin.from('consignment_items').insert([
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
