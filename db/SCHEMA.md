# Database Schema Reference

Source-of-truth documentation for the DMC Export Consolidation System database
(Supabase / PostgreSQL). Snapshot taken **2026-07-08** by introspecting the live
`public` schema. The runnable DDL is in [`schema.sql`](./schema.sql); this file
adds the things DDL doesn't show — RLS state, roles, status vocabulary, and
known gaps between the code and the database.

> The database was built ahead of the UI: **all 21 tables for all 5 modules
> already exist**, even though only the customer screens are coded so far.

## Tables by module

| Module | Tables |
|--------|--------|
| Auth / core | `profiles`, `customers`, `products`, `suppliers` |
| 1 — Customer Interaction | `customer_orders`, `customer_order_items` |
| 2 — Order Management / procurement | `purchase_orders`, `purchase_order_items`, `supplier_deliveries`, `supplier_delivery_items` |
| 3 — Supplier & Warehouse | `warehouse_locations`, `inventory_batches`, `labeling_tasks`, `staging_tasks`, `shipments` |
| 4 — Predictive Analytics | `prediction_records`, `supplier_performance` |
| 5 — Billing & Payment | `billings`, `payments` |
| Cross-cutting | `documents`, `activity_logs` |

## Conventions

- Every primary key is `id uuid default gen_random_uuid()` (except `profiles.id`,
  which equals the Supabase `auth.users` id).
- Audit columns are `timestamptz default now()`.
- **No Postgres enums, but statuses are NOT free text** — every status/role/type
  column is vocabulary-enforced by a CHECK constraint (verified from
  `pg_constraint`, 2026-07-09; full DDL at the end of `schema.sql`). Writing any
  other value fails with a `23514` check-violation error.

## Roles

`profiles.role` is enforced by `profiles_role_check`:

`admin` · `sales` · `management` · `procurement` · `warehouse` · `customer`

> There is a `suppliers` table but no `supplier` login role. The wireframes
> include a supplier portal, so when that module is built the
> `profiles_role_check` constraint must be altered to allow `'supplier'`.

## Status columns — allowed values (CHECK-enforced) & defaults

| Table | Column | Allowed values (default in **bold**) |
|-------|--------|--------------------------------------|
| `customer_orders` | `status` | **draft**, submitted, awaiting_down_payment, payment_verified, procurement_started, partially_received, warehouse_preparation, ready_for_shipment, shipped, completed, cancelled |
| `purchase_orders` | `status` | **draft**, sent, partially_delivered, delivered, cancelled |
| `billings` | `billing_status` | **pending**, partially_paid, paid, cancelled |
| `payments` | `status` | **pending**, verified, rejected |
| `payments` | `payment_type` | down_payment, balance |
| `payments` | `bank_name` | BDO, Chinabank, Other |
| `documents` | `status` | required, **uploaded**, verified, missing |
| `documents` | `document_type` | pro_forma_invoice, supplier_invoice, packing_list, export_declaration, certificate, bill_of_lading, other |
| `labeling_tasks` | `status` | **pending**, in_progress, completed |
| `staging_tasks` | `status` | **pending**, in_progress, completed |
| `shipments` | `status` | **planning**, ready_for_loading, loaded, shipped, completed, cancelled |
| `supplier_deliveries` | `delivery_status` | **received**, with_discrepancy, rejected |
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

RLS is **enabled on all 21 tables**. Policy coverage as of the snapshot:

- **Have policies:** `profiles`, `customers`, `products`, `customer_orders`,
  `customer_order_items`, `purchase_orders`, `purchase_order_items`,
  `shipments`, `inventory_batches`, `billings` (customer-own + staff read,
  migration 002), `documents` (customer-own non-draft + staff read,
  migration 003).
- **RLS on but NO policies (currently deny-all to app users):**
  `payments`, `labeling_tasks`, `staging_tasks`, `suppliers`,
  `supplier_deliveries`, `supplier_delivery_items`, `supplier_performance`,
  `prediction_records`, `warehouse_locations`, `activity_logs`.

RLS helper functions live in the DB: `has_role(text[])`, `current_user_role()`,
`customer_can_read_order()`, `customer_can_read_order_item()`,
`customer_matches_current_user()`.

Application RPCs: `approve_quotation(p_order_id uuid)` (migration 002) —
security-definer; validates the caller owns the order and it is in `submitted`
status, then sets `status = 'awaiting_down_payment'` and stamps `confirmed_at`.
Used by the customer PFI review page (customers have no direct UPDATE rights
on `customer_orders`).

## Known code ↔ schema gaps (to fix)

1. **Login role routing is wrong** — `src/app/page.js` uses `executive` and
   `supplier`; the DB uses `management`, and `sales`/`procurement` staff fall
   through to the customer dashboard. Map `executive`→`management`, drop
   `supplier`, and add `sales`/`procurement` routes.
2. **Deny-all RLS breaks module screens** — tables without policies return
   nothing to app users. `billings` was fixed in migration 002; add customer/
   staff read policies for the remaining tables as each module is built.
3. **Over-permissive policies (security)** — `customer_orders` and
   `customer_order_items` are readable by role `public` (`qual = true`), and
   `customers` by any authenticated user. Tighten before UAT/demo.
4. **Status vocabulary is CHECK-enforced** — any status a screen writes or
   filters on must appear in the allowed-values table above, or inserts fail
   with error `23514`.

## Regenerating this snapshot

Run the introspection query in the Supabase SQL Editor (returns one JSON blob
covering columns, enums, foreign keys, RLS, policies, and row counts), then
update `schema.sql` and this file. Keep both in sync with any migration.
