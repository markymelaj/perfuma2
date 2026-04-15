import { createClient } from '@/lib/supabase/server';
import { toNumber } from '@/lib/utils';
import type { Consignment, ConsignmentItem, InternalMessage, Product, Profile, Supplier } from '@/lib/types';

export async function getAdminDashboardData() {
  const supabase = await createClient();

  const [profilesRes, suppliersRes, productsRes, consignmentsRes, itemsRes, salesRes, reconciliationsRes, messagesRes] = await Promise.all([
    supabase.from('profiles').select('*').order('created_at', { ascending: false }),
    supabase.from('suppliers').select('*').order('created_at', { ascending: false }),
    supabase.from('products').select('*').order('created_at', { ascending: false }),
    supabase.from('consignments').select('*').order('created_at', { ascending: false }),
    supabase.from('consignment_items').select('*, products(name)').order('created_at', { ascending: false }),
    supabase.from('sales_items').select('quantity, unit_sale_price'),
    supabase.from('reconciliations').select('cash_received, transfer_received'),
    supabase.from('internal_messages').select('*').order('created_at', { ascending: false }).limit(20),
  ]);

  const profiles = (profilesRes.data ?? []) as Profile[];
  const suppliers = (suppliersRes.data ?? []) as Supplier[];
  const products = (productsRes.data ?? []) as Product[];
  const consignments = (consignmentsRes.data ?? []) as Consignment[];
  const items = (itemsRes.data ?? []) as ConsignmentItem[];
  const messages = (messagesRes.data ?? []) as InternalMessage[];

  const totalSold = (salesRes.data ?? []).reduce((sum, row) => sum + toNumber(row.quantity) * toNumber(row.unit_sale_price), 0);
  const totalRendido = (reconciliationsRes.data ?? []).reduce(
    (sum, row) => sum + toNumber(row.cash_received) + toNumber(row.transfer_received),
    0,
  );

  return {
    profiles,
    suppliers,
    products,
    consignments,
    items,
    messages,
    metrics: {
      sellers: profiles.filter((profile) => profile.role === 'seller').length,
      products: products.length,
      openConsignments: consignments.filter((consignment) => consignment.status !== 'closed').length,
      totalSold,
      totalRendido,
      pendiente: totalSold - totalRendido,
    },
  };
}

export async function getSellerDashboardData(profileId: string) {
  const supabase = await createClient();

  const [consignmentsRes, itemsRes, salesRes, reconciliationsRes, messagesRes] = await Promise.all([
    supabase.from('consignments').select('*').eq('seller_id', profileId).order('created_at', { ascending: false }),
    supabase
      .from('consignment_items')
      .select('*, products(name)')
      .in(
        'consignment_id',
        ((await supabase.from('consignments').select('id').eq('seller_id', profileId)).data ?? []).map((row) => row.id),
      )
      .order('created_at', { ascending: false }),
    supabase.from('sales').select('id, payment_method, sold_at, consignment_id').eq('seller_id', profileId).order('sold_at', { ascending: false }),
    supabase.from('reconciliations').select('id, type, cash_received, transfer_received, created_at, consignment_id').eq('seller_id', profileId).order('created_at', { ascending: false }),
    supabase.from('internal_messages').select('*').eq('seller_id', profileId).order('created_at', { ascending: false }).limit(20),
  ]);

  const consignments = (consignmentsRes.data ?? []) as Consignment[];
  const items = (itemsRes.data ?? []) as ConsignmentItem[];
  const messages = (messagesRes.data ?? []) as InternalMessage[];

  const consignmentIds = consignments.map((row) => row.id);
  const detailedSalesItems = consignmentIds.length
    ? await supabase
        .from('sales_items')
        .select('quantity, unit_sale_price, consignment_item_id, sale_id')
        .in(
          'sale_id',
          ((salesRes.data ?? []).map((sale) => sale.id)),
        )
    : { data: [] as Array<{ quantity: number | string; unit_sale_price: number | string }>, error: null };

  const totalSold = (detailedSalesItems.data ?? []).reduce(
    (sum, row) => sum + toNumber(row.quantity) * toNumber(row.unit_sale_price),
    0,
  );
  const totalRendido = ((reconciliationsRes.data ?? []) as Array<{ cash_received: number | string; transfer_received: number | string }>).reduce(
    (sum, row) => sum + toNumber(row.cash_received) + toNumber(row.transfer_received),
    0,
  );

  return {
    consignments,
    items,
    sales: salesRes.data ?? [],
    reconciliations: reconciliationsRes.data ?? [],
    messages,
    metrics: {
      openConsignments: consignments.filter((row) => row.status !== 'closed').length,
      stockLines: items.length,
      totalSold,
      totalRendido,
      pendiente: totalSold - totalRendido,
    },
  };
}
