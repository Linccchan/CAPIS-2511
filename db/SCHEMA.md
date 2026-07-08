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
- **No Postgres enums** — all statuses are free-text `text` with a default.

## Roles

`profiles.role` is free text. The canonical set (enforced only in RLS helper
functions, not by a constraint) is:

`admin` · `sales` · `management` · `procurement` · `warehouse` · `customer`

> Suppliers are **not** system users — they receive POs by email (matches the
> proposal). There is a `suppliers` table but no `supplier` login role.

## Status columns & defaults

| Table | Column | Default |
|-------|--------|---------|
| `customer_orders` | `status` | `draft` |
| `purchase_orders` | `status` | `draft` |
| `billings` | `billing_status` | `pending` |
| `payments` | `status` | `pending` |
| `documents` | `status` | `uploaded` |
| `labeling_tasks` | `status` | `pending` |
| `staging_tasks` | `status` | `pending` |
| `shipments` | `status` | `planning` |
| `supplier_deliveries` | `delivery_status` | `received` |
| `supplier_delivery_items` | `condition_status` | `good` |

### Proposed canonical order-status lifecycle (to standardize)

`customer_orders.status` values are currently ad-hoc. Recommended lifecycle,
aligned with the proposal workflow (define once, use across all modules):

`draft` → `submitted` → `pfi_prepared` → `pfi_approved` → `awaiting_down_payment`
→ `payment_verified` → `procurement` → `partially_received` → `warehouse_preparation`
→ `ready_for_shipment` → `shipped`

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
4. **No enforced status vocabulary** — standardize on the lifecycle above.

## Regenerating this snapshot

Run the introspection query in the Supabase SQL Editor (returns one JSON blob
covering columns, enums, foreign keys, RLS, policies, and row counts), then
update `schema.sql` and this file. Keep both in sync with any migration.
