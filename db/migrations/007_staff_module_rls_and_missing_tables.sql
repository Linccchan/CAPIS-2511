-- Migration 007 — Staff-module RLS + tables the staff screens expect
-- Run in the Supabase SQL editor AFTER migration 005. Idempotent.
--
-- Unblocks the end-to-end demo: (1) creates three tables the admin/warehouse/
-- supplier screens reference but which never existed in the shared DB
-- (notifications, sticker_designs, supplier_product_costs — from the
-- sql.docx schema), matching the exact columns the code uses; (2) adds the
-- write policies the PFI builder needs on billings; (3) opens the RLS
-- deny-alls that would blank out warehouse receiving/staging and admin
-- compliance/locations; (4) lets the warehouse role read/update purchase
-- orders and mark orders ready for shipment.

-- ---------- 1. Missing tables ----------------------------------------------

create table if not exists notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles (id),
  order_id   uuid references customer_orders (id),
  type       text,                       -- e.g. dispatch_logged | cost_update_prompt
  title      text,
  message    text,
  is_read    boolean not null default false,
  created_at timestamptz default now()
);
alter table notifications enable row level security;

drop policy if exists "notifications select own" on notifications;
create policy "notifications select own"
on notifications for select to authenticated
using (user_id = auth.uid());

drop policy if exists "notifications insert authenticated" on notifications;
create policy "notifications insert authenticated"
on notifications for insert to authenticated
with check (true);  -- any role's action may notify another user

drop policy if exists "notifications update own" on notifications;
create policy "notifications update own"
on notifications for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create table if not exists sticker_designs (
  id               uuid primary key default gen_random_uuid(),
  order_id         uuid not null references customer_orders (id),
  product_id       uuid not null references products (id),
  destination      text,
  design_file_path text,
  status           text not null default 'photo_sent',  -- photo_sent | awaiting_customer | design_received | printed
  created_at       timestamptz default now()
);
alter table sticker_designs enable row level security;

drop policy if exists "sticker designs select staff" on sticker_designs;
create policy "sticker designs select staff"
on sticker_designs for select to authenticated
using (has_role(array['admin'::text, 'sales'::text, 'management'::text, 'warehouse'::text]));

drop policy if exists "sticker designs write staff" on sticker_designs;
create policy "sticker designs write staff"
on sticker_designs for insert to authenticated
with check (has_role(array['admin'::text, 'sales'::text, 'warehouse'::text]));

drop policy if exists "sticker designs update staff" on sticker_designs;
create policy "sticker designs update staff"
on sticker_designs for update to authenticated
using (has_role(array['admin'::text, 'sales'::text, 'warehouse'::text]))
with check (has_role(array['admin'::text, 'sales'::text, 'warehouse'::text]));

create table if not exists supplier_product_costs (
  id             uuid primary key default gen_random_uuid(),
  product_id     uuid not null references products (id),
  supplier_id    uuid not null references suppliers (id),
  unit_cost      numeric not null,
  currency       text not null default 'USD',
  effective_from date,
  effective_to   date,                  -- null = current cost
  source         text default 'manual', -- manual | po_derived
  updated_by     uuid references profiles (id),
  created_at     timestamptz default now()
);
alter table supplier_product_costs enable row level security;

drop policy if exists "supplier costs select staff" on supplier_product_costs;
create policy "supplier costs select staff"
on supplier_product_costs for select to authenticated
using (has_role(array['admin'::text, 'sales'::text, 'management'::text, 'procurement'::text]));

drop policy if exists "supplier costs insert staff" on supplier_product_costs;
create policy "supplier costs insert staff"
on supplier_product_costs for insert to authenticated
with check (has_role(array['admin'::text, 'procurement'::text, 'sales'::text]));

drop policy if exists "supplier costs update staff" on supplier_product_costs;
create policy "supplier costs update staff"
on supplier_product_costs for update to authenticated
using (has_role(array['admin'::text, 'procurement'::text, 'sales'::text]))
with check (has_role(array['admin'::text, 'procurement'::text, 'sales'::text]));

-- ---------- 2. Billings write access (PFI builder) --------------------------

drop policy if exists "billings insert staff" on billings;
create policy "billings insert staff"
on billings for insert to authenticated
with check (has_role(array['admin'::text, 'sales'::text]));

drop policy if exists "billings update staff" on billings;
create policy "billings update staff"
on billings for update to authenticated
using (has_role(array['admin'::text, 'sales'::text]))
with check (has_role(array['admin'::text, 'sales'::text]));

-- ---------- 3. Warehouse-prep tables (were deny-all) -------------------------

drop policy if exists "labeling tasks select staff" on labeling_tasks;
create policy "labeling tasks select staff"
on labeling_tasks for select to authenticated
using (has_role(array['admin'::text, 'sales'::text, 'management'::text, 'warehouse'::text]));

drop policy if exists "labeling tasks write staff" on labeling_tasks;
create policy "labeling tasks write staff"
on labeling_tasks for insert to authenticated
with check (has_role(array['admin'::text, 'warehouse'::text]));

drop policy if exists "labeling tasks update staff" on labeling_tasks;
create policy "labeling tasks update staff"
on labeling_tasks for update to authenticated
using (has_role(array['admin'::text, 'warehouse'::text]))
with check (has_role(array['admin'::text, 'warehouse'::text]));

drop policy if exists "staging tasks select staff" on staging_tasks;
create policy "staging tasks select staff"
on staging_tasks for select to authenticated
using (has_role(array['admin'::text, 'sales'::text, 'management'::text, 'warehouse'::text]));

drop policy if exists "staging tasks write staff" on staging_tasks;
create policy "staging tasks write staff"
on staging_tasks for insert to authenticated
with check (has_role(array['admin'::text, 'warehouse'::text]));

drop policy if exists "staging tasks update staff" on staging_tasks;
create policy "staging tasks update staff"
on staging_tasks for update to authenticated
using (has_role(array['admin'::text, 'warehouse'::text]))
with check (has_role(array['admin'::text, 'warehouse'::text]));

drop policy if exists "warehouse locations select staff" on warehouse_locations;
create policy "warehouse locations select staff"
on warehouse_locations for select to authenticated
using (has_role(array['admin'::text, 'sales'::text, 'management'::text, 'procurement'::text, 'warehouse'::text]));

drop policy if exists "warehouse locations write staff" on warehouse_locations;
create policy "warehouse locations write staff"
on warehouse_locations for insert to authenticated
with check (has_role(array['admin'::text, 'warehouse'::text]));

drop policy if exists "warehouse locations update staff" on warehouse_locations;
create policy "warehouse locations update staff"
on warehouse_locations for update to authenticated
using (has_role(array['admin'::text, 'warehouse'::text]))
with check (has_role(array['admin'::text, 'warehouse'::text]));

-- ---------- 4. Warehouse access to POs and order status ---------------------
-- Receiving updates PO progress; staging marks the order ready for shipment.

drop policy if exists "purchase orders select warehouse" on purchase_orders;
create policy "purchase orders select warehouse"
on purchase_orders for select to authenticated
using (has_role(array['warehouse'::text]));

drop policy if exists "purchase orders update warehouse" on purchase_orders;
create policy "purchase orders update warehouse"
on purchase_orders for update to authenticated
using (has_role(array['warehouse'::text]))
with check (has_role(array['warehouse'::text]));

drop policy if exists "purchase order items select warehouse" on purchase_order_items;
create policy "purchase order items select warehouse"
on purchase_order_items for select to authenticated
using (has_role(array['warehouse'::text]));

drop policy if exists "purchase order items update warehouse" on purchase_order_items;
create policy "purchase order items update warehouse"
on purchase_order_items for update to authenticated
using (has_role(array['warehouse'::text]))
with check (has_role(array['warehouse'::text]));

drop policy if exists "customer orders update warehouse" on customer_orders;
create policy "customer orders update warehouse"
on customer_orders for update to authenticated
using (has_role(array['warehouse'::text]))
with check (has_role(array['warehouse'::text]));
