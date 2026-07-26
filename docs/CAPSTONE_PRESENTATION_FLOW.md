# CAPIS-2511 Capstone Presentation Flow

## Presentation goal

Present CAPIS-2511 as one connected export-consolidation system—not as a
collection of unrelated screens. Follow one customer order from quotation to
shipment readiness and show how every role contributes to the same live
record.

**Recommended duration:** 15–18 minutes presentation, followed by Q&A.

**Core story:** CAPIS replaces fragmented emails and spreadsheets with a
role-based workflow for customers, DMC staff, suppliers, and warehouse
personnel.

---

## 1. Opening and team introduction — 1 minute

### Show

Title slide:

> CAPIS-2511: Export Consolidation Information System for DMC Enterprise

### Say

> Good day. We are presenting CAPIS-2511, a custom export-consolidation
> information system for DMC Enterprise. DMC consolidates Philippine FMCG
> products from multiple suppliers into export orders. Our system connects the
> customer, DMC, suppliers, and warehouse in one traceable workflow.

Introduce the team members and their assigned areas briefly.

---

## 2. Company context and problem — 2 minutes

### Show

A simple process diagram:

`Customer → DMC → Multiple suppliers → Warehouse → Export shipment`

### Explain the operational problems

1. Customer orders arrive through email and must be re-encoded manually.
2. Quotations and pro forma invoices are prepared separately from the order.
3. Payment verification is not directly connected to procurement.
4. One customer order can involve three to five suppliers, making
   consolidation difficult to monitor in spreadsheets.
5. Receiving, labeling, and staging progress can remain invisible for one to
   two weeks.
6. Customers repeatedly ask for order updates because they have no
   self-service tracker.
7. Incomplete visibility can lead to missed shipment schedules, additional
   storage, and demurrage costs.

### Transition

> CAPIS creates one source of truth from quotation request through shipment
> readiness, while giving every role only the access needed for its work.

---

## 3. Project objectives and scope — 1 minute

### General objective

Develop an export-consolidation information system that improves order
visibility, coordination, and operational control for DMC Enterprise.

### Modules

1. **Customer Interaction**
   - Product catalog
   - Quotation requests and PFI approval
   - Order tracking
   - Customer-visible documents
   - Read-only order assistant

2. **Order Management**
   - Quotation review and PFI preparation
   - Customer-order monitoring
   - Purchase orders
   - Multi-supplier consolidation

3. **Supplier and Warehouse Management**
   - Supplier-specific purchase orders
   - Dispatch and delivery records
   - Warehouse receiving
   - Labeling, staging, stock, and locations

4. **Predictive Analytics**
   - Shipment-readiness estimates
   - Supplier-performance information

5. **Billing and Payment**
   - PFI totals and down-payment requirements
   - Payment verification workflow
   - Planned Odoo accounting synchronization

---

## 4. System architecture and security — 1.5 minutes

### Show

`Next.js/React → Supabase API/Auth → PostgreSQL`

Supporting services:

- Vercel for deployment
- Gemini API for the customer order assistant
- Nodemailer for supplier purchase-order email
- Recharts for operational visualizations
- Planned Odoo JSON-RPC integration for accounting

### Explain

- The application uses Next.js with role-based interfaces.
- Supabase provides PostgreSQL, authentication, and Row-Level Security.
- The database contains linked records for customer orders, purchase orders,
  supplier deliveries, warehouse tasks, shipments, billings, payments,
  predictions, and documents.
- Row-Level Security prevents customers and suppliers from reading unrelated
  records.
- The chatbot is read-only. It cannot approve, cancel, edit, or create
  operational records.
- Shipment-readiness estimates are explicitly described as estimates—not
  guarantees.

---

## 5. Live demonstration: one order through DMC — 8–10 minutes

Use one prepared demo order throughout. Suggested order:
`ORD-2026-911` or the seeded order available in the database.

### Act 1 — Customer submits a quotation request

**Role:** Customer  
**Routes:** `/customer/dashboard`, `/customer/catalog`,
`/customer/quotation/new`

1. Open the customer dashboard.
2. Show recent orders and notifications.
3. Open the product catalog.
4. Select products and quantities.
5. Open the quotation form.
6. Show the saved delivery location and requested ship date.
7. Submit the request and point out its `QT-` document number.

**Speaker cue:**

> The customer enters the request directly, removing the need for DMC staff to
> re-encode an emailed order.

### Act 2 — DMC prepares the PFI

**Role:** Admin or sales  
**Routes:** `/order-management/customer-orders`,
`/order-management/customer-orders/[id]/pfi`

1. Open the submitted quotation.
2. Show its customer, delivery, and line-item information.
3. Enter unit prices, shipping cost, and validity date.
4. Point out the automatically calculated subtotal, total, and 50% down
   payment.
5. Save/send the PFI.

**Speaker cue:**

> The PFI is generated from the same order data. This reduces duplicate entry
> and keeps pricing, volume, shipping, and payment requirements connected.

### Act 3 — Customer reviews and approves

**Role:** Customer  
**Route:** `/customer/quotation/[id]`

1. Open the quotation.
2. Show the full PFI and validity date.
3. Approve it.
4. Point out that the record advances to `awaiting_down_payment`.
5. Show that the quotation number is retained and a new `ORD-` number is
   assigned.

**Speaker cue:**

> Approval is a controlled database operation. The customer can approve only
> their own submitted quotation, and the system assigns the official order
> number atomically.

### Act 4 — DMC starts multi-supplier consolidation

**Role:** Admin or sales  
**Routes:** `/order-management/customer-orders/[id]`,
`/order-management/purchase-orders`

1. Open the approved customer order.
2. Show the purchase orders belonging to different suppliers.
3. Compare ordered, dispatched, and received quantities.
4. Point out partially delivered or overdue POs.

**Speaker cue:**

> This is DMC's central consolidation view. Instead of checking separate
> spreadsheets and messages, staff can see how every supplier contributes to
> one customer order.

### Act 5 — Supplier records dispatch

**Role:** Supplier  
**Routes:** `/supplier/dashboard`, `/supplier/purchase-orders`,
`/supplier/purchase-orders/[id]/dispatch`

1. Show that the supplier sees only its assigned purchase orders.
2. Open a PO.
3. Record a full or partial dispatch.
4. If partial, enter the reason.
5. Open delivery history.

**Speaker cue:**

> Suppliers update DMC directly, while Row-Level Security restricts them to
> their own records.

### Act 6 — Warehouse receives and prepares goods

**Role:** Warehouse  
**Routes:** `/warehouse/log-delivery`, `/warehouse/staging`,
`/warehouse/stock`, `/warehouse/warehouse-locations`

1. Open an expected delivery.
2. Record received quantity, condition, and warehouse location.
3. Show how discrepancies can be recorded.
4. Open the staging tracker.
5. Update labeling and staged quantities.
6. Show stock and rack-location visibility.
7. Mark the order ready only when preparation is complete.

**Speaker cue:**

> Receiving, labeling, and staging are now visible steps. DMC can identify
> exactly what is incomplete before committing to shipment readiness.

### Act 7 — Customer tracks the result

**Role:** Customer  
**Routes:** `/customer/orders`, `/customer/orders/[id]`

1. Return to the customer account.
2. Open the same order.
3. Show its updated tracker.
4. Show customer-visible documents, if available.

**Speaker cue:**

> The customer sees recorded progress without repeatedly asking DMC for an
> update. Internal supplier and warehouse records remain protected.

### Act 8 — Demonstrate the customer order assistant

**Role:** Customer  
**Location:** Customer dashboard chatbot

Select the demo order before asking order-specific questions.

Recommended prompts:

1. `What is the current status of my order?`
2. `Have the supplier deliveries been completed?`
3. `Has labeling been completed?`
4. `What steps are still remaining?`
5. `When is my order estimated to be ready?`
6. `What documents are available?`

Then demonstrate a protected action:

`Cancel my order.`

Expected behavior: the assistant refuses to modify the order and directs the
customer to DMC staff.

**Speaker cue:**

> The assistant answers from customer-authorized database records. It does not
> invent operational facts, expose another customer's order, or perform
> write actions. If Gemini is unavailable, deterministic responses still
> answer supported order questions from recorded data.

---

## 6. Technical highlights and validation — 1.5 minutes

### Database integrity

- One order lifecycle is enforced through defined status values.
- Atomic document numbering creates `QT-`, `PFI-`, `ORD-`, and related
  references.
- Customer PFI approval uses a security-definer database function.
- Relational links connect the customer order to procurement, deliveries,
  warehouse tasks, billings, payments, shipments, and documents.

### Security

- Supabase Authentication identifies the signed-in user.
- Row-Level Security applies ownership and role checks at the database layer.
- Supplier access is scoped to the supplier represented by the login.
- Customer chatbot queries are restricted to the signed-in customer's orders.
- Chat requests are validated, rate-limited, and protected from prompt
  injection and unsafe write requests.

### Testing

Mention the automated chatbot tests:

- Request validation
- Rate limiting
- Safety refusals
- Deterministic order responses
- Plain-text response enforcement

Run before the presentation:

```bash
npm test
npm run lint
npm run build
```

---

## 7. Results and business value — 1 minute

### Summarize

- Less duplicate encoding between emails, orders, and PFIs
- A shared view of multi-supplier consolidation
- Traceable supplier dispatch and warehouse receiving
- Visible labeling and staging progress
- Customer self-service tracking
- Better operational timestamps for future readiness prediction
- Stronger access control than shared spreadsheets

### Closing line

> CAPIS turns DMC's export-consolidation process into one traceable workflow.
> Every role contributes to the same order, while each user sees only the
> information needed for their responsibility.

---

## 8. Current limitations and next steps — 45 seconds

Be direct if the panel asks:

- PFI PDF export remains to be finalized.
- Payment-proof upload and complete payment-verification screens are part of
  the Billing and Payment module roadmap.
- Prediction accuracy depends on sufficient historical operational data.
- Odoo accounting synchronization is planned and should be validated against
  DMC's production configuration.
- Email and Gemini integrations require valid service credentials.

Do not present estimates as guaranteed shipping dates.

---

## 9. Likely panel questions

### Why not use only Odoo?

CAPIS focuses on DMC's customer-facing and export-consolidation workflow,
including customer quotation requests, multi-supplier monitoring, warehouse
labeling/staging visibility, and readiness information. Odoo remains the
accounting/ERP system and is treated as an integration target.

### How is this different from a normal inventory system?

The central record is the export customer order. CAPIS links that order to
multiple suppliers, deliveries, labeling requirements, staging tasks,
documents, payments, and shipment readiness.

### How do you protect customer data?

Authentication identifies the user, while Row-Level Security enforces access
inside PostgreSQL. Customers query only their own orders; suppliers query only
their assigned purchase orders.

### Can the chatbot change an order?

No. It is read-only and refuses requests to create, approve, cancel, delete,
or modify operational records.

### What happens if the AI service fails?

Supported operational questions have deterministic responses based on
recorded order data. The system does not need to fabricate an answer.

### Is the predicted date guaranteed?

No. The interface and assistant distinguish estimated readiness from a
confirmed shipment date. Predictions depend on the available recorded data.

### How does the system know an order is ready?

The order lifecycle combines procurement and warehouse updates. Supplier
deliveries, labeling, staging, and other requirements must be recorded before
staff mark the order ready for shipment.

---

## 10. Pre-presentation checklist

### Night before

- Apply the required database migrations in order.
- Load `db/seed_demo.sql`.
- Confirm customer, admin/sales, supplier, and warehouse accounts.
- Confirm the supplier login email matches the supplier record.
- Verify `.env.local` contains valid Supabase and integration credentials.
- Run a complete dry run using the same demo order.
- Run tests, lint, and the production build.
- Prepare screenshots or a screen recording as backup.

### Immediately before presenting

- Start the application.
- Open separate browser profiles or incognito windows for each role.
- Log in to every demo account.
- Reset the demo order to its expected starting state.
- Confirm the PFI builder and customer approval work.
- Confirm supplier and warehouse records are visible.
- Confirm the chatbot can answer the recommended prompts.
- Close unrelated tabs and disable notifications.
- Keep the demo order number visible in the speaker notes.

---

## 11. Backup demo if the network fails

Use prepared screenshots in this order:

1. Customer catalog and quotation request
2. Admin PFI builder
3. Customer PFI approval
4. Multi-supplier consolidation view
5. Supplier dispatch
6. Warehouse receiving and staging
7. Customer order tracker
8. Customer assistant response

Continue narrating the same one-order story. Do not jump randomly between
screens.

---

## Presenter handoff guide

| Presenter | Section | Handoff line |
|---|---|---|
| Presenter 1 | Introduction and problem | “We will now show how CAPIS addresses these issues through one connected workflow.” |
| Presenter 2 | Objectives and architecture | “With the architecture established, we can follow one order through the system.” |
| Presenter 3 | Customer and PFI demo | “Once the customer approves, DMC begins multi-supplier consolidation.” |
| Presenter 4 | Supplier and warehouse demo | “These operational updates become visible to the customer in real time.” |
| Presenter 5 | Chatbot, security, results, and closing | “This completes the order journey and demonstrates CAPIS as one integrated system.” |

Adjust presenter assignments to match the actual team.
