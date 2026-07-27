# Database Schema Reference

Source-of-truth documentation for the DMC Export Consolidation System database
(Supabase / PostgreSQL). **Re-synced 2026-07-26** by introspecting the live
`public` schema. The runnable DDL is in [`schema.sql`](./schema.sql); this file
adds the things DDL doesn't show — RLS state, roles, status vocabulary, and
known gaps between the code and the database.

> **26 tables** — all five modules built, plus a customer chatbot. The team
> sometimes applies DB changes directly via the Supabase SQL editor, so re-run
> the introspection query (bottom of this file) after any schema change to keep
> these docs accurate.

## Tables by module

| Module | Tables |
|--------|--------|
| Auth / core | `profiles`, `customers`, `customer_locations` (migration 006), `products`, `suppliers` |
| 1 — Customer Interaction | `customer_orders`, `customer_order_items` |
| 2 — Order Management / procurement | `purchase_orders`, `purchase_order_items`, `supplier_deliveries`, `supplier_delivery_items`, `supplier_product_costs` |
| 3 — Supplier & Warehouse | `warehouse_locations`, `inventory_batches`, `labeling_tasks`, `staging_tasks`, `shipments`, `sticker_designs` |
| 4 — Predictive Analytics | `prediction_records`, `supplier_performance` |
| 5 — Billing & Payment | `billings`, `payments` |
| Cross-cutting | `documents`, `activity_logs`, `notifications`, `number_sequences` |

## Conventions

- Every primary key is `id uuid default gen_random_uuid()` (except `profiles.id`,
  which equals the Supabase `auth.users` id).
- Audit columns are `timestamptz default now()`.
- **No Postgres enums; most status/role/type columns are CHECK-enforced** (full
  DDL at the end of `schema.sql`) — an out-of-vocabulary value fails with a
  `23514` error. **Exception:** `purchase_orders.status` and
  `purchase_order_items.status` are now **free text** (their check constraints
  were dropped so the warehouse module can use `'Staging'` / `'Ready for Shipment'`).

## Roles

`profiles.role` is enforced by `profiles_role_check`:

`admin` · `sales` · `management` · `procurement` · `warehouse` · `customer` · `supplier`

> Migration `005` is **applied** — it added the `supplier` role,
> `suppliers.profile_id` (links a supplier login to a supplier row), the
> `pending_confirmation` delivery status, and the supplier-portal RLS policies.

## Status columns — allowed values (CHECK-enforced) & defaults

| Table | Column | Allowed values (default in **bold**) |
|-------|--------|--------------------------------------|
| `customer_orders` | `status` | **draft**, submitted, awaiting_down_payment, payment_verified, procurement_started, partially_received, warehouse_preparation, ready_for_shipment, shipped, completed, cancelled |
| `purchase_orders` | `status` | **FREE TEXT** (check dropped) — in use: draft, sent, partially_delivered, delivered, cancelled, Staging, Ready for Shipment |
| `purchase_order_items` | `status` | **FREE TEXT** (default **pending**) — e.g. Ready for Shipment |
| `billings` | `billing_status` | **pending**, partially_paid, paid, cancelled |
| `payments` | `status` | **pending**, verified, rejected |
| `payments` | `payment_type` | down_payment, balance |
| `payments` | `bank_name` | BDO, Chinabank, Other |
| `documents` | `status` | required, **uploaded**, verified, missing |
| `documents` | `document_type` | pro_forma_invoice, supplier_invoice, packing_list, export_declaration, certificate, bill_of_lading, other |
| `labeling_tasks` | `status` | **pending**, in_progress, completed |
| `staging_tasks` | `status` | **pending**, in_progress, completed |
| `shipments` | `status` | **planning**, ready_for_loading, loaded, shipped, completed, cancelled |
| `supplier_deliveries` | `delivery_status` | pending_confirmation, **received**, with_discrepancy, rejected |
| `supplier_delivery_items` | `condition_status` | **good**, damaged, missing, wrong_item |
| `suppliers` | `supplier_type` | manufacturer, distributor, supermarket |

### Order lifecycle

`customer_orders.status` is the single source of truth for the customer-facing
tracker (`shipments.status` is logistics detail only):

`draft` → `submitted` → `awaiting_down_payment` → `payment_verified`
→ `procurement_started` → `partially_received` → `warehouse_preparation`
→ `ready_for_shipment` → `shipped` → `completed` (with `cancelled` as an exit
from any pre-shipment state)

The admin wireframes' quotation-phase states (pending review / draft PFI /
sent to customer) are **derived**, not stored: e.g. `submitted` with no
`billings` row = pending review; `submitted` with a billing = sent to customer.

## Row-Level Security (RLS) state

RLS is enabled on every table, and **migrations 002–010 are all applied**, so
nearly every table now has policies:

- **Customer-scoped read** (own data via the order→customer→profile chain):
  `customer_orders`, `customer_order_items`, `billings`, `payments`,
  `documents`, `customer_locations`, plus — for the chatbot (migration 008) —
  `prediction_records`, `labeling_tasks`, `staging_tasks`, `supplier_deliveries`.
- **Staff role-based** (via `has_role(...)`): products, purchase_orders,
  purchase_order_items, suppliers, supplier_deliveries, supplier_delivery_items,
  supplier_performance, supplier_product_costs, labeling_tasks, staging_tasks,
  warehouse_locations, sticker_designs, inventory_batches, shipments — plus
  billings/payments verify (admin/sales) and warehouse writes (migration 007).
- **Supplier portal** (migration 005): suppliers see only their own POs,
  deliveries, and performance via `suppliers.profile_id`.
- **Payment proofs** live in the private `payment-proofs` storage bucket
  (migration 010): customers upload/read their own folder; staff read all.
- Still deny-all (no policies): `activity_logs`, `number_sequences`
  (function-only).

RLS helper functions live in the DB: `has_role(text[])`, `current_user_role()`,
`customer_can_read_order()`, `customer_can_read_order_item()`,
`customer_matches_current_user()`.

Application RPCs (all security-definer):

- `approve_quotation(p_order_id uuid)` (migration 002, v2 in 004) — validates
  the caller owns the order and it is in `submitted` status, then sets
  `status = 'awaiting_down_payment'`, stamps `confirmed_at`, moves the QT-
  number into `quotation_number`, and assigns a fresh ORD- `order_number`.
  Used by the customer PFI review page (customers have no direct UPDATE
  rights on `customer_orders`).
- `next_document_number(p_prefix text)` (migration 004) — returns
  `PREFIX-YYYY-NNN` from atomic per-prefix per-year counters in
  `number_sequences` (RLS-locked, function-only access). Used for QT- numbers
  on quotation submit and ORD- numbers on approval.

## Known code ↔ schema gaps

1. ✅ **Login role routing** — fixed; all seven roles route to real dashboards.
2. **Over-permissive legacy policies (security)** — `customer_orders` and
   `customer_order_items` still have a `SELECT` policy for role `public`
   (`qual = true`), so anyone (even anon) can read all orders/items; `customers`
   is readable by any authenticated user. Tighten before final submission.
3. **Mixed PO status vocabulary** — `purchase_orders.status` now carries both
   lowercase pipeline values (`sent`, `delivered`) and Title-Case warehouse
   values (`Staging`, `Ready for Shipment`) because its check was dropped.
   Worth standardizing later.
4. **Not every DB change is captured in the repo** — teammates apply some
   changes via the SQL editor. Re-run the introspection query after schema
   changes so these docs stay accurate.

## Regenerating this snapshot

Run the introspection query in the Supabase SQL Editor (returns one JSON blob
covering columns, enums, foreign keys, RLS, policies, and row counts), then
update `schema.sql` and this file. Keep both in sync with any migration.
