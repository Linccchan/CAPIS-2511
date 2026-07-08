-- =============================================================================
-- DMC Export Consolidation System — Database Schema (schema-of-record)
-- =============================================================================
-- Reconstructed on 2026-07-08 by introspecting the live Supabase `public`
-- schema (information_schema.columns + pg_constraint). This file exists because
-- the project had no committed schema; treat it as the source of truth going
-- forward and update it alongside any DB change.
--
-- Captured here:   tables, columns, data types, NOT NULL, defaults,
--                  primary keys (all `id`), foreign keys.
-- NOT captured here (kept in the live DB — regenerate if you need them):
--   * UNIQUE / CHECK constraints and indexes
--   * FK ON DELETE / ON UPDATE actions (default assumed: NO ACTION)
--   * Row-Level Security policies + helper functions
--     (has_role, current_user_role, customer_can_read_order, ...)
--     — RLS is ENABLED on every table below; see db/SCHEMA.md for policy state.
-- All statuses are plain `text` with defaults (no Postgres enums exist).
-- =============================================================================

-- ---------- Auth / core ------------------------------------------------------

create table profiles (
  id            uuid primary key references auth.users (id),  -- = Supabase auth user id
  full_name     text not null,
  email         text not null,
  role          text not null,            -- admin | sales | management | procurement | warehouse | customer
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
  is_available        boolean not null default true
);

-- ---------- Module 1: Customer Interaction -----------------------------------

create table customer_orders (
  id                    uuid primary key default gen_random_uuid(),
  customer_id           uuid not null references customers (id),
  order_number          text not null,
  destination_country   text,
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
  status                  text not null default 'draft',
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
  created_at    timestamptz default now()
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
