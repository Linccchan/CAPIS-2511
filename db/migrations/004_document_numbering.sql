-- Migration 004 — PREFIX-YYYY-NNN document numbering
-- Run in the Supabase SQL editor. Idempotent (safe to re-run).
--
-- The wireframes number quotations QT-2024-021 and orders ORD-2024-041 —
-- sequential per prefix per year — but the code generated QT-<epoch ms>.
-- This migration adds:
--   1) customer_orders.quotation_number — the QT- number is kept here when
--      approval renames order_number to an ORD- number (both appear in the
--      wireframes for the same order).
--   2) number_sequences + next_document_number(prefix) — atomic per-year
--      counters (upsert ... returning), callable from the app.
--   3) approve_quotation() v2 — now also assigns the ORD- number.

alter table customer_orders
  add column if not exists quotation_number text;

create table if not exists number_sequences (
  prefix     text    not null,
  year       integer not null,
  last_value integer not null default 0,
  primary key (prefix, year)
);

-- Only the security-definer functions below touch this table; no policies
-- means app roles cannot read or tamper with the counters directly.
alter table number_sequences enable row level security;

create or replace function next_document_number(p_prefix text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v integer;
  y integer := extract(year from current_date)::integer;
begin
  insert into number_sequences (prefix, year, last_value)
  values (p_prefix, y, 1)
  on conflict (prefix, year)
  do update set last_value = number_sequences.last_value + 1
  returning last_value into v;

  return p_prefix || '-' || y::text || '-' || lpad(v::text, 3, '0');
end;
$$;

revoke all on function next_document_number(text) from public;
grant execute on function next_document_number(text) to authenticated;

create or replace function approve_quotation(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
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
