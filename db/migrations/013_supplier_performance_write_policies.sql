-- Migration 013 — Let staff write supplier_performance (unblocks the analytics
-- history importer). Run in the Supabase SQL editor. Safe to re-run.
--
-- APPLIED to the live database 2026-07-28. (Numbered 013 because 012 was taken
-- by 012_product_images.sql on main; this ran after it.)
--
-- Migration 005 gave supplier_performance a SELECT policy only. With RLS on and
-- no INSERT/UPDATE/DELETE policy, the "Save supplier performance" step of
-- /management/analytics/import is rejected for every role, so the import can
-- never be completed. The DELETE policy matters too: save() clears a supplier's
-- previous row before inserting the new one, and without it re-importing would
-- silently stack duplicate scorecards.
--
-- Writers are admin + management (the roles that own the analytics screen).
-- procurement keeps read-only access, as in the 005 SELECT policy.

drop policy if exists "supplier performance insert staff" on supplier_performance;
create policy "supplier performance insert staff"
on supplier_performance for insert
to authenticated
with check (has_role(array['admin'::text, 'management'::text]));

drop policy if exists "supplier performance update staff" on supplier_performance;
create policy "supplier performance update staff"
on supplier_performance for update
to authenticated
using (has_role(array['admin'::text, 'management'::text]))
with check (has_role(array['admin'::text, 'management'::text]));

drop policy if exists "supplier performance delete staff" on supplier_performance;
create policy "supplier performance delete staff"
on supplier_performance for delete
to authenticated
using (has_role(array['admin'::text, 'management'::text]));
