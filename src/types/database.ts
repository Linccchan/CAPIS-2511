// src/types/database.ts
// Auto-maintained types matching the full public schema + migration_001

export type Role = 'customer' | 'admin' | 'warehouse' | 'management' | 'supplier';
export type OrderStatus =
  | 'draft' | 'pending_quotation' | 'pfi_sent' | 'submitted'
  | 'awaiting_down_payment' | 'payment_verified' | 'procurement_started'
  | 'partially_received' | 'warehouse_preparation' | 'ready_for_shipment'
  | 'shipped' | 'completed' | 'cancelled';
export type POStatus = 'draft' | 'sent' | 'partially_delivered' | 'delivered' | 'cancelled';
export type DeliveryStatus = 'pending_confirmation' | 'received' | 'with_discrepancy' | 'rejected';
export type ConditionStatus = 'good' | 'damaged' | 'missing' | 'wrong_item';
export type TaskStatus = 'pending' | 'in_progress' | 'completed';
export type QuotationStatus = 'draft' | 'sent' | 'approved' | 'expired' | 'rejected';
export type BillingStatus = 'pending' | 'partially_paid' | 'paid' | 'cancelled';
export type PaymentType = 'down_payment' | 'balance';
export type PaymentStatus = 'pending' | 'verified' | 'rejected';
export type ShipmentStatus = 'planning' | 'ready_for_loading' | 'loaded' | 'shipped' | 'completed' | 'cancelled';
export type DocumentType = 'pro_forma_invoice' | 'supplier_invoice' | 'packing_list' | 'export_declaration' | 'certificate' | 'bill_of_lading' | 'other';
export type DocumentStatus = 'required' | 'uploaded' | 'verified' | 'missing';
export type StickerDesignStatus = 'photo_sent' | 'awaiting_customer' | 'design_received' | 'printed';
export type SupplierType = 'manufacturer' | 'distributor' | 'supermarket';
export type CostSource = 'po_derived' | 'manual';

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: Role;
  company_name?: string;
  phone_number?: string;
  created_at: string;
}

export interface Customer {
  id: string;
  profile_id?: string;
  company_name: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  country?: string;
  address?: string;
  odoo_customer_id?: string;
  created_at: string;
}

export interface Supplier {
  id: string;
  supplier_name: string;
  supplier_type?: SupplierType;
  contact_person?: string;
  email?: string;
  phone?: string;
  address?: string;
  odoo_supplier_id?: string;
  created_at: string;
}

export interface Product {
  id: string;
  product_name: string;
  sku?: string;
  category?: string;
  brand?: string;
  unit?: string;
  default_supplier_id?: string;
  odoo_product_id?: string;
  is_available: boolean;
  unit_cbm?: number;
  unit_weight_kg?: number;
  created_at: string;
}

export interface CustomerOrder {
  id: string;
  customer_id: string;
  order_number: string;
  destination_country?: string;
  status: OrderStatus;
  order_date: string;
  confirmed_at?: string;
  estimated_ready_date?: string;
  actual_ready_date?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  // joined
  customers?: Customer;
}

export interface CustomerOrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity_ordered: number;
  unit_price?: number;
  notes?: string;
  created_at: string;
  products?: Product;
}

export interface Quotation {
  id: string;
  order_id: string;
  quotation_number: string;
  status: QuotationStatus;
  prepared_by?: string;
  sent_at?: string;
  approved_at?: string;
  expires_at?: string;
  created_at: string;
  customer_orders?: CustomerOrder;
}

export interface QuotationItem {
  id: string;
  quotation_id: string;
  product_id: string;
  quantity_requested: number;
  unit_price?: number;
  notes?: string;
  created_at: string;
  products?: Product;
}

export interface PurchaseOrder {
  id: string;
  order_id: string;
  supplier_id: string;
  po_number: string;
  status: POStatus;
  issued_date?: string;
  expected_delivery_date?: string;
  actual_completed_date?: string;
  odoo_purchase_order_id?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  suppliers?: Supplier;
  customer_orders?: CustomerOrder;
}

export interface PurchaseOrderItem {
  id: string;
  purchase_order_id: string;
  product_id: string;
  quantity_ordered: number;
  quantity_received: number;
  unit_cost?: number;
  created_at: string;
  products?: Product;
}

export interface SupplierDelivery {
  id: string;
  purchase_order_id: string;
  supplier_id: string;
  delivery_date: string;
  received_by?: string;
  delivery_status: DeliveryStatus;
  remarks?: string;
  created_at: string;
  suppliers?: Supplier;
  purchase_orders?: PurchaseOrder;
}

export interface SupplierDeliveryItem {
  id: string;
  delivery_id: string;
  product_id: string;
  quantity_delivered: number;
  quantity_accepted: number;
  condition_status?: ConditionStatus;
  remarks?: string;
  created_at: string;
  products?: Product;
}

export interface WarehouseLocation {
  id: string;
  location_code: string;
  description?: string;
  is_active: boolean;
  created_at: string;
}

export interface InventoryBatch {
  id: string;
  order_id?: string;
  product_id: string;
  delivery_item_id?: string;
  location_id?: string;
  quantity_available: number;
  quantity_staged: number;
  received_date?: string;
  created_at: string;
  products?: Product;
  warehouse_locations?: WarehouseLocation;
  customer_orders?: CustomerOrder;
}

export interface LabelingTask {
  id: string;
  order_id: string;
  product_id: string;
  label_type?: string;
  required_quantity: number;
  completed_quantity: number;
  status: TaskStatus;
  assigned_to?: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
  products?: Product;
  customer_orders?: CustomerOrder;
}

export interface StagingTask {
  id: string;
  order_id: string;
  product_id: string;
  required_quantity: number;
  staged_quantity: number;
  status: TaskStatus;
  assigned_to?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
  products?: Product;
  customer_orders?: CustomerOrder;
}

export interface StickerDesign {
  id: string;
  order_id: string;
  product_id: string;
  destination_country?: string;
  file_path?: string;
  status: StickerDesignStatus;
  created_at: string;
  updated_at: string;
  products?: Product;
  customer_orders?: CustomerOrder;
}

export interface Document {
  id: string;
  order_id: string;
  document_type: DocumentType;
  file_name: string;
  file_path: string;
  status: DocumentStatus;
  uploaded_by?: string;
  uploaded_at: string;
  version: number;
  supersedes_id?: string;
}

export interface Billing {
  id: string;
  order_id: string;
  billing_number: string;
  total_amount: number;
  down_payment_required: number;
  balance_amount: number;
  billing_status: BillingStatus;
  odoo_invoice_id?: string;
  created_at: string;
  updated_at: string;
  customer_orders?: CustomerOrder;
}

export interface Payment {
  id: string;
  billing_id: string;
  payment_type: PaymentType;
  bank_name?: 'BDO' | 'Chinabank' | 'Other';
  amount: number;
  payment_date?: string;
  proof_file_path?: string;
  status: PaymentStatus;
  verified_by?: string;
  verified_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Shipment {
  id: string;
  order_id: string;
  shipment_number?: string;
  container_number?: string;
  booking_date?: string;
  estimated_ship_date?: string;
  actual_ship_date?: string;
  status: ShipmentStatus;
  created_at: string;
  updated_at: string;
}

export interface PredictionRecord {
  id: string;
  order_id: string;
  predicted_ready_date?: string;
  confidence_score?: number;
  model_version?: string;
  input_summary?: Record<string, unknown>;
  created_at: string;
}

export interface SupplierPerformance {
  id: string;
  supplier_id: string;
  average_lead_time_days?: number;
  late_delivery_count: number;
  total_purchase_orders: number;
  reliability_score?: number;
  calculated_at: string;
  suppliers?: Supplier;
}

export interface ProductPrice {
  id: string;
  product_id: string;
  selling_price: number;
  currency: string;
  effective_from: string;
  effective_to?: string;
  set_by?: string;
  created_at: string;
}

export interface SupplierProductCost {
  id: string;
  supplier_id: string;
  product_id: string;
  unit_cost: number;
  currency: string;
  effective_from: string;
  effective_to?: string;
  source: CostSource;
  purchase_order_id?: string;
  updated_by?: string;
  created_at: string;
  products?: Product;
  suppliers?: Supplier;
}

export interface Notification {
  id: string;
  user_id: string;
  order_id?: string;
  type: string;
  title: string;
  message?: string;
  is_read: boolean;
  created_at: string;
}

export interface OrderStatusHistory {
  id: string;
  order_id: string;
  from_status?: string;
  to_status: string;
  changed_by?: string;
  changed_at: string;
}
