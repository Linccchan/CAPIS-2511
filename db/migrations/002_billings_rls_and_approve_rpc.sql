-- Migration 002 — Billings read policy + quotation approval RPC
-- Run in the Supabase SQL editor. Idempotent (safe to re-run).
--
-- 1) billings had RLS enabled with NO policies (deny-all), so the customer
--    PFI review page could never load a pro forma invoice. Customers may now
--    read billings for their own orders; admin/sales/management read all.
-- 2) approve_quotation(): customers cannot UPDATE customer_orders directly
--    (by design), so approval goes through a security-definer function that
--    validates ownership + status, then advances the order to
--    awaiting_down_payment and stamps confirmed_at.

drop policy if exists "billings select own or staff" on billings;
create policy "billings select own or staff"
on billings for select
to authenticated
using (
  has_role(array['admin'::text, 'sales'::text, 'management'::text])
  or exists (
    select 1
    from customer_orders co
    join customers c on c.id = co.customer_id
    where co.id = billings.order_id
      and c.profile_id = auth.uid()
  )
);

create or replace function approve_quotation(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update customer_orders co
     set status = 'awaiting_down_payment',
         confirmed_at = now()
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
$$;

revoke all on function approve_quotation(uuid) from public;
grant execute on function approve_quotation(uuid) to authenticated;
