# Sample data (synthetic)

These files are **generated, not real DMC data**. They exist so the predictive
analytics module can be demonstrated without exposing confidential business
information.

They reproduce the column layout of DMC's actual Odoo exports, and the supplier
behaviour is modelled on the proposal: 30–45 day lead times (§1.3.2), late
delivery as the norm rather than the exception, and Universal Robina as the
weakest performer the wireframes call out.

| File | Import at |
|------|-----------|
| `sample-suppliers.csv` | Admin → Suppliers → Import Suppliers |
| `sample-purchase-orders.csv` | Management → Analytics → Import History |
| `sample-receipts.csv` | Same screen, second file (adds actual arrival dates) |

Import suppliers first so the vendor names match.

**Do not commit real Odoo exports to this repository.** Real data should be
imported directly from a local file; the importers parse in the browser and
never upload the file, and only per-supplier aggregates are stored.
