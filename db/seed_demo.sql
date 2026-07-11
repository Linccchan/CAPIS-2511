-- Demo seed — staged data for the end-to-end scenario presentation
-- Run AFTER migrations 005 + 007. Idempotent-ish: skips rows that already
-- exist (matched by number/name). Uses your existing customer + products.
--
-- Creates:
--   * 3 real DMC-style suppliers
--   * ORDER B (QT-2026-910): submitted, awaiting the PFI  -> PFI-builder demo
--   * ORDER C (ORD-2026-911): procurement_started with 2 POs (one partially
--     delivered) -> admin consolidation + supplier + warehouse receiving demo
--   * ORDER D (ORD-2026-912): warehouse_preparation with labeling/staging
--     tasks + billing -> stickers/staging + customer tracker demo

-- Suppliers ------------------------------------------------------------------
insert into suppliers (supplier_name, supplier_type, email)
select v.name, v.stype, v.email
from (values
  ('Universal Robina Corp.', 'manufacturer', 'supplier@test.com'),
  ('Monde Nissin Corp.',     'manufacturer', 'mondenissin@example.com'),
  ('M.Y. San Corp.',         'manufacturer', 'mysan@example.com')
) as v(name, stype, email)
where not exists (select 1 from suppliers s where s.supplier_name = v.name);

-- ORDER B: submitted, no PFI yet ---------------------------------------------
insert into customer_orders (customer_id, order_number, quotation_number, destination_country, status, order_date)
select id, 'QT-2026-910', 'QT-2026-910', coalesce(country, 'Hong Kong'), 'submitted', current_date - 2
from customers
where not exists (select 1 from customer_orders where order_number = 'QT-2026-910')
limit 1;

insert into customer_order_items (order_id, product_id, quantity_ordered)
select o.id, p.id, 24
from customer_orders o
cross join lateral (select id from products where is_available limit 2) p
where o.order_number = 'QT-2026-910'
  and not exists (select 1 from customer_order_items i where i.order_id = o.id);

-- ORDER C: procurement, two POs, one partially delivered ----------------------
insert into customer_orders (customer_id, order_number, quotation_number, destination_country, status, order_date, confirmed_at, estimated_ready_date)
select id, 'ORD-2026-911', 'QT-2026-911', coalesce(country, 'Hong Kong'), 'partially_received', current_date - 20, now() - interval '18 days', current_date + 15
from customers
where not exists (select 1 from customer_orders where order_number = 'ORD-2026-911')
limit 1;

insert into customer_order_items (order_id, product_id, quantity_ordered, unit_price)
select o.id, p.id, 36, 11.50
from customer_orders o
cross join lateral (select id from products where is_available limit 2) p
where o.order_number = 'ORD-2026-911'
  and not exists (select 1 from customer_order_items i where i.order_id = o.id);

insert into purchase_orders (order_id, supplier_id, po_number, status, issued_date, expected_delivery_date)
select o.id, s.id, 'PO-2026-901', 'partially_delivered', current_date - 16, current_date - 2
from customer_orders o, suppliers s
where o.order_number = 'ORD-2026-911' and s.supplier_name = 'Universal Robina Corp.'
  and not exists (select 1 from purchase_orders where po_number = 'PO-2026-901');

insert into purchase_orders (order_id, supplier_id, po_number, status, issued_date, expected_delivery_date)
select o.id, s.id, 'PO-2026-902', 'sent', current_date - 16, current_date + 5
from customer_orders o, suppliers s
where o.order_number = 'ORD-2026-911' and s.supplier_name = 'Monde Nissin Corp.'
  and not exists (select 1 from purchase_orders where po_number = 'PO-2026-902');

insert into purchase_order_items (purchase_order_id, product_id, quantity_ordered, quantity_received)
select po.id, p.id, 36, case when po.po_number = 'PO-2026-901' then 20 else 0 end
from purchase_orders po
cross join lateral (select id from products where is_available limit 1) p
where po.po_number in ('PO-2026-901', 'PO-2026-902')
  and not exists (select 1 from purchase_order_items i where i.purchase_order_id = po.id);

-- ORDER D: warehouse preparation with tasks + billing --------------------------
insert into customer_orders (customer_id, order_number, quotation_number, destination_country, status, order_date, confirmed_at, estimated_ready_date)
select id, 'ORD-2026-912', 'QT-2026-912', coalesce(country, 'Hong Kong'), 'warehouse_preparation', current_date - 35, now() - interval '33 days', current_date + 5
from customers
where not exists (select 1 from customer_orders where order_number = 'ORD-2026-912')
limit 1;

insert into customer_order_items (order_id, product_id, quantity_ordered, unit_price)
select o.id, p.id, 48, 10.80
from customer_orders o
cross join lateral (select id from products where is_available limit 2) p
where o.order_number = 'ORD-2026-912'
  and not exists (select 1 from customer_order_items i where i.order_id = o.id);

insert into billings (order_id, billing_number, shipping_amount, total_amount, down_payment_required, balance_amount, valid_until)
select id, 'PFI-2026-912', 220, 1256.80, 628.40, 628.40, current_date - 20
from customer_orders where order_number = 'ORD-2026-912'
  and not exists (select 1 from billings b where b.billing_number = 'PFI-2026-912');

insert into labeling_tasks (order_id, product_id, label_type, required_quantity, completed_quantity, status, started_at)
select o.id, i.product_id, 'HK nutrition label', i.quantity_ordered * 12, (i.quantity_ordered * 12) / 2, 'in_progress', now() - interval '4 days'
from customer_orders o
join customer_order_items i on i.order_id = o.id
where o.order_number = 'ORD-2026-912'
  and not exists (select 1 from labeling_tasks t where t.order_id = o.id);

insert into staging_tasks (order_id, product_id, required_quantity, staged_quantity, status)
select o.id, i.product_id, i.quantity_ordered, i.quantity_ordered / 2, 'in_progress'
from customer_orders o
join customer_order_items i on i.order_id = o.id
where o.order_number = 'ORD-2026-912'
  and not exists (select 1 from staging_tasks t where t.order_id = o.id);

-- Warehouse rack locations -----------------------------------------------------
insert into warehouse_locations (location_code, description)
select v.code, v.descr
from (values ('A-01-01', 'Zone A rack 1'), ('A-01-02', 'Zone A rack 1'),
             ('A-02-01', 'Zone A rack 2'), ('B-01-01', 'Zone B rack 1')) as v(code, descr)
where not exists (select 1 from warehouse_locations w where w.location_code = v.code);
