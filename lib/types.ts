export type AppRole = 'super_admin' | 'owner' | 'seller';
export type ConsignmentStatus = 'open' | 'partially_reconciled' | 'closed' | 'cancelled';
export type PaymentMethod = 'cash' | 'transfer' | 'mixed';
export type ReconciliationType = 'partial' | 'total';

export type Profile = {
  id: string;
  email: string | null;
  display_name: string | null;
  phone: string | null;
  role: AppRole;
  is_active: boolean;
  must_reenroll_security: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Supplier = {
  id: string;
  name: string;
  contact_name: string | null;
  contact_phone: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Product = {
  id: string;
  supplier_id: string | null;
  sku: string | null;
  name: string;
  description: string | null;
  default_sale_price: number | string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Consignment = {
  id: string;
  seller_id: string;
  supplier_id: string | null;
  opened_by: string | null;
  opened_at: string;
  status: ConsignmentStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ConsignmentItem = {
  id: string;
  consignment_id: string;
  product_id: string;
  quantity_assigned: number;
  unit_sale_price: number | string;
  created_at: string;
  updated_at: string;
  products?: { name: string | null } | null;
};

export type InternalMessage = {
  id: string;
  owner_id: string;
  seller_id: string;
  sender_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
};

export type SellerStockLine = {
  product_id: string;
  product_name: string;
  quantity_assigned: number;
  quantity_sold: number;
  quantity_returned: number;
  quantity_current: number;
  average_unit_price: number;
  current_value: number;
  sold_value: number;
  returned_value: number;
  consignment_item_ids: string[];
  open_consignment_id: string | null;
};

export type SellerFinancialSummary = {
  stock_value: number;
  sold_value: number;
  returned_value: number;
  rendido_value: number;
  pendiente_value: number;
};

export type SellerRecentSale = {
  sale_id: string;
  seller_id: string;
  seller_name: string;
  sold_at: string;
  payment_method: PaymentMethod;
  total: number;
  product_names: string[];
};

export type SellerRecentReconciliation = {
  reconciliation_id: string;
  seller_id: string;
  seller_name: string;
  created_at: string;
  type: ReconciliationType;
  cash_received: number;
  transfer_received: number;
  total_received: number;
};

export type SellerSnapshot = {
  seller: Profile;
  open_consignments: Consignment[];
  stock_lines: SellerStockLine[];
  financials: SellerFinancialSummary;
  recent_sales: SellerRecentSale[];
  recent_reconciliations: SellerRecentReconciliation[];
  messages: InternalMessage[];
};
