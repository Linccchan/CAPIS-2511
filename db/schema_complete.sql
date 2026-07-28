-- =============================================================================
-- DMC Export Consolidation System — COMPLETE database creation script
-- =============================================================================
-- Export Consolidation System for DMC Enterprise with Predictive Analytics
-- De La Salle University Manila — Capstone Project
-- https://github.com/Linccchan/CAPIS-2511
--
-- Generated 2026-07-28 from the live Supabase database.
--
-- WHY THIS FILE EXISTS
-- db/schema.sql defines the tables but explicitly excludes RLS policies and
-- helper functions ("kept in the live DB"), and several policies were created
-- directly in the Supabase SQL editor without a corresponding migration file.
-- Running the migrations alone therefore produced a database with the right
-- tables but no working security layer — every policy calls has_role(), which
-- was defined nowhere in the repository.
--
-- This script is self-contained: run it against an empty Postgres/Supabase
-- database and it reproduces the schema, the 9 functions, row-level
-- security, and all 91 policies across 24 tables.
--
-- RUN ORDER
--   1. This file (schema_complete.sql)  — structure, functions, RLS, policies
--   2. db/seed_demo.sql                 — optional staged demo data
--
-- NOT CAPTURED (see the note at the end of this file):
--   * triggers, unique constraints, indexes, storage buckets
-- =============================================================================


-- =============================================================================
-- SECTION 1 — TABLES
-- =============================================================================
-- Verbatim from db/schema.sql (26 tables).

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


-- =============================================================================
-- SECTION 2 — FUNCTIONS
-- =============================================================================
-- Ordered by dependency: helpers before their callers. has_role() is the one
-- every RLS policy depends on, so Section 4 cannot run without this section.

-- ----------------------------------------------------------------------------
-- current_user_role
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_user_role()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select p.role
  from public.profiles p
  where p.id = auth.uid()
  limit 1
$function$
;

-- ----------------------------------------------------------------------------
-- has_role
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_role(allowed_roles text[])
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select auth.uid() is not null
    and public.current_user_role() = any(allowed_roles)
$function$
;

-- ----------------------------------------------------------------------------
-- customer_matches_current_user
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.customer_matches_current_user(customer_id_value text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  matched boolean := false;
begin
  if auth.uid() is null or customer_id_value is null then
    return false;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'customers'
      and column_name = 'profile_id'
  ) then
    execute
      'select exists (
        select 1 from public.customers
        where id::text = $1 and profile_id::text = $2
      )'
      into matched
      using customer_id_value, auth.uid()::text;
    if matched then return true; end if;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'customers'
      and column_name = 'user_id'
  ) then
    execute
      'select exists (
        select 1 from public.customers
        where id::text = $1 and user_id::text = $2
      )'
      into matched
      using customer_id_value, auth.uid()::text;
    if matched then return true; end if;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'customers'
      and column_name = 'auth_user_id'
  ) then
    execute
      'select exists (
        select 1 from public.customers
        where id::text = $1 and auth_user_id::text = $2
      )'
      into matched
      using customer_id_value, auth.uid()::text;
    if matched then return true; end if;
  end if;

  -- Fallback for schemas where customers.id directly stores the auth user id.
  if customer_id_value = auth.uid()::text then
    return true;
  end if;

  return false;
end;
$function$
;

-- ----------------------------------------------------------------------------
-- customer_can_read_order
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.customer_can_read_order(order_customer_id text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select public.has_role(array['admin', 'management', 'sales'])
    or (
      public.current_user_role() = 'customer'
      and public.customer_matches_current_user(order_customer_id)
    )
$function$
;

-- ----------------------------------------------------------------------------
-- customer_can_read_order_item
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.customer_can_read_order_item(order_id_value text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select public.has_role(array['admin', 'management', 'sales'])
    or (
      public.current_user_role() = 'customer'
      and exists (
        select 1
        from public.customer_orders co
        where co.id::text = order_id_value
          and public.customer_matches_current_user(to_jsonb(co)->>'customer_id')
      )
    )
$function$
;

-- ----------------------------------------------------------------------------
-- next_document_number
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.next_document_number(p_prefix text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v integer;
  y integer := extract(year from current_date)::integer;
begin
  insert into number_sequences (prefix, year, last_value)
  values (p_prefix, y, 1)
  on conflict (prefix, year)
  do update set last_value = number_sequences.last_value + 1
  returning last_value into v;

  return p_prefix || '-' || y::text || '-' || lpad(v::text, 3, '0');
end;
$function$
;

-- ----------------------------------------------------------------------------
-- approve_quotation
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.approve_quotation(p_order_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_expired boolean;
begin
  select b.valid_until is not null and b.valid_until < current_date
    into v_expired
  from billings b
  where b.order_id = p_order_id;

  if v_expired then
    raise exception 'This quotation has expired. Please request a refreshed PFI from DMC.';
  end if;

  update customer_orders co
     set status = 'awaiting_down_payment',
         confirmed_at = now(),
         quotation_number = coalesce(co.quotation_number, co.order_number),
         order_number = next_document_number('ORD')
   where co.id = p_order_id
     and co.status = 'submitted'
     and exists (
           select 1 from customers c
           where c.id = co.customer_id
             and c.profile_id = auth.uid()
         );

  if not found then
    raise exception 'Order not found, not yours, or not awaiting approval';
  end if;
end;
$function$
;

-- ----------------------------------------------------------------------------
-- handle_new_user
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'New User'),
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'customer')
  );

  return new;
end;
$function$
;

-- ----------------------------------------------------------------------------
-- rls_auto_enable
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$
;


-- =============================================================================
-- SECTION 3 — ENABLE ROW-LEVEL SECURITY
-- =============================================================================
-- RLS is enabled on every table. With RLS on and no policy, a table denies all
-- access, so Section 4 must run immediately after this.

alter table profiles enable row level security;
alter table suppliers enable row level security;
alter table customers enable row level security;
alter table customer_locations enable row level security;
alter table products enable row level security;
alter table customer_orders enable row level security;
alter table customer_order_items enable row level security;
alter table purchase_orders enable row level security;
alter table purchase_order_items enable row level security;
alter table supplier_deliveries enable row level security;
alter table supplier_delivery_items enable row level security;
alter table warehouse_locations enable row level security;
alter table inventory_batches enable row level security;
alter table labeling_tasks enable row level security;
alter table staging_tasks enable row level security;
alter table shipments enable row level security;
alter table billings enable row level security;
alter table payments enable row level security;
alter table prediction_records enable row level security;
alter table supplier_performance enable row level security;
alter table documents enable row level security;
alter table activity_logs enable row level security;
alter table number_sequences enable row level security;
alter table sticker_designs enable row level security;
alter table supplier_product_costs enable row level security;
alter table notifications enable row level security;


-- =============================================================================
-- SECTION 4 — ROW-LEVEL SECURITY POLICIES
-- =============================================================================
-- 91 policies across 24 tables.
--
-- Role model: admin, sales, procurement, warehouse, management, supplier,
-- customer. Staff access is granted through has_role(); customers and
-- suppliers reach their own rows through ownership chains
-- (customers.profile_id / suppliers.profile_id = auth.uid()).

-- ----------------------------------------------------------------------------
-- profiles
-- ----------------------------------------------------------------------------
create policy "Users can view their own profile" on profiles for select to authenticated using ((auth.uid() = id));

create policy "Users can update their own profile" on profiles for update to authenticated using ((auth.uid() = id)) with check ((auth.uid() = id));

-- ----------------------------------------------------------------------------
-- suppliers
-- ----------------------------------------------------------------------------
create policy "suppliers insert by role" on suppliers for insert to authenticated with check (has_role(ARRAY['admin'::text, 'procurement'::text]));

create policy "suppliers select own or staff" on suppliers for select to authenticated using ((has_role(ARRAY['admin'::text, 'sales'::text, 'management'::text, 'procurement'::text, 'warehouse'::text]) OR (profile_id = auth.uid())));

create policy "suppliers update by role" on suppliers for update to authenticated using (has_role(ARRAY['admin'::text, 'procurement'::text])) with check (has_role(ARRAY['admin'::text, 'procurement'::text]));

-- ----------------------------------------------------------------------------
-- customers
-- ----------------------------------------------------------------------------
create policy "customers delete by role" on customers for delete to authenticated using (has_role(ARRAY['admin'::text]));

create policy "customers insert by role" on customers for insert to authenticated with check (has_role(ARRAY['admin'::text, 'sales'::text]));

create policy "customers read scoped" on customers for select to authenticated using ((has_role(ARRAY['admin'::text, 'sales'::text, 'management'::text, 'procurement'::text, 'warehouse'::text]) OR (profile_id = auth.uid())));

create policy "customers update by role" on customers for update to authenticated using (has_role(ARRAY['admin'::text, 'sales'::text])) with check (has_role(ARRAY['admin'::text, 'sales'::text]));

create policy "customers update own" on customers for update to authenticated using ((profile_id = auth.uid())) with check ((profile_id = auth.uid()));

-- ----------------------------------------------------------------------------
-- customer_locations
-- ----------------------------------------------------------------------------
create policy "customer locations delete own or staff" on customer_locations for delete to authenticated using ((has_role(ARRAY['admin'::text]) OR (EXISTS ( SELECT 1
   FROM customers c
  WHERE ((c.id = customer_locations.customer_id) AND (c.profile_id = auth.uid()))))));

create policy "customer locations insert own or staff" on customer_locations for insert to authenticated with check ((has_role(ARRAY['admin'::text, 'sales'::text]) OR (EXISTS ( SELECT 1
   FROM customers c
  WHERE ((c.id = customer_locations.customer_id) AND (c.profile_id = auth.uid()))))));

create policy "customer locations select own or staff" on customer_locations for select to authenticated using ((has_role(ARRAY['admin'::text, 'sales'::text, 'management'::text]) OR (EXISTS ( SELECT 1
   FROM customers c
  WHERE ((c.id = customer_locations.customer_id) AND (c.profile_id = auth.uid()))))));

create policy "customer locations update own or staff" on customer_locations for update to authenticated using ((has_role(ARRAY['admin'::text, 'sales'::text]) OR (EXISTS ( SELECT 1
   FROM customers c
  WHERE ((c.id = customer_locations.customer_id) AND (c.profile_id = auth.uid())))))) with check ((has_role(ARRAY['admin'::text, 'sales'::text]) OR (EXISTS ( SELECT 1
   FROM customers c
  WHERE ((c.id = customer_locations.customer_id) AND (c.profile_id = auth.uid()))))));

-- ----------------------------------------------------------------------------
-- products
-- ----------------------------------------------------------------------------
create policy "products delete by role" on products for delete to authenticated using (has_role(ARRAY['admin'::text]));

create policy "products insert by role" on products for insert to authenticated with check (has_role(ARRAY['admin'::text, 'management'::text]));

create policy "Enable read access for all users" on products for select to public using (true);

create policy "products select by role" on products for select to authenticated using (has_role(ARRAY['admin'::text, 'management'::text, 'sales'::text, 'procurement'::text, 'warehouse'::text]));

create policy "products update by role" on products for update to authenticated using (has_role(ARRAY['admin'::text, 'management'::text])) with check (has_role(ARRAY['admin'::text, 'management'::text]));

-- ----------------------------------------------------------------------------
-- customer_orders
-- ----------------------------------------------------------------------------
create policy "customer orders delete by role" on customer_orders for delete to authenticated using (has_role(ARRAY['admin'::text]));

create policy "customer orders insert by role" on customer_orders for insert to authenticated with check (has_role(ARRAY['admin'::text, 'sales'::text]));

create policy "customer orders insert own" on customer_orders for insert to authenticated with check ((EXISTS ( SELECT 1
   FROM customers c
  WHERE ((c.id = customer_orders.customer_id) AND (c.profile_id = auth.uid())))));

create policy "customer orders read scoped" on customer_orders for select to authenticated using ((has_role(ARRAY['admin'::text, 'sales'::text, 'management'::text, 'procurement'::text, 'warehouse'::text]) OR (EXISTS ( SELECT 1
   FROM customers c
  WHERE ((c.id = customer_orders.customer_id) AND (c.profile_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM (purchase_orders po
     JOIN suppliers s ON ((s.id = po.supplier_id)))
  WHERE ((po.order_id = customer_orders.id) AND (s.profile_id = auth.uid()))))));

create policy "customer orders update by role" on customer_orders for update to authenticated using (has_role(ARRAY['admin'::text, 'sales'::text, 'procurement'::text])) with check (has_role(ARRAY['admin'::text, 'sales'::text, 'procurement'::text]));

create policy "customer orders update warehouse" on customer_orders for update to authenticated using (has_role(ARRAY['warehouse'::text])) with check (has_role(ARRAY['warehouse'::text]));

-- ----------------------------------------------------------------------------
-- customer_order_items
-- ----------------------------------------------------------------------------
create policy "customer order items delete by role" on customer_order_items for delete to authenticated using (has_role(ARRAY['admin'::text]));

create policy "customer order items insert by role" on customer_order_items for insert to authenticated with check (has_role(ARRAY['admin'::text, 'sales'::text]));

create policy "customer order items insert own" on customer_order_items for insert to authenticated with check ((EXISTS ( SELECT 1
   FROM (customer_orders o
     JOIN customers c ON ((c.id = o.customer_id)))
  WHERE ((o.id = customer_order_items.order_id) AND (c.profile_id = auth.uid())))));

create policy "customer order items read scoped" on customer_order_items for select to authenticated using ((has_role(ARRAY['admin'::text, 'sales'::text, 'management'::text, 'procurement'::text, 'warehouse'::text]) OR (EXISTS ( SELECT 1
   FROM (customer_orders o
     JOIN customers c ON ((c.id = o.customer_id)))
  WHERE ((o.id = customer_order_items.order_id) AND (c.profile_id = auth.uid()))))));

create policy "customer order items update by role" on customer_order_items for update to authenticated using (has_role(ARRAY['admin'::text, 'sales'::text])) with check (has_role(ARRAY['admin'::text, 'sales'::text]));

-- ----------------------------------------------------------------------------
-- purchase_orders
-- ----------------------------------------------------------------------------
create policy "purchase orders delete by role" on purchase_orders for delete to authenticated using (has_role(ARRAY['admin'::text]));

create policy "purchase orders insert by role" on purchase_orders for insert to authenticated with check (has_role(ARRAY['admin'::text, 'procurement'::text]));

create policy "purchase orders select own supplier" on purchase_orders for select to authenticated using ((EXISTS ( SELECT 1
   FROM suppliers s
  WHERE ((s.id = purchase_orders.supplier_id) AND (s.profile_id = auth.uid())))));

create policy "purchase orders select warehouse" on purchase_orders for select to authenticated using (has_role(ARRAY['warehouse'::text]));

create policy "purchase orders update by role" on purchase_orders for update to authenticated using (has_role(ARRAY['admin'::text, 'procurement'::text])) with check (has_role(ARRAY['admin'::text, 'procurement'::text]));

create policy "purchase orders update warehouse" on purchase_orders for update to authenticated using (has_role(ARRAY['warehouse'::text])) with check (has_role(ARRAY['warehouse'::text]));

-- ----------------------------------------------------------------------------
-- purchase_order_items
-- ----------------------------------------------------------------------------
create policy "purchase order items delete by role" on purchase_order_items for delete to authenticated using (has_role(ARRAY['admin'::text]));

create policy "purchase order items insert by role" on purchase_order_items for insert to authenticated with check (has_role(ARRAY['admin'::text, 'procurement'::text]));

create policy "purchase order items select by role" on purchase_order_items for select to authenticated using (has_role(ARRAY['admin'::text, 'management'::text, 'procurement'::text]));

create policy "purchase order items select own supplier" on purchase_order_items for select to authenticated using ((EXISTS ( SELECT 1
   FROM (purchase_orders po
     JOIN suppliers s ON ((s.id = po.supplier_id)))
  WHERE ((po.id = purchase_order_items.purchase_order_id) AND (s.profile_id = auth.uid())))));

create policy "purchase order items select warehouse" on purchase_order_items for select to authenticated using (has_role(ARRAY['warehouse'::text]));

create policy "purchase order items update by role" on purchase_order_items for update to authenticated using (has_role(ARRAY['admin'::text, 'procurement'::text])) with check (has_role(ARRAY['admin'::text, 'procurement'::text]));

create policy "purchase order items update warehouse" on purchase_order_items for update to authenticated using (has_role(ARRAY['warehouse'::text])) with check (has_role(ARRAY['warehouse'::text]));

-- ----------------------------------------------------------------------------
-- supplier_deliveries
-- ----------------------------------------------------------------------------
create policy "supplier deliveries insert own or staff" on supplier_deliveries for insert to authenticated with check ((has_role(ARRAY['admin'::text, 'warehouse'::text]) OR (EXISTS ( SELECT 1
   FROM suppliers s
  WHERE ((s.id = supplier_deliveries.supplier_id) AND (s.profile_id = auth.uid()))))));

create policy "supplier deliveries select own customer" on supplier_deliveries for select to authenticated using ((EXISTS ( SELECT 1
   FROM ((purchase_orders po
     JOIN customer_orders co ON ((co.id = po.order_id)))
     JOIN customers c ON ((c.id = co.customer_id)))
  WHERE ((po.id = supplier_deliveries.purchase_order_id) AND (c.profile_id = auth.uid())))));

create policy "supplier deliveries select own or staff" on supplier_deliveries for select to authenticated using ((has_role(ARRAY['admin'::text, 'management'::text, 'procurement'::text, 'warehouse'::text]) OR (EXISTS ( SELECT 1
   FROM suppliers s
  WHERE ((s.id = supplier_deliveries.supplier_id) AND (s.profile_id = auth.uid()))))));

create policy "supplier deliveries update by staff" on supplier_deliveries for update to authenticated using (has_role(ARRAY['admin'::text, 'warehouse'::text])) with check (has_role(ARRAY['admin'::text, 'warehouse'::text]));

-- ----------------------------------------------------------------------------
-- supplier_delivery_items
-- ----------------------------------------------------------------------------
create policy "supplier delivery items insert own or staff" on supplier_delivery_items for insert to authenticated with check ((has_role(ARRAY['admin'::text, 'warehouse'::text]) OR (EXISTS ( SELECT 1
   FROM (supplier_deliveries d
     JOIN suppliers s ON ((s.id = d.supplier_id)))
  WHERE ((d.id = supplier_delivery_items.delivery_id) AND (s.profile_id = auth.uid()))))));

create policy "supplier delivery items select own or staff" on supplier_delivery_items for select to authenticated using ((has_role(ARRAY['admin'::text, 'management'::text, 'procurement'::text, 'warehouse'::text]) OR (EXISTS ( SELECT 1
   FROM (supplier_deliveries d
     JOIN suppliers s ON ((s.id = d.supplier_id)))
  WHERE ((d.id = supplier_delivery_items.delivery_id) AND (s.profile_id = auth.uid()))))));

create policy "supplier delivery items update by staff" on supplier_delivery_items for update to authenticated using (has_role(ARRAY['admin'::text, 'warehouse'::text])) with check (has_role(ARRAY['admin'::text, 'warehouse'::text]));

-- ----------------------------------------------------------------------------
-- warehouse_locations
-- ----------------------------------------------------------------------------
create policy "warehouse locations write staff" on warehouse_locations for insert to authenticated with check (has_role(ARRAY['admin'::text, 'warehouse'::text]));

create policy "warehouse locations select staff" on warehouse_locations for select to authenticated using (has_role(ARRAY['admin'::text, 'sales'::text, 'management'::text, 'procurement'::text, 'warehouse'::text]));

create policy "warehouse locations update staff" on warehouse_locations for update to authenticated using (has_role(ARRAY['admin'::text, 'warehouse'::text])) with check (has_role(ARRAY['admin'::text, 'warehouse'::text]));

-- ----------------------------------------------------------------------------
-- inventory_batches
-- ----------------------------------------------------------------------------
create policy "inventory batches delete by role" on inventory_batches for delete to authenticated using (has_role(ARRAY['admin'::text]));

create policy "inventory batches insert by role" on inventory_batches for insert to authenticated with check (has_role(ARRAY['admin'::text, 'warehouse'::text]));

create policy "inventory batches select by role" on inventory_batches for select to authenticated using (has_role(ARRAY['admin'::text, 'management'::text, 'warehouse'::text]));

create policy "inventory batches update by role" on inventory_batches for update to authenticated using (has_role(ARRAY['admin'::text, 'warehouse'::text])) with check (has_role(ARRAY['admin'::text, 'warehouse'::text]));

-- ----------------------------------------------------------------------------
-- labeling_tasks
-- ----------------------------------------------------------------------------
create policy "labeling tasks write staff" on labeling_tasks for insert to authenticated with check (has_role(ARRAY['admin'::text, 'warehouse'::text]));

create policy "labeling tasks select own customer" on labeling_tasks for select to authenticated using ((EXISTS ( SELECT 1
   FROM (customer_orders co
     JOIN customers c ON ((c.id = co.customer_id)))
  WHERE ((co.id = labeling_tasks.order_id) AND (c.profile_id = auth.uid())))));

create policy "labeling tasks select staff" on labeling_tasks for select to authenticated using (has_role(ARRAY['admin'::text, 'sales'::text, 'management'::text, 'warehouse'::text]));

create policy "labeling tasks update staff" on labeling_tasks for update to authenticated using (has_role(ARRAY['admin'::text, 'warehouse'::text])) with check (has_role(ARRAY['admin'::text, 'warehouse'::text]));

-- ----------------------------------------------------------------------------
-- staging_tasks
-- ----------------------------------------------------------------------------
create policy "staging tasks write staff" on staging_tasks for insert to authenticated with check (has_role(ARRAY['admin'::text, 'warehouse'::text]));

create policy "staging tasks select own customer" on staging_tasks for select to authenticated using ((EXISTS ( SELECT 1
   FROM (customer_orders co
     JOIN customers c ON ((c.id = co.customer_id)))
  WHERE ((co.id = staging_tasks.order_id) AND (c.profile_id = auth.uid())))));

create policy "staging tasks select staff" on staging_tasks for select to authenticated using (has_role(ARRAY['admin'::text, 'sales'::text, 'management'::text, 'warehouse'::text]));

create policy "staging tasks update staff" on staging_tasks for update to authenticated using (has_role(ARRAY['admin'::text, 'warehouse'::text])) with check (has_role(ARRAY['admin'::text, 'warehouse'::text]));

-- ----------------------------------------------------------------------------
-- shipments
-- ----------------------------------------------------------------------------
create policy "shipments delete by role" on shipments for delete to authenticated using (has_role(ARRAY['admin'::text]));

create policy "shipments insert by role" on shipments for insert to authenticated with check (has_role(ARRAY['admin'::text, 'warehouse'::text]));

create policy "shipments select by role" on shipments for select to authenticated using (has_role(ARRAY['admin'::text, 'management'::text, 'warehouse'::text]));

create policy "shipments update by role" on shipments for update to authenticated using (has_role(ARRAY['admin'::text, 'warehouse'::text])) with check (has_role(ARRAY['admin'::text, 'warehouse'::text]));

-- ----------------------------------------------------------------------------
-- billings
-- ----------------------------------------------------------------------------
create policy "billings insert staff" on billings for insert to authenticated with check (has_role(ARRAY['admin'::text, 'sales'::text]));

create policy "billings select own or staff" on billings for select to authenticated using ((has_role(ARRAY['admin'::text, 'sales'::text, 'management'::text]) OR (EXISTS ( SELECT 1
   FROM (customer_orders co
     JOIN customers c ON ((c.id = co.customer_id)))
  WHERE ((co.id = billings.order_id) AND (c.profile_id = auth.uid()))))));

create policy "billings update staff" on billings for update to authenticated using (has_role(ARRAY['admin'::text, 'sales'::text])) with check (has_role(ARRAY['admin'::text, 'sales'::text]));

-- ----------------------------------------------------------------------------
-- payments
-- ----------------------------------------------------------------------------
create policy "payments insert own customer" on payments for insert to authenticated with check ((has_role(ARRAY['admin'::text, 'sales'::text]) OR (EXISTS ( SELECT 1
   FROM ((billings b
     JOIN customer_orders co ON ((co.id = b.order_id)))
     JOIN customers c ON ((c.id = co.customer_id)))
  WHERE ((b.id = payments.billing_id) AND (c.profile_id = auth.uid()))))));

create policy "payments select own customer" on payments for select to authenticated using ((EXISTS ( SELECT 1
   FROM ((billings b
     JOIN customer_orders co ON ((co.id = b.order_id)))
     JOIN customers c ON ((c.id = co.customer_id)))
  WHERE ((b.id = payments.billing_id) AND (c.profile_id = auth.uid())))));

create policy "payments select own or staff" on payments for select to authenticated using ((has_role(ARRAY['admin'::text, 'sales'::text, 'management'::text]) OR (EXISTS ( SELECT 1
   FROM ((billings b
     JOIN customer_orders co ON ((co.id = b.order_id)))
     JOIN customers c ON ((c.id = co.customer_id)))
  WHERE ((b.id = payments.billing_id) AND (c.profile_id = auth.uid()))))));

create policy "payments update staff" on payments for update to authenticated using (has_role(ARRAY['admin'::text, 'sales'::text])) with check (has_role(ARRAY['admin'::text, 'sales'::text]));

-- ----------------------------------------------------------------------------
-- prediction_records
-- ----------------------------------------------------------------------------
create policy "predictions select own customer" on prediction_records for select to authenticated using ((EXISTS ( SELECT 1
   FROM (customer_orders co
     JOIN customers c ON ((c.id = co.customer_id)))
  WHERE ((co.id = prediction_records.order_id) AND (c.profile_id = auth.uid())))));

-- ----------------------------------------------------------------------------
-- supplier_performance
-- ----------------------------------------------------------------------------
create policy "supplier performance delete staff" on supplier_performance for delete to authenticated using (has_role(ARRAY['admin'::text, 'management'::text]));

create policy "supplier performance insert staff" on supplier_performance for insert to authenticated with check (has_role(ARRAY['admin'::text, 'management'::text]));

create policy "supplier performance select own or staff" on supplier_performance for select to authenticated using ((has_role(ARRAY['admin'::text, 'management'::text, 'procurement'::text]) OR (EXISTS ( SELECT 1
   FROM suppliers s
  WHERE ((s.id = supplier_performance.supplier_id) AND (s.profile_id = auth.uid()))))));

create policy "supplier performance update staff" on supplier_performance for update to authenticated using (has_role(ARRAY['admin'::text, 'management'::text])) with check (has_role(ARRAY['admin'::text, 'management'::text]));

-- ----------------------------------------------------------------------------
-- documents
-- ----------------------------------------------------------------------------
create policy "documents select own or staff" on documents for select to authenticated using ((has_role(ARRAY['admin'::text, 'sales'::text, 'management'::text]) OR ((status = ANY (ARRAY['uploaded'::text, 'verified'::text])) AND (EXISTS ( SELECT 1
   FROM (customer_orders co
     JOIN customers c ON ((c.id = co.customer_id)))
  WHERE ((co.id = documents.order_id) AND (c.profile_id = auth.uid())))))));

-- ----------------------------------------------------------------------------
-- sticker_designs
-- ----------------------------------------------------------------------------
create policy "sticker designs write staff" on sticker_designs for insert to authenticated with check (has_role(ARRAY['admin'::text, 'sales'::text, 'warehouse'::text]));

create policy "sticker designs select staff" on sticker_designs for select to authenticated using (has_role(ARRAY['admin'::text, 'sales'::text, 'management'::text, 'warehouse'::text]));

create policy "sticker designs update staff" on sticker_designs for update to authenticated using (has_role(ARRAY['admin'::text, 'sales'::text, 'warehouse'::text])) with check (has_role(ARRAY['admin'::text, 'sales'::text, 'warehouse'::text]));

-- ----------------------------------------------------------------------------
-- supplier_product_costs
-- ----------------------------------------------------------------------------
create policy "supplier costs insert staff" on supplier_product_costs for insert to authenticated with check (has_role(ARRAY['admin'::text, 'procurement'::text, 'sales'::text]));

create policy "supplier costs select staff" on supplier_product_costs for select to authenticated using (has_role(ARRAY['admin'::text, 'sales'::text, 'management'::text, 'procurement'::text]));

create policy "supplier costs update staff" on supplier_product_costs for update to authenticated using (has_role(ARRAY['admin'::text, 'procurement'::text, 'sales'::text])) with check (has_role(ARRAY['admin'::text, 'procurement'::text, 'sales'::text]));

-- ----------------------------------------------------------------------------
-- notifications
-- ----------------------------------------------------------------------------
create policy "notifications insert authenticated" on notifications for insert to authenticated with check (true);

create policy "notifications select own" on notifications for select to authenticated using ((user_id = auth.uid()));

create policy "notifications update own" on notifications for update to authenticated using ((user_id = auth.uid())) with check ((user_id = auth.uid()));


-- =============================================================================
-- NOT CAPTURED BY THIS SCRIPT
-- =============================================================================
-- The following exist in the live database but are not reproduced here. They
-- are listed rather than omitted silently so the gap is explicit.
--
-- 1. TRIGGERS. handle_new_user() must be wired to auth.users so a profile row
--    is created on signup, and rls_auto_enable() is an event trigger. Both
--    function bodies are in Section 2; their trigger definitions were not
--    exported. Recover them with:
--      select pg_get_triggerdef(oid) from pg_trigger where not tgisinternal;
--
-- 2. UNIQUE CONSTRAINTS AND INDEXES. db/schema.sql documents this same
--    omission. number_sequences relies on a unique (prefix, year) constraint
--    for next_document_number()'s ON CONFLICT clause.
--
-- 3. STORAGE BUCKETS. 'payment-proofs' (private, migration 010) and
--    'product-images' (migration 012), with their own policies on
--    storage.objects. See those migration files.
--
-- 4. AUTH USERS. Accounts live in auth.users, which this script does not
--    touch. Create users through Supabase Auth, then set profiles.role.
-- =============================================================================
