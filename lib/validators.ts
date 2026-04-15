import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Correo inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
});

export const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  display_name: z.string().min(2),
  phone: z.string().optional().or(z.literal('')),
  role: z.enum(['owner', 'seller']),
});

export const supplierSchema = z.object({
  name: z.string().min(2),
  contact_name: z.string().optional().or(z.literal('')),
  contact_phone: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
});

export const productSchema = z.object({
  supplier_id: z.string().uuid().optional().or(z.literal('')),
  sku: z.string().optional().or(z.literal('')),
  name: z.string().min(2),
  description: z.string().optional().or(z.literal('')),
  default_sale_price: z.coerce.number().min(0),
});

export const consignmentSchema = z.object({
  seller_id: z.string().uuid(),
  supplier_id: z.string().uuid().optional().or(z.literal('')),
  product_id: z.string().uuid(),
  quantity_assigned: z.coerce.number().int().positive(),
  unit_sale_price: z.coerce.number().min(0),
  notes: z.string().optional().or(z.literal('')),
});

export const saleSchema = z.object({
  consignment_id: z.string().uuid(),
  consignment_item_id: z.string().uuid(),
  quantity: z.coerce.number().int().positive(),
  payment_method: z.enum(['cash', 'transfer', 'mixed']),
  notes: z.string().optional().or(z.literal('')),
});

export const reconciliationSchema = z.object({
  consignment_id: z.string().uuid(),
  type: z.enum(['partial', 'total']),
  cash_received: z.coerce.number().min(0),
  transfer_received: z.coerce.number().min(0),
  consignment_item_id: z.string().uuid().optional().or(z.literal('')),
  quantity_returned: z.coerce.number().int().min(0).optional(),
  notes: z.string().optional().or(z.literal('')),
});

export const messageSchema = z.object({
  seller_id: z.string().uuid().optional().or(z.literal('')),
  body: z.string().min(1),
});

export const locationSchema = z.object({
  latitude: z.coerce.number(),
  longitude: z.coerce.number(),
  note: z.string().optional().or(z.literal('')),
});
