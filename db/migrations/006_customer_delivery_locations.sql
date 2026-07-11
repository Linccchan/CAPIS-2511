-- Migration 006 — Customer delivery locations
-- Run in the Supabase SQL editor. Idempotent (safe to re-run).
--
-- Adviser feedback: DMC's customers are importers/distributors — the
-- destination is where THEY operate, not a free choice per order. Customers
-- now pre-save delivery locations (warehouses) in Profile & Settings and
-- pick one when requesting a quotation. The order stores both the location
-- reference and the denormalized country (existing screens and the staff
-- modules keep reading destination_country unchanged).

-- v2: country is intentionally NOT restricted to DMC's current export
-- markets — a new customer can come from a new country. Standardization is
-- handled by the country dropdown in the UI (src/lib/constants.js).
create table if not exists customer_locations (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers (id),
  label       text not null,               -- e.g. "Main warehouse — Kowloon"
  country     text not null,
  address     text,
  is_default  boolean not null default false,
  created_at  timestamptz default now()
);

-- Self-heal databases that ran v1 of this migration (which had a CHECK
-- restricting country to the 8 current markets)
alter table customer_locations drop constraint if exists customer_locations_country_check;

alter table customer_locations enable row level security;

drop policy if exists "customer locations select own or staff" on customer_locations;
create policy "customer locations select own or staff"
on customer_locations for select
to authenticated
using (
  has_role(array['admin'::text, 'sales'::text, 'management'::text])
  or exists (
    select 1 from customers c
    where c.id = customer_locations.customer_id
      and c.profile_id = auth.uid()
  )
);

drop policy if exists "customer locations insert own or staff" on customer_locations;
create policy "customer locations insert own or staff"
on customer_locations for insert
to authenticated
with check (
  has_role(array['admin'::text, 'sales'::text])
  or exists (
    select 1 from customers c
    where c.id = customer_locations.customer_id
      and c.profile_id = auth.uid()
  )
);

drop policy if exists "customer locations update own or staff" on customer_locations;
create policy "customer locations update own or staff"
on customer_locations for update
to authenticated
using (
  has_role(array['admin'::text, 'sales'::text])
  or exists (
    select 1 from customers c
    where c.id = customer_locations.customer_id
      and c.profile_id = auth.uid()
  )
)
with check (
  has_role(array['admin'::text, 'sales'::text])
  or exists (
    select 1 from customers c
    where c.id = customer_locations.customer_id
      and c.profile_id = auth.uid()
  )
);

drop policy if exists "customer locations delete own or staff" on customer_locations;
create policy "customer locations delete own or staff"
on customer_locations for delete
to authenticated
using (
  has_role(array['admin'::text])
  or exists (
    select 1 from customers c
    where c.id = customer_locations.customer_id
      and c.profile_id = auth.uid()
  )
);

-- Orders reference the chosen location (country stays denormalized)
alter table customer_orders
  add column if not exists delivery_location_id uuid references customer_locations (id);

-- Backfill: give every existing customer a default location from their
-- profile country
insert into customer_locations (customer_id, label, country, address, is_default)
select c.id, 'Main warehouse', c.country, c.address, true
from customers c
where c.country is not null
  and not exists (
    select 1 from customer_locations cl where cl.customer_id = c.id
  );
