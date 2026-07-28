-- Migration 014 — Remove the leftover "authenticated = allowed" write policies
-- and replace the customer-facing access they were silently providing.
-- Run in the Supabase SQL editor. Safe to re-run.
--
-- APPLIED to the live database 2026-07-28, and both customer flows it affects
-- (quotation submit, profile edit) were regression-tested after applying.
--
-- Migration 011 closed the read-side hole. These four Supabase template policies
-- are the write-side equivalent, all with qual/with_check = true:
--
--   customer_orders       INSERT  "Enable insert for authenticated users only"
--   customer_order_items  INSERT  "Enable insert for authenticated users only"
--   customers             INSERT  "Authenticated users can insert customers"
--   customers             UPDATE  "Authenticated users can update customers"
--
-- Policies for the same command are OR'd, so these overrode the stricter
-- "... by role" policies entirely: any authenticated account, including a
-- customer, could insert orders against another customer's id and update any
-- row in `customers`.
--
-- They cannot simply be dropped. The "... by role" policies are
-- has_role(admin, sales) only, so the permissive policies were what actually
-- allowed two legitimate customer-facing flows to work:
--   * src/app/customer/quotation/new/page.js  — customer submits a quotation
--     (inserts customer_orders + customer_order_items as themselves)
--   * src/app/customer/profile/page.js        — customer edits their own record
-- Both get a proper ownership-scoped policy below instead.
--
-- `customers` INSERT needs no replacement: the only insert path is
-- src/app/api/invite-customer/route.js, which uses the service-role client and
-- bypasses RLS. admin/sales keep their "customers insert by role" policy.

-- 1. Drop the permissive policies ----------------------------------------------
drop policy if exists "Enable insert for authenticated users only" on customer_orders;
drop policy if exists "Enable insert for authenticated users only" on customer_order_items;
drop policy if exists "Authenticated users can insert customers" on customers;
drop policy if exists "Authenticated users can update customers" on customers;

-- 2. Restore the customer-facing access, ownership-scoped -----------------------

-- A customer may create an order only against their own customer record.
drop policy if exists "customer orders insert own" on customer_orders;
create policy "customer orders insert own"
on customer_orders for insert
to authenticated
with check (
  exists (
    select 1 from customers c
    where c.id = customer_orders.customer_id
      and c.profile_id = auth.uid()
  )
);

-- A customer may add line items only to an order they own.
drop policy if exists "customer order items insert own" on customer_order_items;
create policy "customer order items insert own"
on customer_order_items for insert
to authenticated
with check (
  exists (
    select 1 from customer_orders o
    join customers c on c.id = o.customer_id
    where o.id = customer_order_items.order_id
      and c.profile_id = auth.uid()
  )
);

-- A customer may update only their own record, and cannot reassign it to
-- another profile (the with check re-tests ownership on the new row).
drop policy if exists "customers update own" on customers;
create policy "customers update own"
on customers for update
to authenticated
using (profile_id = auth.uid())
with check (profile_id = auth.uid());
