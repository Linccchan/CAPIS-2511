-- Migration 005 — Supplier login role + supplier-portal RLS
-- ⚠️ PREPARED BUT NOT YET APPLIED. Do not run until the team has aligned the
--    supplier/warehouse module (Kaye) with the shared database. Idempotent.
--
-- Context: the wireframes include a full supplier portal (dashboard, PO
-- detail, log dispatch, delivery history, performance), but the shared DB
-- (1) rejects a 'supplier' role via profiles_role_check, (2) has no link
-- between a login account and a suppliers row, and (3) keeps the tables the
-- portal needs (suppliers, supplier_deliveries, supplier_delivery_items,
-- supplier_performance) RLS-locked with no policies. This migration fixes
-- all of that, plus adds the 'pending_confirmation' delivery status required
-- by the dual-confirmation flow (supplier logs dispatch -> warehouse
-- confirms receipt).
--
-- NOTE: Kaye's migration_001_section10_additions.sql targets a different
-- schema (Postgres enums from sql.docx) and will NOT run on the shared DB.
-- This file is the shared-DB equivalent of the parts her module needs.

-- 1) Allow the supplier role -------------------------------------------------

alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check
  check (role in ('admin', 'customer', 'sales', 'procurement',
                  'warehouse', 'management', 'supplier'));

-- 2) Link supplier logins to supplier companies ------------------------------

alter table suppliers
  add column if not exists profile_id uuid references profiles (id);

-- 3) Dual-confirmation delivery status ---------------------------------------
-- Supplier logs a dispatch -> 'pending_confirmation'; warehouse receipt
-- (S14) moves it to 'received' / 'with_discrepancy' / 'rejected'.

alter table supplier_deliveries drop constraint if exists supplier_deliveries_delivery_status_check;
alter table supplier_deliveries add constraint supplier_deliveries_delivery_status_check
  check (delivery_status in ('pending_confirmation', 'received',
                             'with_discrepancy', 'rejected'));

-- 4) Supplier-portal RLS -----------------------------------------------------
-- Helper predicate used below: the row's supplier is the caller's company.
--   exists (select 1 from suppliers s
--           where s.id = <supplier_id> and s.profile_id = auth.uid())

-- suppliers: own row for suppliers; read for staff; manage by admin/procurement
drop policy if exists "suppliers select own or staff" on suppliers;
create policy "suppliers select own or staff"
on suppliers for select
to authenticated
using (
  has_role(array['admin'::text, 'sales'::text, 'management'::text, 'procurement'::text, 'warehouse'::text])
  or profile_id = auth.uid()
);

drop policy if exists "suppliers insert by role" on suppliers;
create policy "suppliers insert by role"
on suppliers for insert
to authenticated
with check (has_role(array['admin'::text, 'procurement'::text]));

drop policy if exists "suppliers update by role" on suppliers;
create policy "suppliers update by role"
on suppliers for update
to authenticated
using (has_role(array['admin'::text, 'procurement'::text]))
with check (has_role(array['admin'::text, 'procurement'::text]));

-- purchase_orders: suppliers can read POs addressed to them
drop policy if exists "purchase orders select own supplier" on purchase_orders;
create policy "purchase orders select own supplier"
on purchase_orders for select
to authenticated
using (
  exists (
    select 1 from suppliers s
    where s.id = purchase_orders.supplier_id
      and s.profile_id = auth.uid()
  )
);

-- purchase_order_items: suppliers can read items of their own POs
drop policy if exists "purchase order items select own supplier" on purchase_order_items;
create policy "purchase order items select own supplier"
on purchase_order_items for select
to authenticated
using (
  exists (
    select 1
    from purchase_orders po
    join suppliers s on s.id = po.supplier_id
    where po.id = purchase_order_items.purchase_order_id
      and s.profile_id = auth.uid()
  )
);

-- supplier_deliveries: suppliers log dispatches (pending) + read their own;
-- staff read all; warehouse/admin confirm (update)
drop policy if exists "supplier deliveries select own or staff" on supplier_deliveries;
create policy "supplier deliveries select own or staff"
on supplier_deliveries for select
to authenticated
using (
  has_role(array['admin'::text, 'management'::text, 'procurement'::text, 'warehouse'::text])
  or exists (
    select 1 from suppliers s
    where s.id = supplier_deliveries.supplier_id
      and s.profile_id = auth.uid()
  )
);

drop policy if exists "supplier deliveries insert own or staff" on supplier_deliveries;
create policy "supplier deliveries insert own or staff"
on supplier_deliveries for insert
to authenticated
with check (
  has_role(array['admin'::text, 'warehouse'::text])
  or exists (
    select 1 from suppliers s
    where s.id = supplier_deliveries.supplier_id
      and s.profile_id = auth.uid()
  )
);

drop policy if exists "supplier deliveries update by staff" on supplier_deliveries;
create policy "supplier deliveries update by staff"
on supplier_deliveries for update
to authenticated
using (has_role(array['admin'::text, 'warehouse'::text]))
with check (has_role(array['admin'::text, 'warehouse'::text]));

-- supplier_delivery_items: same shape as their parent deliveries
drop policy if exists "supplier delivery items select own or staff" on supplier_delivery_items;
create policy "supplier delivery items select own or staff"
on supplier_delivery_items for select
to authenticated
using (
  has_role(array['admin'::text, 'management'::text, 'procurement'::text, 'warehouse'::text])
  or exists (
    select 1
    from supplier_deliveries d
    join suppliers s on s.id = d.supplier_id
    where d.id = supplier_delivery_items.delivery_id
      and s.profile_id = auth.uid()
  )
);

drop policy if exists "supplier delivery items insert own or staff" on supplier_delivery_items;
create policy "supplier delivery items insert own or staff"
on supplier_delivery_items for insert
to authenticated
with check (
  has_role(array['admin'::text, 'warehouse'::text])
  or exists (
    select 1
    from supplier_deliveries d
    join suppliers s on s.id = d.supplier_id
    where d.id = supplier_delivery_items.delivery_id
      and s.profile_id = auth.uid()
  )
);

drop policy if exists "supplier delivery items update by staff" on supplier_delivery_items;
create policy "supplier delivery items update by staff"
on supplier_delivery_items for update
to authenticated
using (has_role(array['admin'::text, 'warehouse'::text]))
with check (has_role(array['admin'::text, 'warehouse'::text]));

-- supplier_performance: suppliers see their own scorecard; staff see all
drop policy if exists "supplier performance select own or staff" on supplier_performance;
create policy "supplier performance select own or staff"
on supplier_performance for select
to authenticated
using (
  has_role(array['admin'::text, 'management'::text, 'procurement'::text])
  or exists (
    select 1 from suppliers s
    where s.id = supplier_performance.supplier_id
      and s.profile_id = auth.uid()
  )
);
