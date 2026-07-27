# User Acceptance Testing Report

**System:** Export Consolidation System for DMC Enterprise with Predictive Analytics
**Phase:** Testing Phase (methodology §3.3.4)
**Date of testing:** 27–28 July 2026
**Environment:** Next.js application on `localhost:3000` against the shared Supabase database, seeded with representative export orders, suppliers, products, and warehouse locations.

---

## 1. Purpose and method

Testing verified the system against the objectives stated in the proposal (§1.5) and the operational problems those objectives address (§1.4). Two techniques from the methodology were used:

- **Structured test cases** — each objective was exercised through the interface by the role that performs that work at DMC, comparing observed behaviour against an expected result.
- **End-to-end integration test** — a single customer order was traced through every stage of DMC's export workflow across all six user roles, verifying that each department's action was reflected to the others without external coordination.

Defects found during testing were recorded, corrected, and re-verified. The resulting **Revision List** is Section 5.

**Test accounts** — one per role: customer, sales, procurement, warehouse, supplier, admin, and management.

---

## 2. Requirements traceability results

| Objective | Description | Result |
|-----------|-------------|--------|
| **1.5.1** | Customer interaction module — standardised order submission and real-time order status | ✅ **Accomplished** |
| **1.5.2** | Order management module — consolidated supplier purchase orders and fulfilment monitoring | ✅ **Accomplished** |
| **1.5.3** | Supplier and warehouse module — staging, labelling, and shipment preparation records | ✅ **Accomplished** |
| **1.5.4** | Predictive analytics module — shipment readiness estimation and supplier performance | ⚠️ **Accomplished with qualification** (see §4) |
| **1.5.5** | Integration of operational data in a centralised system | ✅ **Accomplished — demonstrated end to end** |
| **Module 5** | Billing and payment — billing records and payment verification as a workflow trigger | ✅ **Accomplished** |
| **Security** | Role-based access and row-level security (§1.6.3) | ✅ **Accomplished** |

### 2.1 Objective 1.5.1 — Customer Interaction
Verified: role-based login; catalogue browsing with search and filters and **no prices shown**, consistent with DMC quoting through a pro forma invoice; quotation submission producing a sequential `QT-YYYY-NNN` reference; live CBM and weight totals; delivery destination drawn from the customer's saved locations; order tracking; documents; profile management.

*Addresses problem 1.4.2 — replaces email ordering, the ~20 minutes of manual encoding per order, and the ~8 status enquiries per order.*

### 2.2 Objective 1.5.2 — Order Management
Verified: quotation queue; pro forma invoice preparation with unit prices, shipping, and validity; purchase orders issued per supplier with only that supplier's products; consolidated view of an order's purchase orders showing which suppliers have delivered and which are outstanding.

*Addresses problem 1.4.4 — multi-supplier consolidation previously tracked across spreadsheets and email.*

### 2.3 Objective 1.5.3 — Supplier and Warehouse
Verified: supplier portal restricted to the signed-in supplier's own purchase orders; dispatch logging including short supply; warehouse receipt confirmation with quantities, condition, and rack location; compliance sticker progress; staging; and container loading.

*Addresses problem 1.4.5 — labelling and staging progress previously invisible to the office for one to two weeks.*

### 2.4 Objective 1.5.4 — Predictive Analytics
Verified: executive dashboard presenting supplier reliability, predicted ready dates with confidence values and risk flags, and order completion trends; import of historical purchase-order and receipt data producing per-supplier average lead times and on-time rates.

*Addresses problem 1.4.6 — shipment readiness previously estimated from experience, contributing to roughly five missed container bookings a year at about ₱5,000 per day of demurrage.* See §4 for the qualification.

### 2.5 Objective 1.5.5 — Centralised integration
Demonstrated by the end-to-end test in Section 3.

### 2.6 Module 5 — Billing and Payment
Verified: pro forma invoice presented to the customer with subtotal, shipping, total, 50% down payment, validity, and preparer; customer approval; payment recording with a telegraphic transfer slip; staff verification queue with slip review, verification, and rejection; and the balance payment collected after shipment.

*Addresses problem 1.4.3 — payment confirmation previously handled by cross-referencing bank notifications, email, and accounting, delaying procurement by roughly a week.*

### 2.7 Security and access control
Verified: each of the seven roles reaches its own dashboard; a customer sees only their own orders; a supplier sees only their own purchase orders and deliveries; unauthenticated access to an internal address redirects to login. Migration `011` replaced the earlier public read policies on orders and customers with role- and ownership-scoped policies.

---

## 3. End-to-end integration test

A single order (`ORD-2026-001`, Ocean Fresh HK, destination Hong Kong) was traced through the complete workflow. Each row was confirmed by observing the customer's fulfilment tracker after the staff action.

| # | Role | Action performed | Result observed by the customer |
|---|------|------------------|-------------------------------|
| 1 | Customer | Submitted a quotation request from the catalogue | Order created, status *Submitted* |
| 2 | Sales | Prepared and sent the pro forma invoice | Invoice visible with prices, totals, and 50% down payment |
| 3 | Customer | Approved the quotation and recorded the down payment with a transfer slip | Renumbered to `ORD-`, status *Awaiting down payment* |
| 4 | Sales | Reviewed the slip and verified the payment | **Payment verified** ✓ |
| 5 | Procurement | Issued purchase orders to the supplier | **Procurement** ✓ |
| 6 | Supplier | Logged dispatches, including one line the supplier could not fulfil | — |
| 7 | Warehouse | Confirmed receipts, recording quantities, condition, and rack locations | **Partially received**, then **Warehouse prep** ✓ once all goods were in |
| 8 | Admin | Recorded compliance sticker progress to completion | — |
| 9 | Warehouse | Staged the goods and assigned locations | **Ready for shipment** ✓ |
| 10 | Warehouse | Recorded container loading | **Shipped** ✓ |
| 11 | Customer | Recorded the balance payment | — |
| 12 | Sales | Verified the balance payment | Billing **fully paid** |

**Result: passed.** The order progressed through every stage of DMC's export process without email, spreadsheets, or verbal coordination, and each department's action was visible to the others and to the customer as it happened.

A short supply was deliberately introduced at step 6 (one product could not be fulfilled). The system recorded the shortfall, held the order at *Partially received*, and only advanced once the outstanding quantity arrived — reproducing the multi-supplier consolidation behaviour described in §1.4.4.

---

## 4. Qualification on the predictive analytics module

The analytics module is functional: it computes supplier lead times, on-time rates, and reliability tiers, and produces predicted ready dates with confidence values and risk flags.

At the time of testing it was exercised with **synthetic data in the format of DMC's Odoo exports**, because the company's transaction history is commercially confidential. The import path for the real data is implemented and was tested with that data: files are parsed in the browser and never uploaded, and only per-supplier aggregate statistics are stored, so no transaction, customer, or cost information enters the system.

Prediction accuracy is expected to improve as operational history accumulates, which the proposal anticipates at §1.7.3.

---

## 5. Revision list

Defects identified during testing, with corrective action taken. All were re-verified after correction.

### Critical — prevented the workflow from completing

| # | Defect | Module | Corrective action |
|---|--------|--------|-------------------|
| 1 | The customer's fulfilment tracker never advanced past *Payment verified*; no part of the system updated the customer order after that point, so procurement, warehouse preparation, readiness, and shipment could never be shown. | 1, 2, 3 | Staff actions now advance the order at each stage, each transition permitted only from its expected preceding state. |
| 2 | Purchase orders dispatched by a supplier never appeared in the warehouse's delivery list, leaving the receipt confirmation screen reachable only by entering its address manually. | 3 | Added a list of dispatches awaiting confirmation, with a direct action to the receipt screen. |
| 3 | Purchase orders in a partially delivered state disappeared from the warehouse's view, so outstanding quantities could never be received — although tranche deliveries are normal at DMC. | 3 | Partially delivered orders remain listed. |
| 4 | Of two receiving flows, one did not advance the customer order, so goods could be fully received while the customer still saw *Partially received*. | 3 | Both flows now advance the order consistently. |
| 5 | The other receiving flow left received items in a state the stickering screen refuses to act on, so those orders could never reach staging or readiness. | 3 | Both flows mark received items pending sticker. |
| 6 | No action marked an order as shipped, so the tracker could not complete and the balance payment — which becomes payable on shipment — was unreachable. | 3, 5 | Container loading records a numbered shipment and advances the order. |

### Major — incorrect behaviour or blocked work

| # | Defect | Module | Corrective action |
|---|--------|--------|-------------------|
| 7 | Purchase orders could be created with no products, leaving suppliers nothing to dispatch; orders also copied every product of the customer order regardless of which supplier was being ordered from. | 2 | Products are selected per supplier with quantities; empty purchase orders are rejected. |
| 8 | Purchase orders created through the interface used a status the supplier portal does not recognise, so they could never be dispatched. | 2, 3 | Status list corrected to the system vocabulary, defaulting to *Sent*. |
| 9 | The date a purchase order was issued was never recorded, though supplier lead time is measured from it. | 2, 4 | The issue date is stamped on creation. |
| 10 | The staging screen offered warehouse locations already holding other goods, silently reassigning them. | 3 | Only free locations, or the one already holding that order, are offered. |
| 11 | Goods could be received without assigning a warehouse location, recording stock whose position was unknown — the memory-based problem the module exists to remove. | 3 | A location is required for every product received. |
| 12 | Receiving did not mark the assigned location as occupied, so racks holding stock still displayed as available. | 3 | Receipt marks the location occupied. |
| 13 | Occupancy was recorded without noting which purchase order was stored, producing locations that could not be released and exhausting those available for staging. | 3 | The stored purchase order is recorded and any occupied location can be released. |
| 14 | Navigation showed the menu belonging to the address being viewed rather than to the signed-in user, so a management user opening a shared page lost the route back to their own screens. | All | Navigation follows the signed-in user's role. |
| 15 | The sales role had no navigation menu at all. | 2 | A sales menu was added covering orders, invoicing, payments, and deliveries. |

### Moderate and minor

| # | Defect | Module | Corrective action |
|---|--------|--------|-------------------|
| 16 | The pro forma invoice download produced nothing. | 1, 5 | Added a printable invoice in DMC's document format, including the logistics block and conforme line. |
| 17 | Editing a purchase order gave no visible response, as the form appeared below the visible area. | 2 | The form is brought into view and names the order being edited. |
| 18 | Several navigation links led to the wrong page or into another role's section (five instances). | 2, 3 | Links corrected to remain within the user's own section. |
| 19 | Failures during staging were written only to the browser console, leaving the user without feedback. | 3 | Outcomes are reported on screen, and a claimed location is released if the operation fails. |
| 20 | Warehouse location cards displayed an internal record identifier instead of the purchase order number. | 3 | Cards show the purchase order, supplier, and customer order. |
| 21 | Rejecting a balance payment restored the form without telling the customer why, unlike the equivalent down-payment flow. | 5 | The customer is told the record was rejected and may resubmit. |
| 22 | Received rows disappeared from the delivery list although they still belonged there, returning only after a reload. | 3 | Rows remain, showing their updated status. |
| 23 | The sign-out control was pushed off screen for roles with longer menus. | All | The menu scrolls independently so the control stays in view. |

### Business rules enforced during review

A review of input handling before testing identified rules that were not enforced. All were corrected: destination is taken from the customer's saved delivery locations rather than free text; preferred shipping dates cannot be in the past; expired pro forma invoices cannot be approved, enforced both in the interface and in the database; quotations cannot be approved while items are unpriced; payment amounts are fixed to the amounts stated on the invoice; invoice unit prices must be above zero and validity dates cannot be in the past; dispatch quantities cannot exceed the outstanding balance of a purchase order; and received and staged quantities cannot exceed what was dispatched or required.

---

## 6. Known limitations

1. **Predictive analytics** currently runs on synthetic data in DMC's export format; see §4.
2. **Odoo accounting synchronisation** (transmitting billing and payment data by JSON-RPC) is designed but not implemented; billing records remain within the system.
3. **Supplier onboarding** requires an administrator to link a supplier record to a login account; suppliers cannot self-register.

---

## 7. Conclusion

The system meets objectives 1.5.1, 1.5.2, 1.5.3, and 1.5.5, together with the billing and payment module and the role-based access control the proposal commits to. Objective 1.5.4 is met in function, with prediction quality qualified by the data available at the time of testing.

Testing traced a complete export order through all six roles and every stage of DMC's process, from quotation to shipment and final payment, confirming that the operational information previously spread across spreadsheets, email, and verbal coordination is now held and shared in a single system.

Twenty-three defects were identified, corrected, and re-verified. A recurring cause is worth recording: most of the critical defects arose where the same operational step had been implemented twice by different developers and the two implementations had diverged. Agreeing ownership of shared screens would prevent this class of defect in future work.
