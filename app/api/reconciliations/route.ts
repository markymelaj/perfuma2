import { NextResponse } from 'next/server';
import { reconciliationSchema } from '@/lib/validators';
import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/auth/guards';

export async function POST(request: Request) {
  const actor = await requireProfile();
  const json = await request.json();
  const parsed = reconciliationSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }, { status: 400 });
  }

  const supabase = await createClient();
  const reconciliation = await supabase
    .from('reconciliations')
    .insert([
      {
        consignment_id: parsed.data.consignment_id,
        type: parsed.data.type,
        cash_received: parsed.data.cash_received,
        transfer_received: parsed.data.transfer_received,
        notes: parsed.data.notes || null,
        created_by: actor.id,
      },
    ])
    .select('id')
    .single();

  if (reconciliation.error || !reconciliation.data) {
    return NextResponse.json({ error: reconciliation.error?.message ?? 'No se pudo registrar la rendición' }, { status: 400 });
  }

  if (parsed.data.consignment_item_id && (parsed.data.quantity_returned ?? 0) > 0) {
    const item = await supabase.from('reconciliation_items').insert([
      {
        reconciliation_id: reconciliation.data.id,
        consignment_item_id: parsed.data.consignment_item_id,
        quantity_returned: parsed.data.quantity_returned ?? 0,
      },
    ]);

    if (item.error) {
      return NextResponse.json({ error: item.error.message }, { status: 400 });
    }
  }

  return NextResponse.json({ ok: true });
}
