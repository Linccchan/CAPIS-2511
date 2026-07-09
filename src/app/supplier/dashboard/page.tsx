// S19 — Supplier Dashboard  (src/app/supplier/dashboard/page.tsx)
import { createClient } from '@/lib/supabase/server';
import { StatusBadge } from '@/components/ui/StatusBadge';
import Link from 'next/link';

export default async function SupplierDashboard() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: supplier } = await supabase.from('suppliers')
    .select('id, supplier_name, supplier_performance(*)')
    .eq('email', user?.email)
    .maybeSingle();

  if (!supplier) {
    return (
      <div className="card card-pad" style={{ maxWidth: 480 }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
          Your supplier account is not linked. Contact your administrator.
        </p>
      </div>
    );
  }

  const perf = (supplier.supplier_performance as any)?.[0];
  const today = new Date().toISOString().split('T')[0];

  const [{ data: openPOs }, { data: notifications }] = await Promise.all([
    supabase.from('purchase_orders')
      .select('*, customer_orders(order_number, destination_country), purchase_order_items(id)')
      .eq('supplier_id', supplier.id)
      .in('status', ['sent', 'partially_delivered'])
      .order('expected_delivery_date'),
    supabase.from('notifications')
      .select('*').eq('user_id', user!.id).eq('is_read', false)
      .order('created_at', { ascending: false }).limit(5),
  ]);

  const overdueCount = (openPOs ?? []).filter(po =>
    po.expected_delivery_date && po.expected_delivery_date < today
  ).length;

  const onTimeRate = perf
    ? Math.round(((perf.total_purchase_orders - perf.late_delivery_count) / Math.max(perf.total_purchase_orders, 1)) * 100)
    : null;

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.5px', color: 'var(--text-primary)' }}>
          Welcome, {supplier.supplier_name}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
          View your open purchase orders, log dispatches, and track your performance.
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { val: openPOs?.length ?? 0, lbl: 'Open purchase orders', sub: overdueCount > 0 ? `${overdueCount} overdue` : 'None overdue' },
          { val: perf?.late_delivery_count != null ? `${perf.total_purchase_orders - perf.late_delivery_count}` : '—', lbl: 'Pending confirmation', sub: 'Awaiting warehouse receipt' },
          { val: onTimeRate != null ? `${onTimeRate}%` : '—', lbl: 'On-time delivery rate', sub: 'Benchmark: 80%' },
          { val: perf?.average_lead_time_days ? `${Math.round(perf.average_lead_time_days)}d` : '—', lbl: 'Avg lead time', sub: 'Target: 30d' },
        ].map((s, i) => (
          <div key={i} className="stat-card">
            <div className="stat-val">{s.val}</div>
            <div className="stat-lbl">{s.lbl}</div>
            <div className="stat-sub">{s.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 16 }}>
        {/* Open POs */}
        <div className="card">
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Open purchase orders</span>
            <Link href="/supplier/purchase-orders" className="btn btn-sm btn-secondary">View all</Link>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th className="table-th">PO #</th>
                <th className="table-th">For order</th>
                <th className="table-th">Items</th>
                <th className="table-th">Issued</th>
                <th className="table-th">Expected</th>
                <th className="table-th">Status</th>
                <th className="table-th"></th>
              </tr>
            </thead>
            <tbody>
              {openPOs?.map(po => {
                const overdue = po.expected_delivery_date && po.expected_delivery_date < today;
                const order = po.customer_orders as any;
                return (
                  <tr key={po.id}>
                    <td className="table-td"><span className="td-primary">{po.po_number}</span></td>
                    <td className="table-td">{order?.order_number}</td>
                    <td className="table-td">{(po.purchase_order_items as any[])?.length ?? 0} SKUs</td>
                    <td className="table-td">{po.issued_date ?? '—'}</td>
                    <td className="table-td">
                      <span style={{ color: overdue ? '#dc2626' : 'inherit', fontWeight: overdue ? 500 : 400 }}>
                        {po.expected_delivery_date ?? '—'}
                        {overdue && ' ⚠'}
                      </span>
                    </td>
                    <td className="table-td">
                      {overdue
                        ? <span className="badge badge-red">Overdue</span>
                        : <StatusBadge status={po.status} />
                      }
                    </td>
                    <td className="table-td">
                      <div style={{ display: 'flex', gap: 6 }}>
                        <Link href={`/supplier/purchase-orders/${po.id}/dispatch`} className="btn btn-sm btn-primary">
                          Log dispatch
                        </Link>
                        <Link href={`/supplier/purchase-orders/${po.id}`} className="btn btn-sm btn-ghost">
                          View
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!openPOs?.length && (
                <tr><td colSpan={7} className="table-td" style={{ textAlign: 'center', padding: 32 }}>No open purchase orders</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Right panel: Notifications + Performance */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="card">
            <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
              Notifications
            </div>
            <div>
              {notifications?.map(n => (
                <div key={n.id} style={{ padding: '10px 14px', borderBottom: '1px solid var(--bg)', fontSize: 11 }}>
                  <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{n.title}</div>
                  {n.message && <div style={{ color: 'var(--text-tertiary)', marginTop: 2 }}>{n.message}</div>}
                </div>
              ))}
              {!notifications?.length && (
                <div style={{ padding: '16px 14px', fontSize: 11, color: 'var(--text-tertiary)' }}>No new notifications</div>
              )}
            </div>
          </div>

          {perf && (
            <div className="card card-pad">
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10 }}>My performance</div>
              {[
                ['On-time rate', `${onTimeRate}%`],
                ['Avg lead time', `${Math.round(perf.average_lead_time_days ?? 0)} days`],
                ['Total POs', perf.total_purchase_orders],
                ['Late', perf.late_delivery_count],
              ].map(([l, v]) => (
                <div key={l as string} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '4px 0', borderBottom: '1px solid var(--bg)' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{l}</span>
                  <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{v}</span>
                </div>
              ))}
              <p className="info-note" style={{ marginTop: 10 }}>
                Read from supplier_performance — computed after every confirmed delivery.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
