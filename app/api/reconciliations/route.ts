import { NextResponse } from 'next/server';
import { reconciliationSchema } from '@/lib/validators';
import { requireApiProfile } from '@/lib/auth/api-guards';
import { isAdminRole } from '@/lib/auth/guards';

export async function POST(request: Request) {
  const auth = await requireApiProfile(request);
  if ('response' in auth) return auth.response;

  const json = await request.json();
  const parsed = reconciliationSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }, { status: 400 });
  }

  const consignment = await auth.admin
    .from('consignments')
    .select('id,seller_id')
    .eq('id', parsed.data.consignment_id)
    .maybeSingle();

  if (consignment.error || !consignment.data) {
    return NextResponse.json({ error: 'Consignación no encontrada' }, { status: 404 });
  }

  if (!isAdminRole(auth.profile.role) && consignment.data.seller_id !== auth.profile.id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const reconciliation = await auth.admin
    .from('reconciliations')
    .insert([
      {
        consignment_id: parsed.data.consignment_id,
        seller_id: consignment.data.seller_id,
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

  if (parsed.data.consignment_item_id && (parsed.data.quantity_returned ?? 0) > 0) {
    const itemInfo = await auth.admin
      .from('consignment_items')
      .select('id,consignment_id')
      .eq('id', parsed.data.consignment_item_id)
      .maybeSingle();

    if (itemInfo.error || !itemInfo.data) {
      return NextResponse.json({ error: 'No se encontró el ítem de consignación' }, { status: 400 });
    }

    if (itemInfo.data.consignment_id !== parsed.data.consignment_id) {
      return NextResponse.json({ error: 'El ítem no pertenece a la consignación seleccionada' }, { status: 400 });
    }

    const item = await auth.admin.from('reconciliation_items').insert([
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
