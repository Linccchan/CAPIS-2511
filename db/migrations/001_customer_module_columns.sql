-- Migration 001 — Customer module columns
-- Adds fields the customer wireframes require but the schema was missing.
-- Run this in the Supabase SQL Editor. SAFE: every change is additive and
-- either nullable or has a default, so it cannot break existing rows.
-- Idempotent: uses "add column if not exists", so re-running is harmless.

-- Submit Quotation Request collects these two fields but they had no home
-- (they were being silently dropped on submit).
alter table customer_orders
  add column if not exists preferred_ship_date  date,
  add column if not exists special_instructions text;

-- PFI Review screen shows a Shipping line, an "Expires" date, a "Prepared by"
-- name, and a currency — none of which existed on billings.
alter table billings
  add column if not exists shipping_amount numeric not null default 0,
  add column if not exists valid_until     date,
  add column if not exists prepared_by     uuid references profiles (id),
  add column if not exists currency        text not null default 'USD';
