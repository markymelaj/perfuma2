import { NextResponse } from 'next/server';
import { consignmentSchema } from '@/lib/validators';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth/guards';

export async function POST(request: Request) {
  const actor = await requireAdmin();
  const json = await request.json();
  const parsed = consignmentSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }, { status: 400 });
  }

  const supabase = await createClient();
  const inserted = await supabase
    .from('consignments')
    .insert([
      {
        seller_id: parsed.data.seller_id,
        supplier_id: parsed.data.supplier_id || null,
        opened_by: actor.id,
        notes: parsed.data.notes || null,
      },
    ])
    .select('id')
    .single();

  if (inserted.error || !inserted.data) {
    return NextResponse.json({ error: inserted.error?.message ?? 'No se pudo crear la consignación' }, { status: 400 });
  }

  const item = await supabase.from('consignment_items').insert([
    {
      consignment_id: inserted.data.id,
      product_id: parsed.data.product_id,
      quantity_assigned: parsed.data.quantity_assigned,
      unit_sale_price: parsed.data.unit_sale_price,
    },
  ]);

  if (item.error) {
    return NextResponse.json({ error: item.error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, consignmentId: inserted.data.id });
}
