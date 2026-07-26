-- Migration 011 — Align the shared schema with the warehouse/procurement code
-- Run in the Supabase SQL editor. Idempotent (safe to re-run).
--
-- Kaye's warehouse & staging screens were built against a different schema
-- (sql.docx) and write columns/status-values the shared DB lacked. This adds
-- exactly what that code needs so it runs against the shared Supabase.
--
-- NOTE (tech debt): this makes `purchase_orders.status` accept both the
-- lowercase pipeline values (draft/sent/…) AND Title-Case warehouse values
-- ('Staging', 'Ready for Shipment'). The team should later standardize on one
-- vocabulary; for now both are allowed so nothing breaks.

-- 1. purchase_orders.status — allow the warehouse staging lifecycle values
alter table purchase_orders drop constraint if exists purchase_orders_status_check;
alter table purchase_orders add constraint purchase_orders_status_check
  check (status in ('draft', 'sent', 'partially_delivered', 'delivered', 'cancelled',
                    'Staging', 'Ready for Shipment'));

-- 2. purchase_order_items.status — warehouse staging stamps items 'Ready for Shipment'
alter table purchase_order_items add column if not exists status text;

-- 3. warehouse_locations occupancy tracking (her staging assigns a PO to a slot)
alter table warehouse_locations add column if not exists occupied boolean not null default false;
alter table warehouse_locations add column if not exists purchase_order_id uuid references purchase_orders (id);
