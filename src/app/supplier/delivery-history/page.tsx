// S22 — Delivery History  (src/app/supplier/delivery-history/page.tsx)
import { createClient } from '@/lib/supabase/server';
import { StatusBadge } from '@/components/ui/StatusBadge';

export default async function DeliveryHistoryPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: supplier } = await supabase.from('suppliers')
    .select('id, supplier_performance(*)').eq('email', user?.email).maybeSingle();

  const { data: deliveries } = await supabase
    .from('supplier_deliveries')
    .select('*, purchase_orders(po_number, expected_delivery_date, customer_orders(order_number)), supplier_delivery_items(quantity_delivered, quantity_accepted, condition_status, products(product_name))')
    .eq('supplier_id', supplier?.id)
    .order('delivery_date', { ascending: false });

  const perf = (supplier?.supplier_performance as any)?.[0];
  const onTimeCount = (deliveries ?? []).filter(d => {
    const po = d.purchase_orders as any;
    return po?.expected_delivery_date && d.delivery_date <= po.expected_delivery_date;
  }).length;
  const lateCount = (deliveries?.length ?? 0) - onTimeCount;

  // Discrepancies
  const discrepancies = (deliveries ?? []).flatMap(d =>
    (d.supplier_delivery_items as any[])
      ?.filter((i: any) => ['damaged', 'missing', 'wrong_item'].includes(i.condition_status))
      .map((i: any) => ({ po: (d.purchase_orders as any)?.po_number, date: d.delivery_date, product: i.products?.product_name, condition: i.condition_status }))
    ?? []
  );

  const partialDispatches = (deliveries ?? []).filter(d =>
    (d.supplier_delivery_items as any[])?.some((i: any) => i.quantity_delivered < i.quantity_accepted || i.quantity_accepted === 0)
  );

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.5px' }}>Delivery history</div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn btn-secondary btn-sm">Oct 2024</button>
          <button className="btn btn-secondary btn-sm">Sep 2024</button>
          <button className="btn btn-ghost btn-sm">All time</button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { val: deliveries?.length ?? 0, lbl: 'Total deliveries', sub: 'Since account creation' },
          { val: onTimeCount, lbl: 'On time', sub: `${Math.round((onTimeCount / Math.max(deliveries?.length ?? 1, 1)) * 100)}% rate` },
          { val: lateCount, lbl: 'Late', sub: `Avg +4.2 days` },
          { val: partialDispatches.length, lbl: 'Partial dispatches', sub: 'Short qty events' },
        ].map((s, i) => (
          <div key={i} className="stat-card">
            <div className="stat-val">{s.val}</div>
            <div className="stat-lbl">{s.lbl}</div>
            <div className="stat-sub">{s.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 16 }}>
        {/* Deliveries table */}
        <div className="card">
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
            All deliveries
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th className="table-th">PO #</th>
                <th className="table-th">Dispatched</th>
                <th className="table-th">WH confirmed</th>
                <th className="table-th">Items</th>
                <th className="table-th">On time?</th>
                <th className="table-th">Status</th>
              </tr>
            </thead>
            <tbody>
              {deliveries?.map(d => {
                const po = d.purchase_orders as any;
                const onTime = !po?.expected_delivery_date || d.delivery_date <= po.expected_delivery_date;
                const totalQty = (d.supplier_delivery_items as any[])?.reduce((s: number, i: any) => s + i.quantity_delivered, 0) ?? 0;
                const acceptedQty = (d.supplier_delivery_items as any[])?.reduce((s: number, i: any) => s + i.quantity_accepted, 0) ?? 0;
                return (
                  <tr key={d.id}>
                    <td className="table-td"><span className="td-primary">{po?.po_number}</span></td>
                    <td className="table-td">{d.delivery_date}{d.delivery_status === 'pending_confirmation' ? ' (logged)' : ''}</td>
                    <td className="table-td">
                      {d.delivery_status === 'received' || d.delivery_status === 'with_discrepancy'
                        ? d.delivery_date
                        : <span style={{ color: 'var(--text-tertiary)' }}>Pending</span>
                      }
                    </td>
                    <td className="table-td">{acceptedQty || totalQty} / {totalQty}</td>
                    <td className="table-td">
                      <span style={{ fontSize: 11, fontWeight: 500, color: onTime ? '#15803d' : '#dc2626' }}>
                        {onTime ? 'On time' : `Late +${Math.max(0, Math.floor((new Date(d.delivery_date).getTime() - new Date(po?.expected_delivery_date ?? d.delivery_date).getTime()) / 86400000))}d`}
                      </span>
                    </td>
                    <td className="table-td"><StatusBadge status={d.delivery_status} /></td>
                  </tr>
                );
              })}
              {!deliveries?.length && (
                <tr><td colSpan={6} className="table-td" style={{ textAlign: 'center', padding: 32 }}>No delivery history yet</td></tr>
              )}
            </tbody>
          </table>
          <p className="info-note" style={{ margin: 12 }}>
            supplier_deliveries — RLS filters to this supplier only. Confirmed = warehouse completed receipt.
          </p>
        </div>

        {/* Discrepancy log */}
        <div className="card">
          <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
            Discrepancy log
          </div>
          <div>
            {discrepancies.map((d, i) => (
              <div key={i} style={{ padding: '10px 14px', borderBottom: '1px solid var(--bg)' }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>
                  {d.po} — <span style={{ textTransform: 'capitalize' }}>{d.condition?.replace('_', ' ')}</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                  {d.product} · {d.date}
                </div>
              </div>
            ))}
            {!discrepancies.length && (
              <div style={{ padding: '16px 14px', fontSize: 11, color: 'var(--text-tertiary)' }}>No discrepancies recorded</div>
            )}
          </div>
          <p className="info-note" style={{ margin: 12, fontSize: 10 }}>
            From supplier_delivery_items.condition_status: wrong_item / damaged / missing
          </p>
        </div>
      </div>
    </div>
  );
}
