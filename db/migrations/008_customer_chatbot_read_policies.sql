-- Migration 008 — Customer chatbot read-only progress access
--
-- The customer chatbot runs with the authenticated customer's JWT and never
-- uses the service role. These SELECT-only policies expose just the customer's
-- own progress rows through the existing order ownership chain. No INSERT,
-- UPDATE, or DELETE access is added.
--
-- Apply after the base schema and migrations 002/003. Idempotent.

alter table payments enable row level security;
alter table prediction_records enable row level security;
alter table labeling_tasks enable row level security;
alter table staging_tasks enable row level security;
alter table supplier_deliveries enable row level security;

drop policy if exists "payments select own customer" on payments;
create policy "payments select own customer"
on payments for select to authenticated
using (
  exists (
    select 1
    from billings b
    join customer_orders co on co.id = b.order_id
    join customers c on c.id = co.customer_id
    where b.id = payments.billing_id
      and c.profile_id = auth.uid()
  )
);

drop policy if exists "predictions select own customer" on prediction_records;
create policy "predictions select own customer"
on prediction_records for select to authenticated
using (
  exists (
    select 1
    from customer_orders co
    join customers c on c.id = co.customer_id
    where co.id = prediction_records.order_id
      and c.profile_id = auth.uid()
  )
);

drop policy if exists "labeling tasks select own customer" on labeling_tasks;
create policy "labeling tasks select own customer"
on labeling_tasks for select to authenticated
using (
  exists (
    select 1
    from customer_orders co
    join customers c on c.id = co.customer_id
    where co.id = labeling_tasks.order_id
      and c.profile_id = auth.uid()
  )
);

drop policy if exists "staging tasks select own customer" on staging_tasks;
create policy "staging tasks select own customer"
on staging_tasks for select to authenticated
using (
  exists (
    select 1
    from customer_orders co
    join customers c on c.id = co.customer_id
    where co.id = staging_tasks.order_id
      and c.profile_id = auth.uid()
  )
);

drop policy if exists "supplier deliveries select own customer" on supplier_deliveries;
create policy "supplier deliveries select own customer"
on supplier_deliveries for select to authenticated
using (
  exists (
    select 1
    from purchase_orders po
    join customer_orders co on co.id = po.order_id
    join customers c on c.id = co.customer_id
    where po.id = supplier_deliveries.purchase_order_id
      and c.profile_id = auth.uid()
  )
);
