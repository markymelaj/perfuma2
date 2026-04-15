import { createClient } from '@/lib/supabase/server';
import { toNumber } from '@/lib/utils';
import type {
  Consignment,
  ConsignmentItem,
  InternalMessage,
  Product,
  Profile,
  Reconciliation,
  ReconciliationItem,
  Sale,
  SaleItem,
  SellerFinancialSummary,
  SellerStockLine,
} from '@/lib/types';

type SellerAccountData = {
  seller: Profile | null;
  activeConsignment: Consignment | null;
  stockLines: SellerStockLine[];
  financial: SellerFinancialSummary;
  sales: Array<Sale & { total_value: number; product_names: string[] }>;
  reconciliations: Array<Reconciliation & { total_received: number; return_items: Array<{ product_name: string; quantity: number }> }>;
  messages: InternalMessage[];
};

function buildStockLines(items: ConsignmentItem[], saleItems: SaleItem[], reconciliationItems: ReconciliationItem[]) {
  return items.map((item) => {
    const soldQty = saleItems
      .filter((line) => line.consignment_item_id === item.id)
      .reduce((sum, line) => sum + toNumber(line.quantity), 0);
    const returnedQty = reconciliationItems
      .filter((line) => line.consignment_item_id === item.id)
      .reduce((sum, line) => sum + toNumber(line.quantity_returned), 0);
    const currentQty = Math.max(0, toNumber(item.quantity_assigned) - soldQty - returnedQty);
    const price = toNumber(item.unit_sale_price);
    return {
      consignment_item_id: item.id,
      product_id: item.product_id,
      product_name: item.products?.name ?? item.product_id,
      quantity_assigned: toNumber(item.quantity_assigned),
      quantity_sold: soldQty,
      quantity_returned: returnedQty,
      quantity_current: currentQty,
      unit_sale_price: price,
      current_value: currentQty * price,
      sold_value: soldQty * price,
    } satisfies SellerStockLine;
  });
}

function buildFinancial(stockLines: SellerStockLine[], reconciliations: Reconciliation[]) {
  const soldTotal = stockLines.reduce((sum, line) => sum + line.sold_value, 0);
  const renderedTotal = reconciliations.reduce(
    (sum, row) => sum + toNumber(row.cash_received) + toNumber(row.transfer_received),
    0,
  );
  const stockCurrentValue = stockLines.reduce((sum, line) => sum + line.current_value, 0);
  const returnedValue = stockLines.reduce(
    (sum, line) => sum + line.quantity_returned * line.unit_sale_price,
    0,
  );
  return {
    soldTotal,
    renderedTotal,
    pendingTotal: soldTotal - renderedTotal,
    stockCurrentValue,
    returnedValue,
  } satisfies SellerFinancialSummary;
}

async function getSellerAccount(sellerId: string | null): Promise<SellerAccountData> {
  const supabase = await createClient();
  if (!sellerId) {
    return {
      seller: null,
      activeConsignment: null,
      stockLines: [],
      financial: { soldTotal: 0, renderedTotal: 0, pendingTotal: 0, stockCurrentValue: 0, returnedValue: 0 },
      sales: [],
      reconciliations: [],
      messages: [],
    };
  }

  const sellerRes = await supabase.from('profiles').select('*').eq('id', sellerId).maybeSingle();
  const seller = (sellerRes.data ?? null) as Profile | null;

  const activeConsignmentRes = await supabase
    .from('consignments')
    .select('*')
    .eq('seller_id', sellerId)
    .in('status', ['open', 'partially_reconciled'])
    .order('opened_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const activeConsignment = (activeConsignmentRes.data ?? null) as Consignment | null;

  if (!activeConsignment) {
    const messagesRes = await supabase
      .from('internal_messages')
      .select('*')
      .eq('seller_id', sellerId)
      .order('created_at', { ascending: false })
      .limit(20);

    return {
      seller,
      activeConsignment: null,
      stockLines: [],
      financial: { soldTotal: 0, renderedTotal: 0, pendingTotal: 0, stockCurrentValue: 0, returnedValue: 0 },
      sales: [],
      reconciliations: [],
      messages: (messagesRes.data ?? []) as InternalMessage[],
    };
  }

  const [itemsRes, salesRes, saleItemsRes, reconciliationsRes, reconciliationItemsRes, messagesRes] = await Promise.all([
    supabase.from('consignment_items').select('*, products(name)').eq('consignment_id', activeConsignment.id).order('created_at', { ascending: true }),
    supabase.from('sales').select('*').eq('consignment_id', activeConsignment.id).order('sold_at', { ascending: false }),
    supabase.from('sales_items').select('*').in('sale_id', ((await supabase.from('sales').select('id').eq('consignment_id', activeConsignment.id)).data ?? []).map((row) => row.id)),
    supabase.from('reconciliations').select('*').eq('consignment_id', activeConsignment.id).order('created_at', { ascending: false }),
    supabase.from('reconciliation_items').select('*').in('reconciliation_id', ((await supabase.from('reconciliations').select('id').eq('consignment_id', activeConsignment.id)).data ?? []).map((row) => row.id)),
    supabase.from('internal_messages').select('*').eq('seller_id', sellerId).order('created_at', { ascending: false }).limit(20),
  ]);

  const items = (itemsRes.data ?? []) as ConsignmentItem[];
  const sales = (salesRes.data ?? []) as Sale[];
  const saleItems = (saleItemsRes.data ?? []) as SaleItem[];
  const reconciliations = (reconciliationsRes.data ?? []) as Reconciliation[];
  const reconciliationItems = (reconciliationItemsRes.data ?? []) as ReconciliationItem[];
  const messages = (messagesRes.data ?? []) as InternalMessage[];

  const stockLines = buildStockLines(items, saleItems, reconciliationItems);
  const financial = buildFinancial(stockLines, reconciliations);

  const saleMap = new Map(stockLines.map((line) => [line.consignment_item_id, line.product_name]));
  const salesDetailed = sales.map((sale) => {
    const lines = saleItems.filter((line) => line.sale_id === sale.id);
    return {
      ...sale,
      total_value: lines.reduce((sum, line) => sum + toNumber(line.quantity) * toNumber(line.unit_sale_price), 0),
      product_names: Array.from(new Set(lines.map((line) => saleMap.get(line.consignment_item_id) ?? line.consignment_item_id))),
    };
  });

  const returnMap = new Map(stockLines.map((line) => [line.consignment_item_id, line.product_name]));
  const reconciliationsDetailed = reconciliations.map((row) => ({
    ...row,
    total_received: toNumber(row.cash_received) + toNumber(row.transfer_received),
    return_items: reconciliationItems
      .filter((line) => line.reconciliation_id === row.id && toNumber(line.quantity_returned) > 0)
      .map((line) => ({ product_name: returnMap.get(line.consignment_item_id) ?? line.consignment_item_id, quantity: toNumber(line.quantity_returned) })),
  }));

  return {
    seller,
    activeConsignment,
    stockLines,
    financial,
    sales: salesDetailed,
    reconciliations: reconciliationsDetailed,
    messages,
  };
}

export async function getAdminDashboardData(selectedSellerId?: string) {
  const supabase = await createClient();
  const [profilesRes, productsRes, salesRes] = await Promise.all([
    supabase.from('profiles').select('*').order('created_at', { ascending: false }),
    supabase.from('products').select('*').order('created_at', { ascending: false }),
    supabase.from('sales').select('id, seller_id, payment_method, sold_at').order('sold_at', { ascending: false }).limit(20),
  ]);

  const profiles = (profilesRes.data ?? []) as Profile[];
  const products = (productsRes.data ?? []) as Product[];
  const sellers = profiles.filter((profile) => profile.role === 'seller');
  const selectedSeller = selectedSellerId && sellers.some((row) => row.id === selectedSellerId)
    ? selectedSellerId
    : sellers.find((row) => row.is_active)?.id ?? sellers[0]?.id ?? null;

  const sellerAccount = await getSellerAccount(selectedSeller);

  const saleIds = (salesRes.data ?? []).map((row) => row.id);
  const saleItemsRes = saleIds.length
    ? await supabase.from('sales_items').select('*').in('sale_id', saleIds)
    : { data: [] as SaleItem[] };

  const recentSales = ((salesRes.data ?? []) as Sale[]).map((sale) => {
    const seller = sellers.find((row) => row.id === sale.seller_id);
    const lines = ((saleItemsRes.data ?? []) as SaleItem[]).filter((line) => line.sale_id === sale.id);
    return {
      id: sale.id,
      seller_name: seller?.display_name ?? seller?.email ?? sale.seller_id,
      payment_method: sale.payment_method,
      sold_at: sale.sold_at,
      total: lines.reduce((sum, line) => sum + toNumber(line.quantity) * toNumber(line.unit_sale_price), 0),
    };
  });

  return {
    profiles,
    sellers,
    products,
    selectedSellerId: selectedSeller,
    sellerAccount,
    recentSales,
    metrics: {
      sellers: sellers.length,
      products: products.length,
      pending: sellerAccount.financial.pendingTotal,
      stockCurrentValue: sellerAccount.financial.stockCurrentValue,
    },
  };
}

export async function getSellerDashboardData(profileId: string) {
  const sellerAccount = await getSellerAccount(profileId);

  return {
    sellerAccount,
    metrics: {
      stockLines: sellerAccount.stockLines.length,
      totalSold: sellerAccount.financial.soldTotal,
      totalRendido: sellerAccount.financial.renderedTotal,
      pendiente: sellerAccount.financial.pendingTotal,
      stockCurrentValue: sellerAccount.financial.stockCurrentValue,
    },
  };
}
