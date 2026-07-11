# End-to-end demo runbook — "One order through DMC"

Scenario: an Ocean Fresh HK order traced through every role, showing the
three linked modules covering DMC's real process (order → PFI → payment →
procurement → consolidation → shipment readiness).

## One-time setup (night before)

1. **Run migrations in order** (Supabase SQL editor): `005` → `007` → `db/seed_demo.sql`.
2. **Test accounts** (Supabase Auth → Add user, auto-confirm, then insert a
   `profiles` row with the role): `customer`, `sales` (or use `admin`),
   `admin`, `warehouse`, `supplier`. The supplier account's **login email must
   equal `suppliers.email`** — the seed uses `supplier@test.com` for
   Universal Robina Corp. Give the supplier profile `role = 'supplier'`
   (allowed after migration 005).
3. `npm run dev`, log out, full dry run once.

## Demo script (~12 min)

**Act 1 — Customer orders (Module 1).** Log in as customer → catalog → add
products → quotation form (default delivery location pre-selected, ship date
can't be in the past) → submit → note the QT- number. *Say: replaces email
orders and 20 minutes of re-encoding (problem 1.4.2).*

**Act 2 — DMC prices it (Module 2).** Log in as sales/admin → quotation →
PFI builder: set unit prices, shipping, validity → send. *Say: PFI totals,
CBM and 50% down payment come straight from the order data.*

**Act 3 — Customer approves.** Back as customer → open the quotation → full
PFI on screen → Approve → down-payment panel (BDO/Chinabank T/T) → order is
renumbered ORD-. *Say: payment verification is the workflow trigger
(problem 1.4.3); the recording UI ships with the Billing module.*

**Act 4 — Consolidation (Module 2).** As admin → order-management → show
ORD-2026-911: two POs, one partially delivered — the consolidation view.
*Say: DMC's core pain, 3–5 suppliers per order, tracked in one screen
instead of spreadsheets (problem 1.4.4).*

**Act 5 — Supplier dispatch (Module 3).** Log in as supplier → dashboard
shows only URC's own POs → open PO → log dispatch (with partial-qty reason).
*Say: suppliers self-serve; RLS restricts them to their own data.*

**Act 6 — Warehouse (Module 3).** Log in as warehouse → log delivery against
the PO (qty, condition, rack location) → staging tracker on ORD-2026-912:
labeling progress (HK nutrition labels), staged quantities → mark ready when
complete. *Say: stickering/staging was invisible for 1–2 weeks per order
(problem 1.4.5).*

**Act 7 — The payoff.** Log back in as customer → My Orders → the tracker
has advanced in real time. *Say: this replaces the ~8 "where is my order"
emails per order — and every timestamp recorded along the way is training
data for the predictive analytics module (next sprint), which closes the
missed-container/demurrage problem (1.4.6).*

## Known gaps if asked

PFI PDF download, payment-proof upload + verification UI (Module 5),
predictive analytics dashboard (Module 4) — all scheduled, none blocking the
operational spine shown above.
