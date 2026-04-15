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
  SellerOverview,
  SellerProductBalance,
} from '@/lib/types';

type SellerDetail = {
  profile: Profile;
  overview: SellerOverview;
  stockLines: SellerProductBalance[];
  sales: Array<{ sold_at: string; payment_method: string; quantity: number; amount: number; product_name: string }>;
  reconciliations: Array<{ created_at: string; type: string; amount: number; notes: string | null }>;
  messages: InternalMessage[];
  openConsignmentId: string | null;
};

function labelProfile(profile: Profile) {
  return profile.display_name ?? profile.username ?? profile.email ?? 'Sin nombre';
}

function buildBalances(args: {
  profiles: Profile[];
  products: Product[];
  consignments: Consignment[];
  items: ConsignmentItem[];
  sales: Sale[];
  salesItems: SaleItem[];
  reconciliations: Reconciliation[];
  reconciliationItems: ReconciliationItem[];
  messages: InternalMessage[];
}) {
  const { profiles, products, consignments, items, sales, salesItems, reconciliations, reconciliationItems, messages } = args;

  const consignmentById = new Map(consignments.map((row) => [row.id, row]));
  const itemById = new Map(items.map((row) => [row.id, row]));
  const productById = new Map(products.map((row) => [row.id, row]));
  const salesById = new Map(sales.map((row) => [row.id, row]));
  const reconciliationById = new Map(reconciliations.map((row) => [row.id, row]));
  const sellers = profiles.filter((row) => row.role === 'seller');

  const lineMap = new Map<string, SellerProductBalance>();
  const salesPerSeller = new Map<string, SellerDetail['sales']>();
  const reconciliationsPerSeller = new Map<string, SellerDetail['reconciliations']>();
  const messagesPerSeller = new Map<string, InternalMessage[]>();
  const openConsignmentBySeller = new Map<string, string | null>();

  for (const seller of sellers) {
    salesPerSeller.set(seller.id, []);
    reconciliationsPerSeller.set(seller.id, []);
    messagesPerSeller.set(seller.id, messages.filter((row) => row.seller_id === seller.id));
    const open = consignments.find((row) => row.seller_id === seller.id && row.status === 'open');
    openConsignmentBySeller.set(seller.id, open?.id ?? null);
  }

  for (const item of items) {
    const consignment = consignmentById.get(item.consignment_id);
    if (!consignment) continue;

    const key = `${consignment.seller_id}:${item.product_id}`;
    const existing = lineMap.get(key);
    const unitPrice = toNumber(item.unit_sale_price);
    const product = productById.get(item.product_id);

    if (existing) {
      existing.assigned += toNumber(item.quantity_assigned);
      existing.unit_price = unitPrice;
    } else {
      lineMap.set(key, {
        seller_id: consignment.seller_id,
        product_id: item.product_id,
        product_name: product?.name ?? item.products?.name ?? item.product_id,
        unit_price: unitPrice,
        assigned: toNumber(item.quantity_assigned),
        sold: 0,
        returned: 0,
        current: 0,
        sold_amount: 0,
        current_value: 0,
      });
    }
  }

  for (const saleItem of salesItems) {
    const sale = salesById.get(saleItem.sale_id);
    const item = itemById.get(saleItem.consignment_item_id);
    if (!sale || !item) continue;
    const consignment = consignmentById.get(item.consignment_id);
    if (!consignment) continue;

    const key = `${consignment.seller_id}:${item.product_id}`;
    const line = lineMap.get(key);
    if (!line) continue;

    const quantity = toNumber(saleItem.quantity);
    const amount = quantity * toNumber(saleItem.unit_sale_price);
    line.sold += quantity;
    line.sold_amount += amount;

    const list = salesPerSeller.get(consignment.seller_id) ?? [];
    list.push({
      sold_at: sale.sold_at,
      payment_method: sale.payment_method,
      quantity,
      amount,
      product_name: line.product_name,
    });
    salesPerSeller.set(consignment.seller_id, list);
  }

  for (const reconciliationItem of reconciliationItems) {
    const reconciliation = reconciliationById.get(reconciliationItem.reconciliation_id);
    const item = itemById.get(reconciliationItem.consignment_item_id);
    if (!reconciliation || !item) continue;
    const consignment = consignmentById.get(item.consignment_id);
    if (!consignment) continue;

    const key = `${consignment.seller_id}:${item.product_id}`;
    const line = lineMap.get(key);
    if (!line) continue;
    line.returned += toNumber(reconciliationItem.quantity_returned);
  }

  for (const reconciliation of reconciliations) {
    const amount = toNumber(reconciliation.cash_received) + toNumber(reconciliation.transfer_received);
    const list = reconciliationsPerSeller.get(reconciliation.seller_id) ?? [];
    list.push({
      created_at: reconciliation.created_at,
      type: reconciliation.type,
      amount,
      notes: reconciliation.notes,
    });
    reconciliationsPerSeller.set(reconciliation.seller_id, list);
  }

  const stockLinesBySeller = new Map<string, SellerProductBalance[]>();

  for (const line of lineMap.values()) {
    line.current = line.assigned - line.sold - line.returned;
    line.current_value = line.current * line.unit_price;
    const list = stockLinesBySeller.get(line.seller_id) ?? [];
    list.push(line);
    stockLinesBySeller.set(line.seller_id, list);
  }

  for (const list of stockLinesBySeller.values()) {
    list.sort((a, b) => a.product_name.localeCompare(b.product_name, 'es'));
  }

  const sellerOverviews: SellerOverview[] = sellers.map((seller) => {
    const stock = stockLinesBySeller.get(seller.id) ?? [];
    const soldAmount = stock.reduce((sum, row) => sum + row.sold_amount, 0);
    const rendidoAmount = (reconciliationsPerSeller.get(seller.id) ?? []).reduce((sum, row) => sum + row.amount, 0);

    return {
      seller_id: seller.id,
      seller_name: labelProfile(seller),
      seller_username: seller.username,
      assigned_units: stock.reduce((sum, row) => sum + row.assigned, 0),
      sold_units: stock.reduce((sum, row) => sum + row.sold, 0),
      returned_units: stock.reduce((sum, row) => sum + row.returned, 0),
      current_units: stock.reduce((sum, row) => sum + row.current, 0),
      sold_amount: soldAmount,
      rendido_amount: rendidoAmount,
      pendiente_amount: soldAmount - rendidoAmount,
      open_consignment_id: openConsignmentBySeller.get(seller.id) ?? null,
    };
  });

  sellerOverviews.sort((a, b) => b.pendiente_amount - a.pendiente_amount || a.seller_name.localeCompare(b.seller_name, 'es'));

  return {
    sellerOverviews,
    stockLinesBySeller,
    salesPerSeller,
    reconciliationsPerSeller,
    messagesPerSeller,
    openConsignmentBySeller,
  };
}

export async function getAdminDashboardData(selectedSellerId?: string) {
  const supabase = await createClient();

  const [profilesRes, productsRes, consignmentsRes, itemsRes, salesRes, salesItemsRes, reconciliationsRes, reconciliationItemsRes, messagesRes] = await Promise.all([
    supabase.from('profiles').select('*').order('created_at', { ascending: false }),
    supabase.from('products').select('*').order('created_at', { ascending: false }),
    supabase.from('consignments').select('*').order('created_at', { ascending: false }),
    supabase.from('consignment_items').select('*, products(name)').order('created_at', { ascending: false }),
    supabase.from('sales').select('id, seller_id, payment_method, sold_at, consignment_id, notes').order('sold_at', { ascending: false }),
    supabase.from('sales_items').select('id, sale_id, consignment_item_id, quantity, unit_sale_price'),
    supabase.from('reconciliations').select('id, seller_id, type, cash_received, transfer_received, created_at, consignment_id, notes').order('created_at', { ascending: false }),
    supabase.from('reconciliation_items').select('id, reconciliation_id, consignment_item_id, quantity_returned'),
    supabase.from('internal_messages').select('*').order('created_at', { ascending: false }).limit(50),
  ]);

  const profiles = (profilesRes.data ?? []) as Profile[];
  const products = (productsRes.data ?? []) as Product[];
  const consignments = (consignmentsRes.data ?? []) as Consignment[];
  const items = (itemsRes.data ?? []) as ConsignmentItem[];
  const sales = (salesRes.data ?? []) as Sale[];
  const salesItems = (salesItemsRes.data ?? []) as SaleItem[];
  const reconciliations = (reconciliationsRes.data ?? []) as Reconciliation[];
  const reconciliationItems = (reconciliationItemsRes.data ?? []) as ReconciliationItem[];
  const messages = (messagesRes.data ?? []) as InternalMessage[];

  const derived = buildBalances({
    profiles,
    products,
    consignments,
    items,
    sales,
    salesItems,
    reconciliations,
    reconciliationItems,
    messages,
  });

  const sellerProfiles = profiles.filter((profile) => profile.role === 'seller');
  const currentSellerId = selectedSellerId && sellerProfiles.some((row) => row.id === selectedSellerId)
    ? selectedSellerId
    : sellerProfiles[0]?.id;

  let selectedSeller: SellerDetail | null = null;

  if (currentSellerId) {
    const profile = sellerProfiles.find((row) => row.id === currentSellerId) ?? null;
    const overview = derived.sellerOverviews.find((row) => row.seller_id === currentSellerId) ?? null;

    if (profile && overview) {
      selectedSeller = {
        profile,
        overview,
        stockLines: derived.stockLinesBySeller.get(currentSellerId) ?? [],
        sales: (derived.salesPerSeller.get(currentSellerId) ?? []).sort((a, b) => Date.parse(b.sold_at) - Date.parse(a.sold_at)).slice(0, 20),
        reconciliations: (derived.reconciliationsPerSeller.get(currentSellerId) ?? []).sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)).slice(0, 20),
        messages: (derived.messagesPerSeller.get(currentSellerId) ?? []).slice(0, 20),
        openConsignmentId: derived.openConsignmentBySeller.get(currentSellerId) ?? null,
      };
    }
  }

  const totalSold = derived.sellerOverviews.reduce((sum, row) => sum + row.sold_amount, 0);
  const totalRendido = derived.sellerOverviews.reduce((sum, row) => sum + row.rendido_amount, 0);

  return {
    profiles,
    products,
    consignments,
    items,
    sellerOverviews: derived.sellerOverviews,
    selectedSeller,
    metrics: {
      sellers: sellerProfiles.length,
      products: products.length,
      activeSellersWithStock: derived.sellerOverviews.filter((row) => row.current_units > 0).length,
      totalSold,
      totalRendido,
      pendiente: totalSold - totalRendido,
    },
  };
}

export async function getSellerDashboardData(profileId: string) {
  const supabase = await createClient();

  const [profileRes, productsRes, consignmentsRes, itemsRes, salesRes, salesItemsRes, reconciliationsRes, reconciliationItemsRes, messagesRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', profileId).maybeSingle(),
    supabase.from('products').select('*').order('created_at', { ascending: false }),
    supabase.from('consignments').select('*').eq('seller_id', profileId).order('created_at', { ascending: false }),
    supabase.from('consignment_items').select('*, products(name)').order('created_at', { ascending: false }),
    supabase.from('sales').select('id, seller_id, payment_method, sold_at, consignment_id, notes').eq('seller_id', profileId).order('sold_at', { ascending: false }),
    supabase.from('sales_items').select('id, sale_id, consignment_item_id, quantity, unit_sale_price'),
    supabase.from('reconciliations').select('id, seller_id, type, cash_received, transfer_received, created_at, consignment_id, notes').eq('seller_id', profileId).order('created_at', { ascending: false }),
    supabase.from('reconciliation_items').select('id, reconciliation_id, consignment_item_id, quantity_returned'),
    supabase.from('internal_messages').select('*').eq('seller_id', profileId).order('created_at', { ascending: false }).limit(50),
  ]);

  const profile = (profileRes.data as Profile | null) ?? null;
  const products = (productsRes.data ?? []) as Product[];
  const consignments = (consignmentsRes.data ?? []) as Consignment[];
  const consignmentIds = new Set(consignments.map((row) => row.id));
  const items = ((itemsRes.data ?? []) as ConsignmentItem[]).filter((row) => consignmentIds.has(row.consignment_id));
  const sales = (salesRes.data ?? []) as Sale[];
  const saleIds = new Set(sales.map((row) => row.id));
  const salesItems = ((salesItemsRes.data ?? []) as SaleItem[]).filter((row) => saleIds.has(row.sale_id));
  const reconciliations = (reconciliationsRes.data ?? []) as Reconciliation[];
  const reconciliationIds = new Set(reconciliations.map((row) => row.id));
  const reconciliationItems = ((reconciliationItemsRes.data ?? []) as ReconciliationItem[]).filter((row) => reconciliationIds.has(row.reconciliation_id));
  const messages = (messagesRes.data ?? []) as InternalMessage[];

  const derived = buildBalances({
    profiles: profile ? [profile] : [],
    products,
    consignments,
    items,
    sales,
    salesItems,
    reconciliations,
    reconciliationItems,
    messages,
  });

  const overview = derived.sellerOverviews[0] ?? {
    seller_id: profileId,
    seller_name: profile?.display_name ?? profile?.username ?? profile?.email ?? 'Vendedor',
    seller_username: profile?.username ?? null,
    assigned_units: 0,
    sold_units: 0,
    returned_units: 0,
    current_units: 0,
    sold_amount: 0,
    rendido_amount: 0,
    pendiente_amount: 0,
    open_consignment_id: consignments.find((row) => row.status === 'open')?.id ?? null,
  };

  return {
    profile,
    consignments,
    items,
    stockLines: derived.stockLinesBySeller.get(profileId) ?? [],
    sales: (derived.salesPerSeller.get(profileId) ?? []).sort((a, b) => Date.parse(b.sold_at) - Date.parse(a.sold_at)),
    reconciliations: (derived.reconciliationsPerSeller.get(profileId) ?? []).sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)),
    messages,
    metrics: {
      openConsignments: consignments.filter((row) => row.status !== 'closed').length,
      stockLines: (derived.stockLinesBySeller.get(profileId) ?? []).length,
      currentUnits: overview.current_units,
      totalSold: overview.sold_amount,
      totalRendido: overview.rendido_amount,
      pendiente: overview.pendiente_amount,
    },
  };
}
