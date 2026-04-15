import { NextResponse } from 'next/server';
import { reconciliationSchema } from '@/lib/validators';
import { requireApiProfile } from '@/lib/auth/api-guards';
import { createAdminClient } from '@/lib/supabase/admin';
import { toNumber } from '@/lib/utils';

async function maybeCloseConsignment(admin: ReturnType<typeof createAdminClient>, consignmentId: string) {
  const [itemsRes, salesItemsRes, reconciliationItemsRes, reconciliationsRes] = await Promise.all([
    admin.from('consignment_items').select('id, quantity_assigned').eq('consignment_id', consignmentId),
    admin.from('sales_items').select('consignment_item_id, quantity, unit_sale_price'),
    admin.from('reconciliation_items').select('consignment_item_id, quantity_returned'),
    admin.from('reconciliations').select('cash_received, transfer_received').eq('consignment_id', consignmentId),
  ]);

  const itemIds = new Set((itemsRes.data ?? []).map((row) => row.id as string));
  const assignedQty = (itemsRes.data ?? []).reduce((sum, row) => sum + toNumber(row.quantity_assigned), 0);
  const soldQty = (salesItemsRes.data ?? []).filter((row) => itemIds.has(row.consignment_item_id as string)).reduce((sum, row) => sum + toNumber(row.quantity), 0);
  const returnedQty = (reconciliationItemsRes.data ?? []).filter((row) => itemIds.has(row.consignment_item_id as string)).reduce((sum, row) => sum + toNumber(row.quantity_returned), 0);
  const soldValue = (salesItemsRes.data ?? []).filter((row) => itemIds.has(row.consignment_item_id as string)).reduce((sum, row) => sum + toNumber(row.quantity) * toNumber(row.unit_sale_price), 0);
  const rendido = (reconciliationsRes.data ?? []).reduce((sum, row) => sum + toNumber(row.cash_received) + toNumber(row.transfer_received), 0);

  if (assignedQty - soldQty - returnedQty <= 0 && soldValue - rendido <= 0) {
    await admin.from('consignments').update({ status: 'closed' }).eq('id', consignmentId);
  }
}

export async function POST(request: Request) {
  const auth = await requireApiProfile(request);
  if ('response' in auth) return auth.response;

  const json = await request.json();
  const parsed = reconciliationSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }, { status: 400 });
  }

  const targetSellerId = parsed.data.seller_id;
  if (auth.profile.role === 'seller' && targetSellerId !== auth.profile.id) {
    return NextResponse.json({ error: 'No puedes rendir por otro vendedor' }, { status: 403 });
  }

  const openConsignment = await auth.admin
    .from('consignments')
    .select('id')
    .eq('seller_id', targetSellerId)
    .in('status', ['open', 'partially_reconciled'])
    .order('opened_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const fallbackConsignment = !openConsignment.data?.id
    ? await auth.admin
        .from('consignments')
        .select('id')
        .eq('seller_id', targetSellerId)
        .order('opened_at', { ascending: false })
        .limit(1)
        .maybeSingle()
    : null;

  const consignmentId = openConsignment.data?.id ?? fallbackConsignment?.data?.id ?? null;
  if (!consignmentId) {
    return NextResponse.json({ error: 'El vendedor no tiene una cuenta de stock activa' }, { status: 400 });
  }

  const reconciliation = await auth.admin
    .from('reconciliations')
    .insert([
      {
        consignment_id: consignmentId,
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
    const item = await auth.admin
      .from('consignment_items')
      .select('consignment_id')
      .eq('id', consignmentItemId)
      .single();

    if (item.error || !item.data || item.data.consignment_id !== consignmentId) {
      return NextResponse.json({ error: 'El producto devuelto no pertenece a la cuenta activa del vendedor' }, { status: 400 });
    }

    const inserted = await auth.admin.from('reconciliation_items').insert([
      {
        reconciliation_id: reconciliation.data.id,
        consignment_item_id: consignmentItemId,
        quantity_returned: quantityReturned,
      },
    ]);

    if (inserted.error) {
      return NextResponse.json({ error: inserted.error.message }, { status: 400 });
    }
  }

  if (parsed.data.type === 'total') {
    await maybeCloseConsignment(auth.admin, consignmentId);
  }

  return NextResponse.json({ ok: true });
}
