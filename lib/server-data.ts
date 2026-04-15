import { createClient } from '@/lib/supabase/server';
import { toNumber } from '@/lib/utils';
import type { Consignment, ConsignmentItem, InternalMessage, Product, Profile, SellerStockRow } from '@/lib/types';

type SaleRow = { id: string; seller_id: string; payment_method: string; sold_at: string; consignment_id: string };
type SaleItemRow = { sale_id: string; consignment_item_id: string; quantity: number | string; unit_sale_price: number | string };
type ReconciliationRow = { id: string; seller_id: string; type: string; cash_received: number | string; transfer_received: number | string; created_at: string; consignment_id: string };
type ReconciliationItemRow = { reconciliation_id: string; consignment_item_id: string; quantity_returned: number | string };

function buildStockRows(params: {
  sellerId: string;
  items: ConsignmentItem[];
  sales: SaleRow[];
  salesItems: SaleItemRow[];
  reconciliationItems: ReconciliationItemRow[];
}) {
  const saleById = new Map(params.sales.map((sale) => [sale.id, sale]));
  const itemMap = new Map(params.items.map((item) => [item.id, item]));
  const rows = new Map<string, SellerStockRow>();

  for (const item of params.items) {
    const current = rows.get(item.product_id) ?? {
      product_id: item.product_id,
      product_name: item.products?.name ?? item.product_id,
      assigned: 0,
      sold: 0,
      returned: 0,
      stock: 0,
      unit_price: toNumber(item.unit_sale_price),
      current_value: 0,
      sold_value: 0,
    };
    current.assigned += toNumber(item.quantity_assigned);
    current.unit_price = toNumber(item.unit_sale_price) || current.unit_price;
    rows.set(item.product_id, current);
  }

  for (const saleItem of params.salesItems) {
    const sale = saleById.get(saleItem.sale_id);
    if (!sale || sale.seller_id !== params.sellerId) continue;
    const item = itemMap.get(saleItem.consignment_item_id);
    if (!item) continue;
    const current = rows.get(item.product_id);
    if (!current) continue;
    current.sold += toNumber(saleItem.quantity);
    current.sold_value += toNumber(saleItem.quantity) * toNumber(saleItem.unit_sale_price);
  }

  for (const reconciliationItem of params.reconciliationItems) {
    const item = itemMap.get(reconciliationItem.consignment_item_id);
    if (!item) continue;
    const current = rows.get(item.product_id);
    if (!current) continue;
    current.returned += toNumber(reconciliationItem.quantity_returned);
  }

  return Array.from(rows.values())
    .map((row) => {
      row.stock = row.assigned - row.sold - row.returned;
      row.current_value = row.stock * row.unit_price;
      return row;
    })
    .sort((a, b) => a.product_name.localeCompare(b.product_name, 'es'));
}

export async function getAdminDashboardData(selectedSellerId?: string) {
  const supabase = await createClient();
  const [profilesRes, productsRes, consignmentsRes, itemsRes, salesRes, salesItemsRes, reconciliationsRes, reconciliationItemsRes, messagesRes] = await Promise.all([
    supabase.from('profiles').select('*').order('display_name', { ascending: true }),
    supabase.from('products').select('*').order('created_at', { ascending: false }),
    supabase.from('consignments').select('*').order('created_at', { ascending: false }),
    supabase.from('consignment_items').select('*, products(name)').order('created_at', { ascending: false }),
    supabase.from('sales').select('id, seller_id, payment_method, sold_at, consignment_id').order('sold_at', { ascending: false }),
    supabase.from('sales_items').select('sale_id, consignment_item_id, quantity, unit_sale_price'),
    supabase.from('reconciliations').select('id, seller_id, type, cash_received, transfer_received, created_at, consignment_id').order('created_at', { ascending: false }),
    supabase.from('reconciliation_items').select('reconciliation_id, consignment_item_id, quantity_returned'),
    supabase.from('internal_messages').select('*').order('created_at', { ascending: false }).limit(20),
  ]);

  const profiles = (profilesRes.data ?? []) as Profile[];
  const products = (productsRes.data ?? []) as Product[];
  const consignments = (consignmentsRes.data ?? []) as Consignment[];
  const items = (itemsRes.data ?? []) as ConsignmentItem[];
  const sales = (salesRes.data ?? []) as SaleRow[];
  const salesItems = (salesItemsRes.data ?? []) as SaleItemRow[];
  const reconciliations = (reconciliationsRes.data ?? []) as ReconciliationRow[];
  const reconciliationItems = (reconciliationItemsRes.data ?? []) as ReconciliationItemRow[];
  const messages = (messagesRes.data ?? []) as InternalMessage[];

  const profileMap = new Map(profiles.map((row) => [row.id, row]));
  const consignmentMap = new Map(consignments.map((row) => [row.id, row]));
  const sellers = profiles.filter((row) => row.role === 'seller');
  const activeSeller = selectedSellerId ? profileMap.get(selectedSellerId) : sellers.find((row) => row.is_active) || sellers[0] || null;
  const currentSellerId = activeSeller?.id;

  const sellerItems = items.filter((item) => consignmentMap.get(item.consignment_id)?.seller_id === currentSellerId);
  const sellerConsignments = consignments.filter((row) => row.seller_id === currentSellerId && row.status !== 'closed');
  const sellerSales = sales.filter((row) => row.seller_id === currentSellerId);
  const sellerReconciliations = reconciliations.filter((row) => row.seller_id === currentSellerId);
  const sellerStock = currentSellerId
    ? buildStockRows({ sellerId: currentSellerId, items: sellerItems, sales: sellerSales, salesItems, reconciliationItems })
    : [];

  const allSalesWithTotals = sales.map((sale) => ({
    ...sale,
    seller_name: profileMap.get(sale.seller_id)?.display_name ?? profileMap.get(sale.seller_id)?.email ?? sale.seller_id,
    total: salesItems.filter((item) => item.sale_id === sale.id).reduce((sum, item) => sum + toNumber(item.quantity) * toNumber(item.unit_sale_price), 0),
  }));

  const totalSold = allSalesWithTotals.reduce((sum, row) => sum + row.total, 0);
  const totalRendido = reconciliations.reduce((sum, row) => sum + toNumber(row.cash_received) + toNumber(row.transfer_received), 0);
  const sellerSoldValue = sellerStock.reduce((sum, row) => sum + row.sold_value, 0);
  const sellerRenderedValue = sellerReconciliations.reduce((sum, row) => sum + toNumber(row.cash_received) + toNumber(row.transfer_received), 0);

  return {
    profiles,
    products,
    messages,
    sellers,
    activeSeller,
    sellerConsignments,
    sellerItems,
    sellerStock,
    sellerSales: allSalesWithTotals.filter((row) => row.seller_id === currentSellerId),
    recentSales: allSalesWithTotals.slice(0, 20),
    metrics: {
      sellers: sellers.length,
      products: products.length,
      openConsignments: consignments.filter((row) => row.status !== 'closed').length,
      totalSold,
      totalRendido,
      pendiente: totalSold - totalRendido,
      sellerStockValue: sellerStock.reduce((sum, row) => sum + row.current_value, 0),
      sellerSoldValue,
      sellerRenderedValue,
      sellerPendingValue: sellerSoldValue - sellerRenderedValue,
    },
  };
}

export async function getSellerDashboardData(profileId: string) {
  const supabase = await createClient();
  const [consignmentsRes, itemsRes, salesRes, salesItemsRes, reconciliationsRes, reconciliationItemsRes, messagesRes] = await Promise.all([
    supabase.from('consignments').select('*').eq('seller_id', profileId).order('created_at', { ascending: false }),
    supabase.from('consignment_items').select('*, products(name)').order('created_at', { ascending: false }),
    supabase.from('sales').select('id, seller_id, payment_method, sold_at, consignment_id').eq('seller_id', profileId).order('sold_at', { ascending: false }),
    supabase.from('sales_items').select('sale_id, consignment_item_id, quantity, unit_sale_price'),
    supabase.from('reconciliations').select('id, seller_id, type, cash_received, transfer_received, created_at, consignment_id').eq('seller_id', profileId).order('created_at', { ascending: false }),
    supabase.from('reconciliation_items').select('reconciliation_id, consignment_item_id, quantity_returned'),
    supabase.from('internal_messages').select('*').eq('seller_id', profileId).order('created_at', { ascending: false }).limit(20),
  ]);

  const consignments = (consignmentsRes.data ?? []) as Consignment[];
  const consignmentIds = new Set(consignments.map((row) => row.id));
  const allItems = (itemsRes.data ?? []) as ConsignmentItem[];
  const items = allItems.filter((item) => consignmentIds.has(item.consignment_id));
  const sales = (salesRes.data ?? []) as SaleRow[];
  const salesItems = (salesItemsRes.data ?? []) as SaleItemRow[];
  const reconciliations = (reconciliationsRes.data ?? []) as ReconciliationRow[];
  const reconciliationItems = (reconciliationItemsRes.data ?? []) as ReconciliationItemRow[];
  const messages = (messagesRes.data ?? []) as InternalMessage[];

  const stockRows = buildStockRows({ sellerId: profileId, items, sales, salesItems, reconciliationItems });
  const totalSold = stockRows.reduce((sum, row) => sum + row.sold_value, 0);
  const totalRendido = reconciliations.reduce((sum, row) => sum + toNumber(row.cash_received) + toNumber(row.transfer_received), 0);

  return {
    consignments,
    items,
    sales,
    reconciliations,
    messages,
    stockRows,
    metrics: {
      openConsignments: consignments.filter((row) => row.status !== 'closed').length,
      stockLines: stockRows.length,
      totalSold,
      totalRendido,
      pending: totalSold - totalRendido,
    },
  };
}
