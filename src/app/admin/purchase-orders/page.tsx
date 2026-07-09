// S08 — Purchase Orders  (src/app/admin/purchase-orders/page.tsx)
import { createClient } from '@/lib/supabase/server';
import { StatusBadge } from '@/components/ui/StatusBadge';

export default async function PurchaseOrdersPage({ searchParams }: { searchParams: { tab?: string } }) {
  const supabase = createClient();
  const today = new Date().toISOString().split('T')[0];
  const tab = searchParams.tab ?? 'All';

  const { data: pos } = await supabase.from('purchase_orders')
    .select('*, suppliers(supplier_name), customer_orders(order_number)')
    .not('status', 'in', '(cancelled)')
    .order('created_at', { ascending: false });

  const overdue = (pos ?? []).filter(p => p.status === 'sent' && p.expected_delivery_date && p.expected_delivery_date < today);
  const sent = (pos ?? []).filter(p => p.status === 'sent' && !(p.expected_delivery_date && p.expected_delivery_date < today));
  const partial = (pos ?? []).filter(p => p.status === 'partially_delivered');
  const delivered = (pos ?? []).filter(p => p.status === 'delivered');

  const tabMap: Record<string, any[]> = {
    'All': pos ?? [],
    'Overdue': overdue,
    'Sent': sent,
    'Partially delivered': partial,
    'Delivered': delivered,
  };

  const displayed = tabMap[tab] ?? pos ?? [];

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.5px', color: 'var(--text-primary)' }}>Purchase orders</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input type="text" className="input" placeholder="Search POs…" style={{ width: 180 }} />
          <button className="btn btn-primary">+ Create PO</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {['All', 'Overdue', 'Sent', 'Partially delivered', 'Delivered'].map(t => {
          const count = tabMap[t]?.length ?? 0;
          return (
            <a key={t} href={`?tab=${encodeURIComponent(t)}`}
              style={{ padding: '7px 12px', fontSize: 12, fontWeight: tab === t ? 500 : 400, color: tab === t ? 'var(--text-primary)' : 'var(--text-tertiary)', borderBottom: tab === t ? '2px solid var(--text-primary)' : '2px solid transparent', textDecoration: 'none', whiteSpace: 'nowrap', marginBottom: -1 }}>
              {t} {count > 0 && `(${count})`}
            </a>
          );
        })}
      </div>

      <div className="card">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th className="table-th">PO #</th>
              <th className="table-th">Order</th>
              <th className="table-th">Supplier</th>
              <th className="table-th">Issued</th>
              <th className="table-th">Expected</th>
              <th className="table-th">Actual delivery</th>
              <th className="table-th">Status</th>
            </tr>
          </thead>
          <tbody>
            {displayed.map(po => {
              const isOverdue = po.status === 'sent' && po.expected_delivery_date && po.expected_delivery_date < today;
              return (
                <tr key={po.id} style={{ background: isOverdue ? '#fef2f2' : undefined }}>
                  <td className="table-td"><span className="td-primary">{po.po_number}</span></td>
                  <td className="table-td">{(po.customer_orders as any)?.order_number}</td>
                  <td className="table-td">{(po.suppliers as any)?.supplier_name}</td>
                  <td className="table-td">{po.issued_date ?? '—'}</td>
                  <td className="table-td">
                    <span style={{ color: isOverdue ? '#dc2626' : undefined, fontWeight: isOverdue ? 500 : undefined }}>
                      {po.expected_delivery_date ?? '—'}
                      {isOverdue && ` ⚠ Overdue +${Math.floor((new Date(today).getTime() - new Date(po.expected_delivery_date!).getTime()) / 86400000)}d`}
                    </span>
                  </td>
                  <td className="table-td">{po.actual_completed_date ?? '—'}</td>
                  <td className="table-td">
                    {isOverdue
                      ? <span className="badge badge-red">Overdue</span>
                      : <StatusBadge status={po.status} />
                    }
                  </td>
                </tr>
              );
            })}
            {!displayed.length && (
              <tr><td colSpan={7} className="table-td" style={{ textAlign: 'center', padding: 32 }}>No purchase orders</td></tr>
            )}
          </tbody>
        </table>
        <p className="info-note" style={{ margin: 12 }}>
          Overdue is derived: status = sent AND expected_delivery_date &lt; today.
        </p>
      </div>
    </div>
  );
}
