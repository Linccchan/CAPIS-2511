-- =============================================================================
-- DMC Export Consolidation System — Database Schema (schema-of-record)
-- =============================================================================
-- Reconstructed by introspecting the live Supabase `public` schema.
-- Re-synced 2026-07-26 to match the live DB after teammates applied changes
-- directly via the SQL editor (warehouse columns, dropped PO status check,
-- migrations 005/007/008 tables & policies). Treat this as the source of
-- truth and update it alongside any DB change.
--
-- Captured here:   tables, columns, data types, NOT NULL, defaults,
--                  primary keys (all `id`), foreign keys, CHECK constraints
--                  (see the block at the end of this file).
-- NOT captured here (kept in the live DB — regenerate if you need them):
--   * UNIQUE constraints and indexes
--   * FK ON DELETE / ON UPDATE actions (default assumed: NO ACTION)
--   * Row-Level Security policies + helper functions
--     (has_role, current_user_role, customer_can_read_order, ...)
--     — RLS is ENABLED on every table below; see db/SCHEMA.md for policy state.
-- Statuses are `text` (no Postgres enums), but every status/role/type column
-- is vocabulary-enforced by a CHECK constraint — see the end of this file.
-- =============================================================================

-- ---------- Auth / core ------------------------------------------------------

create table profiles (
  id            uuid primary key references auth.users (id),  -- = Supabase auth user id
  full_name     text not null,
  email         text not null,
  role          text not null,            -- admin | sales | management | procurement | warehouse | customer | supplier
  company_name  text,
  phone_number  text,
  created_at    timestamptz default now()
);

create table suppliers (
  id                uuid primary key default gen_random_uuid(),
  supplier_name     text not null,
  supplier_type     text,                 -- manufacturer | distributor | supermarket
  contact_person    text,
  email             text,
  phone             text,
  address           text,
  odoo_supplier_id  text,
  profile_id        uuid references profiles (id),   -- migration 005; links a supplier login account
  created_at        timestamptz default now()
);

create table customers (
  id                uuid primary key default gen_random_uuid(),
  profile_id        uuid references profiles (id),
  company_name      text not null,
  contact_person    text,
  email             text,
  phone             text,
  country           text,
  address           text,
  odoo_customer_id  text,
  created_at        timestamptz default now()
);

-- Customer delivery locations (migration 006) — destinations for quotation
-- requests come from this pre-saved list, not free text. Country is any
-- value from the UI's standardized country dropdown (not limited to DMC's
-- current markets — new customers can come from new countries).
create table customer_locations (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers (id),
  label       text not null,
  country     text not null,
  address     text,
  is_default  boolean not null default false,
  created_at  timestamptz default now()
);

create table products (
  id                  uuid primary key default gen_random_uuid(),
  product_name        text not null,
  sku                 text,
  category            text,
  brand               text,
  unit                text,
  default_supplier_id uuid references suppliers (id),
  odoo_product_id     text,
  created_at          timestamptz default now(),
  unit_cbm            real,
  unit_weight_kg      real,
  is_available        boolean not null default true,
  image_url           text
);

-- ---------- Module 1: Customer Interaction -----------------------------------

create table customer_orders (
  id                    uuid primary key default gen_random_uuid(),
  customer_id           uuid not null references customers (id),
  order_number          text not null,                 -- QT-YYYY-NNN, renamed ORD-YYYY-NNN on approval
  quotation_number      text,                          -- added 2026-07-09 (migration 004); keeps the QT- number
  destination_country   text,                          -- denormalized from the chosen location
  delivery_location_id  uuid references customer_locations (id),  -- added 2026-07-11 (migration 006)
  preferred_ship_date   date,                          -- added 2026-07-08 (migration 001)
  special_instructions  text,                          -- added 2026-07-08 (migration 001)
  status                text not null default 'draft',
  order_date            date default current_date,
  confirmed_at          timestamptz,
  estimated_ready_date  date,
  actual_ready_date     date,
  created_by            uuid references profiles (id),
  created_at            timestamptz default now()
);

create table customer_order_items (
  id                uuid primary key default gen_random_uuid(),
  order_id          uuid not null references customer_orders (id),
  product_id        uuid not null references products (id),
  quantity_ordered  numeric not null,
  unit_price        numeric,
  notes             text,
  created_at        timestamptz default now()
);

-- ---------- Module 2: Order Management / Procurement --------------------------

create table purchase_orders (
  id                      uuid primary key default gen_random_uuid(),
  order_id                uuid not null references customer_orders (id),
  supplier_id             uuid not null references suppliers (id),
  po_number               text not null,
  status                  text not null default 'draft',   -- UNCONSTRAINED: status check was dropped so the
                                                           -- warehouse module can also write 'Staging' / 'Ready for Shipment'
  issued_date             date,
  expected_delivery_date  date,
  actual_completed_date   date,
  odoo_purchase_order_id  text,
  created_by              uuid references profiles (id),
  created_at              timestamptz default now()
);

create table purchase_order_items (
  id                 uuid primary key default gen_random_uuid(),
  purchase_order_id  uuid not null references purchase_orders (id),
  product_id         uuid not null references products (id),
  quantity_ordered   numeric not null,
  quantity_received  numeric not null default 0,
  status             text not null default 'pending',  -- added by warehouse work (free text; e.g. 'Ready for Shipment')
  sticker_progress   integer default 0,                -- added by warehouse work
  created_at         timestamptz default now()
);

create table supplier_deliveries (
  id                 uuid primary key default gen_random_uuid(),
  purchase_order_id  uuid not null references purchase_orders (id),
  supplier_id        uuid not null references suppliers (id),
  delivery_date      date not null,
  received_by        uuid references profiles (id),
  delivery_status    text not null default 'received',
  remarks            text,
  created_at         timestamptz default now()
);

create table supplier_delivery_items (
  id                  uuid primary key default gen_random_uuid(),
  delivery_id         uuid not null references supplier_deliveries (id),
  product_id          uuid not null references products (id),
  quantity_delivered  numeric not null,
  quantity_accepted   numeric not null default 0,
  condition_status    text default 'good',
  remarks             text,
  created_at          timestamptz default now()
);

-- ---------- Module 3: Supplier & Warehouse Management -------------------------

create table warehouse_locations (
  id            uuid primary key default gen_random_uuid(),
  location_code text not null,
  description   text,
  is_active     boolean default true,
  created_at    timestamptz default now(),
  occupied          boolean not null default false,  -- added by warehouse work
  purchase_order_id uuid                             -- added by warehouse work (plain uuid; no FK in live DB)
);

create table inventory_batches (
  id                 uuid primary key default gen_random_uuid(),
  order_id           uuid references customer_orders (id),
  product_id         uuid not null references products (id),
  delivery_item_id   uuid references supplier_delivery_items (id),
  location_id        uuid references warehouse_locations (id),
  quantity_available numeric not null default 0,
  quantity_staged    numeric not null default 0,
  received_date      date,
  created_at         timestamptz default now()
);

create table labeling_tasks (
  id                  uuid primary key default gen_random_uuid(),
  order_id            uuid not null references customer_orders (id),
  product_id          uuid not null references products (id),
  label_type          text,
  required_quantity   numeric not null,
  completed_quantity  numeric not null default 0,
  status              text not null default 'pending',
  assigned_to         uuid references profiles (id),
  started_at          timestamptz,
  completed_at        timestamptz,
  created_at          timestamptz default now()
);

create table staging_tasks (
  id                 uuid primary key default gen_random_uuid(),
  order_id           uuid not null references customer_orders (id),
  product_id         uuid not null references products (id),
  required_quantity  numeric not null,
  staged_quantity    numeric not null default 0,
  status             text not null default 'pending',
  assigned_to        uuid references profiles (id),
  completed_at       timestamptz,
  created_at         timestamptz default now()
);

create table shipments (
  id                  uuid primary key default gen_random_uuid(),
  order_id            uuid not null references customer_orders (id),
  shipment_number     text,
  container_number    text,
  booking_date        date,
  estimated_ship_date date,
  actual_ship_date    date,
  status              text not null default 'planning',
  created_at          timestamptz default now()
);

-- ---------- Module 5: Billing & Payment --------------------------------------

create table billings (
  id                     uuid primary key default gen_random_uuid(),
  order_id               uuid not null references customer_orders (id),
  billing_number         text not null,
  shipping_amount        numeric not null default 0,     -- added 2026-07-08 (migration 001)
  total_amount           numeric not null default 0,
  down_payment_required  numeric not null default 0,
  balance_amount         numeric not null default 0,
  billing_status         text not null default 'pending',
  valid_until            date,                            -- added 2026-07-08 (migration 001)
  prepared_by            uuid references profiles (id),   -- added 2026-07-08 (migration 001)
  currency               text not null default 'USD',     -- added 2026-07-08 (migration 001)
  odoo_invoice_id        text,
  created_at             timestamptz default now()
);

create table payments (
  id               uuid primary key default gen_random_uuid(),
  billing_id       uuid not null references billings (id),
  payment_type     text not null,          -- e.g. down_payment | balance
  bank_name        text,                    -- e.g. BDO | Chinabank
  amount           numeric not null,
  payment_date     date,
  proof_file_path  text,
  status           text not null default 'pending',
  verified_by      uuid references profiles (id),
  verified_at      timestamptz,
  created_at       timestamptz default now()
);

-- ---------- Module 4: Predictive Analytics -----------------------------------

create table prediction_records (
  id                   uuid primary key default gen_random_uuid(),
  order_id             uuid not null references customer_orders (id),
  predicted_ready_date date,
  confidence_score     numeric,
  model_version        text,
  input_summary        jsonb,
  created_at           timestamptz default now()
);

create table supplier_performance (
  id                     uuid primary key default gen_random_uuid(),
  supplier_id            uuid not null references suppliers (id),
  average_lead_time_days numeric,
  late_delivery_count    integer default 0,
  total_purchase_orders  integer default 0,
  reliability_score      numeric,
  calculated_at          timestamptz default now()
);

-- ---------- Cross-cutting ----------------------------------------------------

create table documents (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid not null references customer_orders (id),
  document_type  text not null,             -- pfi | supplier_invoice | packing_list | fda_cert | ...
  file_name      text not null,
  file_path      text not null,
  status         text not null default 'uploaded',
  uploaded_by    uuid references profiles (id),
  uploaded_at    timestamptz default now()
);

create table activity_logs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references profiles (id),
  action       text not null,
  table_name   text,
  record_id    uuid,
  description  text,
  created_at   timestamptz default now()
);

-- Per-prefix per-year counters behind next_document_number() (migration 004).
-- RLS enabled with no policies: only security-definer functions touch it.
create table number_sequences (
  prefix     text    not null,
  year       integer not null,
  last_value integer not null default 0,
  primary key (prefix, year)
);

-- ---------- Added via migration 007 (tables the staff screens needed) --------

-- Sticker/label design approval workflow (distinct from labeling_tasks)
create table sticker_designs (
  id               uuid primary key default gen_random_uuid(),
  order_id         uuid not null references customer_orders (id),
  product_id       uuid not null references products (id),
  destination      text,
  design_file_path text,
  status           text not null default 'photo_sent',  -- photo_sent | awaiting_customer | design_received | printed
  created_at       timestamptz default now()
);

-- Versioned supplier cost per product (manual entry or PO-derived)
create table supplier_product_costs (
  id             uuid primary key default gen_random_uuid(),
  product_id     uuid not null references products (id),
  supplier_id    uuid not null references suppliers (id),
  unit_cost      numeric not null,
  currency       text not null default 'USD',
  effective_from date,
  effective_to   date,                     -- null = current cost
  source         text default 'manual',    -- manual | po_derived
  updated_by     uuid references profiles (id),
  created_at     timestamptz default now()
);

-- In-app notifications (dispatch alerts, cost-update prompts, ...)
create table notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles (id),
  order_id   uuid references customer_orders (id),
  type       text,
  title      text,
  message    text,
  is_read    boolean not null default false,
  created_at timestamptz default now()
);

-- ---------- CHECK constraints (re-verified from pg_constraint, 2026-07-26) ---
-- Most status/role/type columns are vocabulary-enforced. EXCEPTION:
-- purchase_orders.status and purchase_order_items.status are now FREE TEXT
-- (their check constraints were dropped for the warehouse module).

alter table profiles add constraint profiles_role_check
  check (role in ('admin', 'customer', 'sales', 'procurement', 'warehouse', 'management', 'supplier'));

alter table suppliers add constraint suppliers_supplier_type_check
  check (supplier_type in ('manufacturer', 'distributor', 'supermarket'));

alter table customer_orders add constraint customer_orders_status_check
  check (status in ('draft', 'submitted', 'awaiting_down_payment', 'payment_verified',
                    'procurement_started', 'partially_received', 'warehouse_preparation',
                    'ready_for_shipment', 'shipped', 'completed', 'cancelled'));

alter table customer_order_items add constraint customer_order_items_quantity_ordered_check
  check (quantity_ordered > 0);

-- purchase_orders.status: check constraint was DROPPED via the SQL editor so the
-- warehouse module can write 'Staging' / 'Ready for Shipment'. Values in use:
-- draft | sent | partially_delivered | delivered | cancelled | Staging | Ready for Shipment

alter table purchase_order_items add constraint purchase_order_items_quantity_ordered_check
  check (quantity_ordered > 0);

alter table supplier_deliveries add constraint supplier_deliveries_delivery_status_check
  check (delivery_status in ('pending_confirmation', 'received', 'with_discrepancy', 'rejected'));

alter table supplier_delivery_items add constraint supplier_delivery_items_condition_status_check
  check (condition_status in ('good', 'damaged', 'missing', 'wrong_item'));

alter table supplier_delivery_items add constraint supplier_delivery_items_quantity_delivered_check
  check (quantity_delivered >= 0);

alter table labeling_tasks add constraint labeling_tasks_status_check
  check (status in ('pending', 'in_progress', 'completed'));

alter table staging_tasks add constraint staging_tasks_status_check
  check (status in ('pending', 'in_progress', 'completed'));

alter table shipments add constraint shipments_status_check
  check (status in ('planning', 'ready_for_loading', 'loaded', 'shipped', 'completed', 'cancelled'));

alter table billings add constraint billings_billing_status_check
  check (billing_status in ('pending', 'partially_paid', 'paid', 'cancelled'));

alter table payments add constraint payments_payment_type_check
  check (payment_type in ('down_payment', 'balance'));

alter table payments add constraint payments_status_check
  check (status in ('pending', 'verified', 'rejected'));

alter table payments add constraint payments_bank_name_check
  check (bank_name in ('BDO', 'Chinabank', 'Other'));

alter table payments add constraint payments_amount_check
  check (amount > 0);

alter table documents add constraint documents_status_check
  check (status in ('required', 'uploaded', 'verified', 'missing'));

alter table documents add constraint documents_document_type_check
  check (document_type in ('pro_forma_invoice', 'supplier_invoice', 'packing_list',
                           'export_declaration', 'certificate', 'bill_of_lading', 'other'));
