-- Migration 008 — Payments RLS + payment-proof storage
-- Run in the Supabase SQL editor. Idempotent.
--
-- payments had RLS enabled with NO policies (deny-all). Customers can now
-- record payments on their own billings and see their status; admin/sales
-- verify or reject. Also creates the private `payment-proofs` storage bucket
-- with policies: customers upload/read files under their own user-id folder,
-- staff read all proofs.

-- Payments table policies --------------------------------------------------

drop policy if exists "payments select own or staff" on payments;
create policy "payments select own or staff"
on payments for select
to authenticated
using (
  has_role(array['admin'::text, 'sales'::text, 'management'::text])
  or exists (
    select 1
    from billings b
    join customer_orders co on co.id = b.order_id
    join customers c on c.id = co.customer_id
    where b.id = payments.billing_id
      and c.profile_id = auth.uid()
  )
);

drop policy if exists "payments insert own customer" on payments;
create policy "payments insert own customer"
on payments for insert
to authenticated
with check (
  has_role(array['admin'::text, 'sales'::text])
  or exists (
    select 1
    from billings b
    join customer_orders co on co.id = b.order_id
    join customers c on c.id = co.customer_id
    where b.id = payments.billing_id
      and c.profile_id = auth.uid()
  )
);

drop policy if exists "payments update staff" on payments;
create policy "payments update staff"
on payments for update
to authenticated
using (has_role(array['admin'::text, 'sales'::text]))
with check (has_role(array['admin'::text, 'sales'::text]));

-- Payment-proof storage bucket ----------------------------------------------

insert into storage.buckets (id, name, public)
values ('payment-proofs', 'payment-proofs', false)
on conflict (id) do nothing;

drop policy if exists "payment proofs upload own folder" on storage.objects;
create policy "payment proofs upload own folder"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'payment-proofs'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "payment proofs read own or staff" on storage.objects;
create policy "payment proofs read own or staff"
on storage.objects for select
to authenticated
using (
  bucket_id = 'payment-proofs'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or has_role(array['admin'::text, 'sales'::text, 'management'::text])
  )
);
