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

export type Sale = {
  id: string;
  consignment_id: string;
  seller_id: string;
  payment_method: PaymentMethod;
  sold_at: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type SaleItem = {
  id: string;
  sale_id: string;
  consignment_item_id: string;
  quantity: number;
  unit_sale_price: number | string;
  created_at: string;
  updated_at: string;
};

export type Reconciliation = {
  id: string;
  consignment_id: string;
  seller_id: string;
  type: ReconciliationType;
  cash_received: number | string;
  transfer_received: number | string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ReconciliationItem = {
  id: string;
  reconciliation_id: string;
  consignment_item_id: string;
  quantity_returned: number;
  created_at: string;
  updated_at: string;
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
  consignment_item_id: string;
  product_id: string;
  product_name: string;
  quantity_assigned: number;
  quantity_sold: number;
  quantity_returned: number;
  quantity_current: number;
  unit_sale_price: number;
  current_value: number;
  sold_value: number;
};

export type SellerFinancialSummary = {
  soldTotal: number;
  renderedTotal: number;
  pendingTotal: number;
  stockCurrentValue: number;
  returnedValue: number;
};
