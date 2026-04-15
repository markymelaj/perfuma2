import { createClient } from '@/lib/supabase/server';
import { toNumber } from '@/lib/utils';
import type {
  Consignment,
  ConsignmentItem,
  InternalMessage,
  Product,
  Profile,
  SellerRecentReconciliation,
  SellerRecentSale,
  SellerSnapshot,
  SellerStockLine,
} from '@/lib/types';

type SaleRow = {
  id: string;
  seller_id: string;
  payment_method: 'cash' | 'transfer' | 'mixed';
  sold_at: string;
  consignment_id: string;
};

type SaleItemRow = {
  id: string;
  sale_id: string;
  consignment_item_id: string;
  quantity: number | string;
  unit_sale_price: number | string;
};

type ReconciliationRow = {
  id: string;
  seller_id: string;
  type: 'partial' | 'total';
  cash_received: number | string;
  transfer_received: number | string;
  created_at: string;
  consignment_id: string;
};

type ReconciliationItemRow = {
  id: string;
  reconciliation_id: string;
  consignment_item_id: string;
  quantity_returned: number | string;
};

type SellerLineAccumulator = {
  product_id: string;
  product_name: string;
  quantity_assigned: number;
  quantity_sold: number;
  quantity_returned: number;
  assigned_value: number;
  sold_value: number;
  returned_value: number;
  consignment_item_ids: Set<string>;
  open_consignment_ids: Set<string>;
};

function ensureLine(map: Map<string, SellerLineAccumulator>, productId: string, productName: string) {
  if (!map.has(productId)) {
    map.set(productId, {
      product_id: productId,
      product_name: productName,
      quantity_assigned: 0,
      quantity_sold: 0,
      quantity_returned: 0,
      assigned_value: 0,
      sold_value: 0,
      returned_value: 0,
      consignment_item_ids: new Set<string>(),
      open_consignment_ids: new Set<string>(),
    });
  }

  return map.get(productId)!;
}

function finalizeLines(map: Map<string, SellerLineAccumulator>): SellerStockLine[] {
  return Array.from(map.values())
    .map((line) => {
      const quantityCurrent = Math.max(line.quantity_assigned - line.quantity_sold - line.quantity_returned, 0);
      const averageUnitPrice = line.quantity_assigned > 0 ? line.assigned_value / line.quantity_assigned : 0;
      return {
        product_id: line.product_id,
        product_name: line.product_name,
        quantity_assigned: line.quantity_assigned,
        quantity_sold: line.quantity_sold,
        quantity_returned: line.quantity_returned,
        quantity_current: quantityCurrent,
        average_unit_price: averageUnitPrice,
        current_value: quantityCurrent * averageUnitPrice,
        sold_value: line.sold_value,
        returned_value: line.returned_value,
        consignment_item_ids: Array.from(line.consignment_item_ids),
        open_consignment_id: Array.from(line.open_consignment_ids)[0] ?? null,
      };
    })
    .filter((line) => line.quantity_assigned > 0 || line.quantity_sold > 0 || line.quantity_returned > 0)
    .sort((a, b) => a.product_name.localeCompare(b.product_name, 'es'));
}

function buildSellerSnapshots(params: {
  profiles: Profile[];
  products: Product[];
  consignments: Consignment[];
  items: ConsignmentItem[];
  sales: SaleRow[];
  saleItems: SaleItemRow[];
  reconciliations: ReconciliationRow[];
  reconciliationItems: ReconciliationItemRow[];
  messages: InternalMessage[];
}) {
  const { profiles, products, consignments, items, sales, saleItems, reconciliations, reconciliationItems, messages } = params;

  const sellers = profiles.filter((profile) => profile.role === 'seller');
  const productNameById = new Map(products.map((product) => [product.id, product.name]));
  const consignmentById = new Map(consignments.map((consignment) => [consignment.id, consignment]));
  const itemById = new Map(items.map((item) => [item.id, item]));
  const sellerLineMaps = new Map<string, Map<string, SellerLineAccumulator>>();
  const sellerOpenConsignmentIds = new Map<string, Set<string>>();

  for (const seller of sellers) {
    sellerLineMaps.set(seller.id, new Map());
    const latestOpen = consignments
      .filter((consignment) => consignment.seller_id === seller.id && consignment.status !== 'closed' && consignment.status !== 'cancelled')
      .sort((a, b) => b.opened_at.localeCompare(a.opened_at))[0];
    sellerOpenConsignmentIds.set(seller.id, new Set(latestOpen ? [latestOpen.id] : []));
  }

  for (const item of items) {
    const consignment = consignmentById.get(item.consignment_id);
    if (!consignment || consignment.status === 'closed' || consignment.status === 'cancelled') continue;
    if (!(sellerOpenConsignmentIds.get(consignment.seller_id)?.has(consignment.id))) continue;

    const sellerMap = sellerLineMaps.get(consignment.seller_id) ?? new Map<string, SellerLineAccumulator>();
    sellerLineMaps.set(consignment.seller_id, sellerMap);

    const productName = item.products?.name ?? productNameById.get(item.product_id) ?? item.product_id;
    const line = ensureLine(sellerMap, item.product_id, productName);
    const qtyAssigned = toNumber(item.quantity_assigned);
    const unitPrice = toNumber(item.unit_sale_price);

    line.quantity_assigned += qtyAssigned;
    line.assigned_value += qtyAssigned * unitPrice;
    line.consignment_item_ids.add(item.id);
    line.open_consignment_ids.add(consignment.id);
  }

  for (const saleItem of saleItems) {
    const item = itemById.get(saleItem.consignment_item_id);
    if (!item) continue;
    const consignment = consignmentById.get(item.consignment_id);
    if (!consignment || consignment.status === 'closed' || consignment.status === 'cancelled') continue;
    if (!(sellerOpenConsignmentIds.get(consignment.seller_id)?.has(consignment.id))) continue;
    const sellerMap = sellerLineMaps.get(consignment.seller_id);
    if (!sellerMap) continue;

    const productName = item.products?.name ?? productNameById.get(item.product_id) ?? item.product_id;
    const line = ensureLine(sellerMap, item.product_id, productName);
    const qty = toNumber(saleItem.quantity);
    const unitPrice = toNumber(saleItem.unit_sale_price);
    line.quantity_sold += qty;
    line.sold_value += qty * unitPrice;
  }

  const reconciliationById = new Map(reconciliations.map((row) => [row.id, row]));

  for (const reconciliationItem of reconciliationItems) {
    const item = itemById.get(reconciliationItem.consignment_item_id);
    if (!item) continue;
    const consignment = consignmentById.get(item.consignment_id);
    if (!consignment || consignment.status === 'closed' || consignment.status === 'cancelled') continue;
    if (!(sellerOpenConsignmentIds.get(consignment.seller_id)?.has(consignment.id))) continue;
    const sellerMap = sellerLineMaps.get(consignment.seller_id);
    if (!sellerMap) continue;

    const productName = item.products?.name ?? productNameById.get(item.product_id) ?? item.product_id;
    const line = ensureLine(sellerMap, item.product_id, productName);
    const qty = toNumber(reconciliationItem.quantity_returned);
    const unitPrice = toNumber(item.unit_sale_price);
    line.quantity_returned += qty;
    line.returned_value += qty * unitPrice;
  }

  const saleTotals = new Map<string, number>();
  const saleProducts = new Map<string, Set<string>>();
  for (const saleItem of saleItems) {
    const item = itemById.get(saleItem.consignment_item_id);
    if (!item) continue;
    const productName = item.products?.name ?? productNameById.get(item.product_id) ?? item.product_id;
    saleTotals.set(saleItem.sale_id, (saleTotals.get(saleItem.sale_id) ?? 0) + toNumber(saleItem.quantity) * toNumber(saleItem.unit_sale_price));
    if (!saleProducts.has(saleItem.sale_id)) saleProducts.set(saleItem.sale_id, new Set());
    saleProducts.get(saleItem.sale_id)!.add(productName);
  }

  const sellerById = new Map(sellers.map((seller) => [seller.id, seller]));

  const snapshots = sellers.map((seller) => {
    const stockLines = finalizeLines(sellerLineMaps.get(seller.id) ?? new Map());
    const recentSales: SellerRecentSale[] = sales
      .filter((sale) => sale.seller_id === seller.id)
      .map((sale) => ({
        sale_id: sale.id,
        seller_id: seller.id,
        seller_name: seller.display_name ?? seller.email ?? 'Sin nombre',
        sold_at: sale.sold_at,
        payment_method: sale.payment_method,
        total: saleTotals.get(sale.id) ?? 0,
        product_names: Array.from(saleProducts.get(sale.id) ?? []),
      }))
      .sort((a, b) => b.sold_at.localeCompare(a.sold_at));

    const openConsignmentIds = sellerOpenConsignmentIds.get(seller.id) ?? new Set<string>();

    const recentReconciliations: SellerRecentReconciliation[] = reconciliations
      .filter((row) => row.seller_id === seller.id)
      .map((row) => {
        const cash = toNumber(row.cash_received);
        const transfer = toNumber(row.transfer_received);
        return {
          reconciliation_id: row.id,
          seller_id: seller.id,
          seller_name: seller.display_name ?? seller.email ?? 'Sin nombre',
          created_at: row.created_at,
          type: row.type,
          cash_received: cash,
          transfer_received: transfer,
          total_received: cash + transfer,
        };
      })
      .sort((a, b) => b.created_at.localeCompare(a.created_at));

    const rendidoValue = reconciliations
      .filter((row) => row.seller_id === seller.id && openConsignmentIds.has(row.consignment_id))
      .reduce((sum, row) => sum + toNumber(row.cash_received) + toNumber(row.transfer_received), 0);
    const stockValue = stockLines.reduce((sum, row) => sum + row.current_value, 0);
    const soldValue = stockLines.reduce((sum, row) => sum + row.sold_value, 0);
    const returnedValue = stockLines.reduce((sum, row) => sum + row.returned_value, 0);

    return {
      seller,
      open_consignments: consignments.filter((row) => row.seller_id === seller.id && row.status !== 'closed'),
      stock_lines: stockLines,
      financials: {
        stock_value: stockValue,
        sold_value: soldValue,
        returned_value: returnedValue,
        rendido_value: rendidoValue,
        pendiente_value: soldValue - rendidoValue,
      },
      recent_sales: recentSales.slice(0, 20),
      recent_reconciliations: recentReconciliations.slice(0, 20),
      messages: messages.filter((row) => row.seller_id === seller.id).sort((a, b) => b.created_at.localeCompare(a.created_at)),
    } satisfies SellerSnapshot;
  });

  const globalRecentSales = sales
    .map((sale) => {
      const seller = sellerById.get(sale.seller_id);
      return {
        sale_id: sale.id,
        seller_id: sale.seller_id,
        seller_name: seller?.display_name ?? seller?.email ?? 'Sin nombre',
        sold_at: sale.sold_at,
        payment_method: sale.payment_method,
        total: saleTotals.get(sale.id) ?? 0,
        product_names: Array.from(saleProducts.get(sale.id) ?? []),
      } satisfies SellerRecentSale;
    })
    .sort((a, b) => b.sold_at.localeCompare(a.sold_at));

  const globalRecentReconciliations = reconciliations
    .map((row) => {
      const seller = sellerById.get(row.seller_id);
      const cash = toNumber(row.cash_received);
      const transfer = toNumber(row.transfer_received);
      return {
        reconciliation_id: row.id,
        seller_id: row.seller_id,
        seller_name: seller?.display_name ?? seller?.email ?? 'Sin nombre',
        created_at: row.created_at,
        type: row.type,
        cash_received: cash,
        transfer_received: transfer,
        total_received: cash + transfer,
      } satisfies SellerRecentReconciliation;
    })
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  return { snapshots, globalRecentSales, globalRecentReconciliations };
}

export async function getAdminDashboardData(selectedSellerId?: string) {
  const supabase = await createClient();

  const [profilesRes, productsRes, consignmentsRes, itemsRes, salesRes, saleItemsRes, reconciliationsRes, reconciliationItemsRes, messagesRes] = await Promise.all([
    supabase.from('profiles').select('*').order('created_at', { ascending: false }),
    supabase.from('products').select('*').order('created_at', { ascending: false }),
    supabase.from('consignments').select('*').order('created_at', { ascending: false }),
    supabase.from('consignment_items').select('*, products(name)').order('created_at', { ascending: false }),
    supabase.from('sales').select('id, seller_id, payment_method, sold_at, consignment_id').order('sold_at', { ascending: false }),
    supabase.from('sales_items').select('id, sale_id, consignment_item_id, quantity, unit_sale_price'),
    supabase.from('reconciliations').select('id, seller_id, type, cash_received, transfer_received, created_at, consignment_id').order('created_at', { ascending: false }),
    supabase.from('reconciliation_items').select('id, reconciliation_id, consignment_item_id, quantity_returned'),
    supabase.from('internal_messages').select('*').order('created_at', { ascending: false }).limit(50),
  ]);

  const profiles = (profilesRes.data ?? []) as Profile[];
  const products = (productsRes.data ?? []) as Product[];
  const consignments = (consignmentsRes.data ?? []) as Consignment[];
  const items = (itemsRes.data ?? []) as ConsignmentItem[];
  const sales = (salesRes.data ?? []) as SaleRow[];
  const saleItems = (saleItemsRes.data ?? []) as SaleItemRow[];
  const reconciliations = (reconciliationsRes.data ?? []) as ReconciliationRow[];
  const reconciliationItems = (reconciliationItemsRes.data ?? []) as ReconciliationItemRow[];
  const messages = (messagesRes.data ?? []) as InternalMessage[];

  const { snapshots, globalRecentSales, globalRecentReconciliations } = buildSellerSnapshots({
    profiles,
    products,
    consignments,
    items,
    sales,
    saleItems,
    reconciliations,
    reconciliationItems,
    messages,
  });

  const sellers = profiles.filter((profile) => profile.role === 'seller');
  const selectedSeller = snapshots.find((snapshot) => snapshot.seller.id === selectedSellerId) ?? snapshots[0] ?? null;

  const totalStockValue = snapshots.reduce((sum, snapshot) => sum + snapshot.financials.stock_value, 0);
  const totalSold = snapshots.reduce((sum, snapshot) => sum + snapshot.financials.sold_value, 0);
  const totalRendido = snapshots.reduce((sum, snapshot) => sum + snapshot.financials.rendido_value, 0);

  return {
    profiles,
    sellers,
    products,
    selectedSeller,
    recentSales: globalRecentSales.slice(0, 20),
    recentReconciliations: globalRecentReconciliations.slice(0, 20),
    metrics: {
      sellers: sellers.filter((profile) => profile.is_active).length,
      products: products.filter((product) => product.is_active).length,
      stockValue: totalStockValue,
      totalSold,
      totalRendido,
      pendiente: totalSold - totalRendido,
    },
  };
}

export async function getSellerDashboardData(profileId: string) {
  const supabase = await createClient();

  const [profilesRes, productsRes, consignmentsRes, itemsRes, salesRes, saleItemsRes, reconciliationsRes, reconciliationItemsRes, messagesRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', profileId),
    supabase.from('products').select('*').order('created_at', { ascending: false }),
    supabase.from('consignments').select('*').eq('seller_id', profileId).order('created_at', { ascending: false }),
    supabase.from('consignment_items').select('*, products(name)').order('created_at', { ascending: false }),
    supabase.from('sales').select('id, seller_id, payment_method, sold_at, consignment_id').eq('seller_id', profileId).order('sold_at', { ascending: false }),
    supabase.from('sales_items').select('id, sale_id, consignment_item_id, quantity, unit_sale_price'),
    supabase.from('reconciliations').select('id, seller_id, type, cash_received, transfer_received, created_at, consignment_id').eq('seller_id', profileId).order('created_at', { ascending: false }),
    supabase.from('reconciliation_items').select('id, reconciliation_id, consignment_item_id, quantity_returned'),
    supabase.from('internal_messages').select('*').eq('seller_id', profileId).order('created_at', { ascending: false }).limit(50),
  ]);

  const profiles = (profilesRes.data ?? []) as Profile[];
  const products = (productsRes.data ?? []) as Product[];
  const consignments = (consignmentsRes.data ?? []) as Consignment[];
  const items = (itemsRes.data ?? []) as ConsignmentItem[];
  const sellerConsignmentIds = new Set(consignments.map((row) => row.id));
  const filteredItems = items.filter((item) => sellerConsignmentIds.has(item.consignment_id));
  const sales = (salesRes.data ?? []) as SaleRow[];
  const saleIds = new Set(sales.map((row) => row.id));
  const saleItems = ((saleItemsRes.data ?? []) as SaleItemRow[]).filter((item) => saleIds.has(item.sale_id));
  const reconciliations = (reconciliationsRes.data ?? []) as ReconciliationRow[];
  const reconciliationIds = new Set(reconciliations.map((row) => row.id));
  const reconciliationItems = ((reconciliationItemsRes.data ?? []) as ReconciliationItemRow[]).filter((item) => reconciliationIds.has(item.reconciliation_id));
  const messages = (messagesRes.data ?? []) as InternalMessage[];

  const { snapshots } = buildSellerSnapshots({
    profiles,
    products,
    consignments,
    items: filteredItems,
    sales,
    saleItems,
    reconciliations,
    reconciliationItems,
    messages,
  });

  const snapshot = snapshots[0] ?? null;

  return {
    snapshot,
    metrics: snapshot?.financials ?? {
      stock_value: 0,
      sold_value: 0,
      returned_value: 0,
      rendido_value: 0,
      pendiente_value: 0,
    },
  };
}
