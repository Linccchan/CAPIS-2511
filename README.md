# CAPIS-2511 — Export Consolidation System for DMC Enterprise

Capstone project (BS IS / BS IT, De La Salle University – Manila): a custom
export consolidation information system with predictive analytics for DMC
Enterprise, a Philippine FMCG export consolidator. The system extends DMC's
existing Odoo ERP with customer self-service ordering, multi-supplier order
consolidation monitoring, warehouse staging and labeling tracking, billing and
payment verification, and shipment-readiness prediction.

## Stack

- **Frontend:** Next.js (App Router, JavaScript) + React, TailwindCSS
- **Backend / DB:** Supabase (PostgreSQL, Auth, Row-Level Security)
- **Analytics:** TensorFlow.js (on-device predictions)
- **Hosting:** Vercel
- **ERP integration:** Odoo via JSON-RPC (accounting/billing sync)

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Requires a `.env.local`
with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

## Database

The schema-of-record lives in [`db/schema.sql`](db/schema.sql) with reference
documentation in [`db/SCHEMA.md`](db/SCHEMA.md). Incremental changes are in
[`db/migrations/`](db/migrations) and are applied manually through the
Supabase SQL editor.

## Modules

1. **Customer Interaction** — catalog, quotation requests, PFI review and
   approval, order tracking, documents (complete)
2. **Order Management** — staff quotation/PFI builder, purchase orders,
   multi-supplier consolidation monitoring
3. **Supplier & Warehouse Management** — deliveries, storage locations,
   labeling and staging
4. **Predictive Analytics** — shipment-readiness estimates, supplier
   reliability scoring
5. **Billing & Payment** — billing records, telegraphic-transfer verification,
   Odoo sync
