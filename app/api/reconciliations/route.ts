import { NextResponse } from 'next/server';
import { reconciliationSchema } from '@/lib/validators';
import { requireApiProfile } from '@/lib/auth/api-guards';

export async function POST(request: Request) {
  const auth = await requireApiProfile(request);
  if ('response' in auth) return auth.response;

  const json = await request.json();
  const parsed = reconciliationSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }, { status: 400 });
  }

  const reconciliation = await auth.admin
    .from('reconciliations')
    .insert([
      {
        consignment_id: parsed.data.consignment_id,
        type: parsed.data.type,
        cash_received: parsed.data.cash_received,
        transfer_received: parsed.data.transfer_received,
        notes: parsed.data.notes || null,
        created_by: auth.profile.id,
      },
    ])
    .select('id')
    .single();

  if (reconciliation.error || !reconciliation.data) {
    return NextResponse.json({ error: reconciliation.error?.message ?? 'No se pudo registrar la rendición' }, { status: 400 });
  }

  const quantityReturned = parsed.data.quantity_returned ?? 0;
  const consignmentItemId = parsed.data.consignment_item_id || '';

  if (consignmentItemId && quantityReturned > 0) {
    const item = await auth.admin.from('reconciliation_items').insert([
      {
        reconciliation_id: reconciliation.data.id,
        consignment_item_id: consignmentItemId,
        quantity_returned: quantityReturned,
      },
    ]);

    if (item.error) {
      return NextResponse.json({ error: item.error.message }, { status: 400 });
    }
  }

  return NextResponse.json({ ok: true });
}
