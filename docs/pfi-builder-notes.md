# PFI Builder — build notes (for Yoshi)

Spec for the PFI builder so it works against the **shared Supabase** on the
first try. Source of truth for the schema: [`db/SCHEMA.md`](../db/SCHEMA.md).

## Where it fits

Customer submits a quotation (`customer_orders.status = 'submitted'`, no
billing row yet) → **sales/admin builds the PFI** → customer sees it on
`/customer/quotation/[id]` and approves → order advances automatically.

The customer side is already fully built. The builder's ONLY jobs are:
set unit prices, create the billing row, done.

## Prerequisites (already handled)

- **Run `db/migrations/007`** first — before it, `billings` has no
  INSERT/UPDATE policy and every write is silently denied by RLS.
- Log in as an `admin` or `sales` account (those roles hold the write
  policies).

## What to write

**1. Price each line item** — update `customer_order_items.unit_price`
   (numeric, USD) for every item on the order. The customer page computes
   line subtotals as `unit_price * quantity_ordered`.

**2. Create ONE `billings` row** for the order:

| Column | What to put |
|---|---|
| `order_id` | the customer_orders id |
| `billing_number` | `await supabase.rpc('next_document_number', { p_prefix: 'PFI' })` → `PFI-2026-001` (do NOT invent your own numbering) |
| `shipping_amount` | estimated shipping (numeric) |
| `total_amount` | products subtotal **+ shipping** (grand total — the customer page derives subtotal as `total_amount - shipping_amount`) |
| `down_payment_required` | 50% of total_amount |
| `balance_amount` | the other 50% |
| `valid_until` | expiry date (e.g. `current_date + 14`) — shown to the customer as "Expires" |
| `prepared_by` | the logged-in staff profile id — shown as "Prepared by" |
| `currency` | `'USD'` |
| `billing_status` | leave default `'pending'` |

## Do NOT

- **Do not change `customer_orders.status`.** It stays `'submitted'` while
  quoting. "PFI sent" is a derived state (submitted + billing row exists).
  The customer's Approve button calls the `approve_quotation` RPC, which
  advances the status and assigns the ORD- number.
- **Do not write statuses like `pfi_sent` / `pending_quotation`** — the DB
  CHECK constraint (`customer_orders_status_check`) rejects them with error
  23514. Allowed values are listed in `db/SCHEMA.md`.
- **Do not create a second billing row** for the same order — the customer
  page fetches with `.single()`.

## Quotation list states (derived, not stored)

- Pending review = `status = 'submitted'` AND no billings row
- Sent to customer = `status = 'submitted'` AND billings row exists
- Approved = `status = 'awaiting_down_payment'` (or later)
- Expired = billings.valid_until < today AND still `'submitted'`

## Quick test loop

1. Log in as the customer → submit a quotation.
2. Log in as admin/sales → build the PFI on that order.
3. Log in as the customer again → `/customer/quotation/[id]` should show the
   full invoice (lines, subtotal/shipping/total, expiry, prepared-by) and the
   Approve button. Approve → down-payment panel + ORD- renumbering.
