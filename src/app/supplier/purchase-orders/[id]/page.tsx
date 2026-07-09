// S20 — PO Detail  (src/app/supplier/purchase-orders/[id]/page.tsx)
import { createClient } from '@/lib/supabase/server';
import { StatusBadge } from '@/components/ui/StatusBadge';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export default async function PODetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: po } = await supabase
    .from('purchase_orders')
    .select('*, suppliers(supplier_name), customer_orders(order_number, destination_country), purchase_order_items(*, products(product_name, sku, unit))')
    .eq('id', params.id).single();

  if (!po) notFound();

  const { data: deliveries } = await supabase
    .from('supplier_deliveries')
    .select('*, supplier_delivery_items(quantity_delivered, products(product_name))')
    .eq('purchase_order_id', params.id)
    .order('delivery_date', { ascending: false });

  const today = new Date().toISOString().split('T')[0];
  const overdue = po.expected_delivery_date && po.expected_delivery_date < today && po.status === 'sent';
  const items = po.purchase_order_items as any[];
  const order = po.customer_orders as any;
  const canDispatch = ['sent', 'partially_delivered'].includes(po.status);

  // Build dispatched qty map
  const dispatchedQty: Record<string, number> = {};
  deliveries?.forEach(d => {
    (d.supplier_delivery_items as any[])?.forEach((i: any) => {
      dispatchedQty[i.product_id] = (dispatchedQty[i.product_id] ?? 0) + Number(i.quantity_delivered);
    });
  });

  // Timeline events
  const timeline = [
    { label: 'PO issued', date: po.issued_date ?? '—', done: true },
    { label: 'PO viewed in portal', date: po.issued_date ?? '—', done: true },
    { label: deliveries?.length ? 'Dispatch logged' : 'Dispatch not yet logged', date: deliveries?.[0]?.delivery_date ?? `Expected ${po.expected_delivery_date ?? 'TBD'}${overdue ? ' — overdue' : ''}`, done: !!deliveries?.length, warn: !deliveries?.length && !!overdue },
  ];

  return (
    <div style={{ maxWidth: 860 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <Link href="/supplier/dashboard" className="btn btn-ghost btn-sm">← Purchase orders</Link>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.5px', color: 'var(--text-primary)' }}>{po.po_number}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3 }}>
            Issued {po.issued_date ?? '—'} · Expected {po.expected_delivery_date ?? '—'} · For Order {order?.order_number}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {overdue && <span className="badge badge-red">Overdue +{Math.floor((new Date(today).getTime() - new Date(po.expected_delivery_date!).getTime()) / 86400000)}d</span>}
          <StatusBadge status={po.status} />
          {canDispatch && (
            <Link href={`/supplier/purchase-orders/${params.id}/dispatch`} className="btn btn-primary">
              Log dispatch →
            </Link>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 16 }}>
        {/* Items table */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
              Items ordered
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th className="table-th">Product</th>
                  <th className="table-th">SKU</th>
                  <th className="table-th" style={{ textAlign: 'right' }}>Qty ordered</th>
                  <th className="table-th" style={{ textAlign: 'right' }}>Qty dispatched</th>
                  <th className="table-th">Unit</th>
                </tr>
              </thead>
              <tbody>
                {items?.map(item => (
                  <tr key={item.id}>
                    <td className="table-td"><span className="td-primary">{item.products?.product_name}</span></td>
                    <td className="table-td" style={{ fontFamily: 'monospace', fontSize: 11 }}>{item.products?.sku ?? '—'}</td>
                    <td className="table-td" style={{ textAlign: 'right' }}>{item.quantity_ordered}</td>
                    <td className="table-td" style={{ textAlign: 'right' }}>
                      {dispatchedQty[item.product_id] ?? <span style={{ color: 'var(--text-tertiary)' }}>—</span>}
                    </td>
                    <td className="table-td">{item.products?.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="info-note" style={{ margin: 12 }}>
              Read-only from purchase_order_items. Qty dispatched populates after supplier logs dispatch.
            </p>
          </div>

          {/* Timeline */}
          <div className="card card-pad">
            <div className="section-label">PO timeline</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
              {timeline.map((t, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', background: t.done ? 'var(--accent)' : 'var(--bg)', border: '1px solid var(--border)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: t.done ? '#fff' : 'var(--text-tertiary)', marginTop: 1 }}>
                    {t.done ? '✓' : i + 1}
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: t.warn ? '#dc2626' : 'var(--text-primary)' }}>{t.label}</div>
                    <div style={{ fontSize: 11, color: t.warn ? '#dc2626' : 'var(--text-tertiary)' }}>{t.date}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* PO Summary */}
        <div className="card card-pad" style={{ height: 'fit-content' }}>
          <div className="section-label">PO summary</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {[
              ['PO number', po.po_number],
              ['Order ref', order?.order_number ?? '—'],
              ['Destination', order?.destination_country ?? '—'],
              ['Issued', po.issued_date ?? '—'],
              ['Expected', po.expected_delivery_date ?? '—'],
              ['Total SKUs', items?.length ?? 0],
              ['Total qty', items?.reduce((s: number, i: any) => s + i.quantity_ordered, 0) ?? 0],
            ].map(([l, v]) => (
              <div key={l as string} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--bg)', fontSize: 12 }}>
                <span style={{ color: 'var(--text-secondary)' }}>{l}</span>
                <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{v}</span>
              </div>
            ))}
          </div>
          <p className="info-note" style={{ marginTop: 12, fontSize: 10 }}>
            Destination shown so supplier understands shipment urgency.
          </p>
          {canDispatch && (
            <Link href={`/supplier/purchase-orders/${params.id}/dispatch`} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 14 }}>
              Log dispatch →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
