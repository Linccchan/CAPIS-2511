-- Migration 009 — approve_quotation v3: reject expired PFIs server-side
-- Run in the Supabase SQL editor. Idempotent.
--
-- Business rule (audit finding): a customer must not be able to approve a
-- pro forma invoice past its valid_until date — supplier prices go stale.
-- The UI now blocks this too; this makes it enforced at the database layer.

create or replace function approve_quotation(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
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
$$;
