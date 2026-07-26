-- Migration 011 — Tighten over-permissive read policies (security)
-- Run in the Supabase SQL editor. Idempotent.
--
-- customer_orders / customer_order_items / customers had a "read for all"
-- SELECT policy (role public, USING true), so anyone could read every
-- customer's data. Replaced with scoped policies:
--   * staff (admin/sales/management/procurement/warehouse) see all
--   * a customer sees only their own (via customers.profile_id = auth.uid())
--   * a supplier sees the orders they have a purchase order for
-- (products stays publicly readable on purpose — it's the catalog.)

-- customer_orders --------------------------------------------------------------
drop policy if exists "Enable read access for all users" on customer_orders;
drop policy if exists "customer orders select by role" on customer_orders;
create policy "customer orders read scoped"
on customer_orders for select to authenticated
using (
  has_role(array['admin'::text, 'sales'::text, 'management'::text, 'procurement'::text, 'warehouse'::text])
  or exists (
    select 1 from customers c
    where c.id = customer_orders.customer_id and c.profile_id = auth.uid()
  )
  or exists (
    select 1 from purchase_orders po
    join suppliers s on s.id = po.supplier_id
    where po.order_id = customer_orders.id and s.profile_id = auth.uid()
  )
);

-- customer_order_items ---------------------------------------------------------
drop policy if exists "Enable read access for all users" on customer_order_items;
drop policy if exists "customer order items select by role" on customer_order_items;
create policy "customer order items read scoped"
on customer_order_items for select to authenticated
using (
  has_role(array['admin'::text, 'sales'::text, 'management'::text, 'procurement'::text, 'warehouse'::text])
  or exists (
    select 1 from customer_orders o
    join customers c on c.id = o.customer_id
    where o.id = customer_order_items.order_id and c.profile_id = auth.uid()
  )
);

-- customers --------------------------------------------------------------------
drop policy if exists "Authenticated users can read customers" on customers;
drop policy if exists "customers select by role" on customers;
create policy "customers read scoped"
on customers for select to authenticated
using (
  has_role(array['admin'::text, 'sales'::text, 'management'::text, 'procurement'::text, 'warehouse'::text])
  or profile_id = auth.uid()
);
