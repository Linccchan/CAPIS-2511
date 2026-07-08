-- Migration 003 — Documents read policy
-- Run in the Supabase SQL editor. Idempotent (safe to re-run).
--
-- documents had RLS enabled with NO policies (deny-all), so the customer
-- Documents page could never list export paperwork. Customers may now read
-- non-draft documents belonging to their own orders; admin/sales/management
-- read all. Staff INSERT/UPDATE policies come with the admin Document
-- Manager (Module 2).

drop policy if exists "documents select own or staff" on documents;
create policy "documents select own or staff"
on documents for select
to authenticated
using (
  has_role(array['admin'::text, 'sales'::text, 'management'::text])
  or (
    status <> 'draft'
    and exists (
      select 1
      from customer_orders co
      join customers c on c.id = co.customer_id
      where co.id = documents.order_id
        and c.profile_id = auth.uid()
    )
  )
);
