# Requirements Acceptance Test

Validates the system against the capstone proposal's objectives (§1.5) and the
problems they address (§1.4). Fill in Result (✅ Pass / ⚠️ Partial / ❌ Fail)
and Notes as you go; capture a screenshot per test for the UAT appendix.

**Tester:** ______________  **Date:** ______________

**Before starting:** migrations 001–011 applied · `npm run dev` running ·
logged out · one browser · test accounts ready (customer `testcustomer@dmc.com`,
sales `salesdmc@gmail.com`, admin `admindmc@gmail.com`, procurement
`prodmc@gmail.com`, warehouse `whdmc@gmail.com`, supplier `supplier@test.com`,
management `managerdmc@gmail.com`).

---

## Objective 1.5.1 — Customer Interaction Module
*Standardize order submission and let customers monitor status in real time (problem 1.4.2: 20-min manual encoding, ~8 status inquiries per order).*

| # | Test | Steps (log in as **customer**) | Expected result | Result | Notes |
|---|------|--------------------------------|-----------------|--------|-------|
| 1.1 | Role-based login | Sign in | Lands on `/customer/dashboard` | | |
| 1.2 | Browse catalog | Product Catalog → search/filter | Products listed by category, **no prices shown** | | |
| 1.3 | Add to request | "+ Add to request" on 2–3 products | Buttons show "Added ✓"; selection bar appears | | |
| 1.4 | Submit quotation | Continue → set quantities → submit | Live CBM/weight totals; order gets a **QT-YYYY-NNN** number | | |
| 1.5 | Destination control | Open the Deliver To field | Only the customer's **saved delivery locations**; default pre-selected | | |
| 1.6 | Date validation | Try picking a past preferred ship date | Past dates cannot be selected | | |
| 1.7 | Order tracking | My Orders → open an order | Status + fulfillment tracker visible without contacting DMC | | |
| 1.8 | Documents | Documents page | Export paperwork listed per order (drafts hidden) | | |
| 1.9 | Profile & locations | Profile & Settings | Company details + delivery locations manageable | | |

## Objective 1.5.2 — Order Management Module
*Consolidate supplier POs and monitor multi-supplier fulfillment (problem 1.4.4).*

| # | Test | Steps | Expected result | Result | Notes |
|---|------|-------|-----------------|--------|-------|
| 2.1 | Quotation queue | **sales** → Customer Orders | Submitted quotations listed | | |
| 2.2 | PFI builder | Open a submitted quotation → build PFI (prices, shipping, expiry) | PFI saved with a **PFI-YYYY-NNN** number | | |
| 2.3 | PFI validation | Try a zero unit price / past expiry | Rejected with a clear message | | |
| 2.4 | Consolidation view | **admin** → Order Management → an order with POs | One view showing all POs and which suppliers delivered vs. pending | | |
| 2.5 | Purchase orders | Purchase Orders list | POs with supplier, dates, and status | | |

## Objective 1.5.3 — Supplier & Warehouse Module
*Record staging, labeling, and shipment preparation (problem 1.4.5).*

| # | Test | Steps | Expected result | Result | Notes |
|---|------|-------|-----------------|--------|-------|
| 3.1 | Supplier portal scope | **supplier** → Dashboard | Sees **only their own** POs | | |
| 3.2 | Log dispatch | Open a PO → log dispatch (try a partial qty) | Dispatch recorded; partial handled | | |
| 3.3 | Warehouse receiving | **warehouse** → Log Delivery | Received qty, condition, and location recorded | | |
| 3.4 | Staging & stickers | Staging Tracker | Sticker/staging progress visible; order can be marked ready | | |
| 3.5 | Stock & locations | Stock / Warehouse Locations | Stored items and rack locations visible | | |

## Objective 1.5.4 — Predictive Analytics Module
*Estimate shipment readiness and supplier performance from historical data (problem 1.4.6: ~5 missed containers/yr, ₱5,000/day demurrage).*

| # | Test | Steps (log in as **management**) | Expected result | Result | Notes |
|---|------|----------------------------------|-----------------|--------|-------|
| 4.1 | Executive dashboard | Sign in | Lands on `/management/analytics` | | |
| 4.2 | Overview metrics | Top cards | Active orders, avg order-to-ship, on-time supplier rate, at-risk count | | |
| 4.3 | Shipment predictions | Predictive shipment timelines table | Each active order shows a **predicted ready date + confidence + risk flag** | | |
| 4.4 | Supplier reliability | Supplier performance detail | Avg lead days, on-time rate, reliability tier per supplier | | |
| 4.5 | Data limitation | — | Predictions computed from limited in-system history; **pending import of DMC's historical Odoo transactions** to sharpen accuracy (proposal §1.7.3 anticipates this) | ⚠️ | |

## Module 5 — Billing & Payment
*Link payment verification to the order workflow (problem 1.4.3: ~1 week lost between confirmation and procurement).*

| # | Test | Steps | Expected result | Result | Notes |
|---|------|-------|-----------------|--------|-------|
| 5.1 | PFI review | **customer** → open quotation with a PFI | Line items, subtotal, shipping, total, 50% down payment, expiry, prepared-by | | |
| 5.2 | Approve quotation | Click Approve | Status → awaiting down payment; order renumbered **ORD-YYYY-NNN** | | |
| 5.3 | Record payment | Fill the payment form + upload a transfer slip | Payment recorded as *Pending verification*; amount fixed to the PFI's 50% | | |
| 5.4 | Verify payment | **sales** → Billing & Payments → View slip → Verify | Order advances to **payment_verified** (procurement trigger) | | |
| 5.5 | Billing records | Billing & Payments list | Per-order totals with DP/balance status | | |

## Objective 1.5.5 — Centralized integration (end-to-end)
*One order flowing through every role in a single system.*

| # | Test | Steps | Expected result | Result | Notes |
|---|------|-------|-----------------|--------|-------|
| 6.1 | Full workflow | customer submits → sales prices PFI → customer approves + pays → sales verifies → procurement/admin POs → supplier dispatches → warehouse receives + stages → customer sees tracker advance | Each role's action is immediately visible to the others; **no email/spreadsheet needed** | | |

## Security & access control
*Row-level security promised in §1.6.3.*

| # | Test | Steps | Expected result | Result | Notes |
|---|------|-------|-----------------|--------|-------|
| 7.1 | Role routing | Log in as each of the 7 roles | Each lands on its own dashboard | | |
| 7.2 | Customer isolation | As customer, note an order id; check no other customer's data is visible | Customers see only their own orders (migration 011) | | |
| 7.3 | Supplier isolation | As supplier | Sees only their own POs/deliveries | | |
| 7.4 | Unauthenticated access | Log out, paste a customer URL directly | Redirected to login | | |

---

## Summary

| Objective | Verdict |
|-----------|---------|
| 1.5.1 Customer Interaction | |
| 1.5.2 Order Management | |
| 1.5.3 Supplier & Warehouse | |
| 1.5.4 Predictive Analytics | |
| 1.5.5 Centralized integration | |
| Module 5 Billing & Payment | |
| Security / RBAC | |

**Known limitations at time of testing**
- Predictive analytics runs on limited in-system history; DMC's historical Odoo export is pending import.
- Odoo JSON-RPC accounting sync is designed but not implemented.
- PFI PDF download is a placeholder.
