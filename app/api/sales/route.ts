import { NextResponse } from 'next/server';
import { saleSchema } from '@/lib/validators';
import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/auth/guards';

export async function POST(request: Request) {
  const actor = await requireProfile();
  const json = await request.json();
  const parsed = saleSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }, { status: 400 });
  }

  const supabase = await createClient();
  const sale = await supabase
    .from('sales')
    .insert([
      {
        consignment_id: parsed.data.consignment_id,
        payment_method: parsed.data.payment_method,
        notes: parsed.data.notes || null,
        created_by: actor.id,
      },
    ])
    .select('id')
    .single();

  if (sale.error || !sale.data) {
    return NextResponse.json({ error: sale.error?.message ?? 'No se pudo crear la venta' }, { status: 400 });
  }

  const itemInfo = await supabase
    .from('consignment_items')
    .select('unit_sale_price')
    .eq('id', parsed.data.consignment_item_id)
    .single();

  if (itemInfo.error || !itemInfo.data) {
    return NextResponse.json({ error: itemInfo.error?.message ?? 'No se encontró el ítem de consignación' }, { status: 400 });
  }

  const line = await supabase.from('sales_items').insert([
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
