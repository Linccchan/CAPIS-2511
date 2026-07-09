// S13 — Warehouse Dashboard  (src/app/warehouse/dashboard/page.tsx)
import { createClient } from '@/lib/supabase/server';
import { StatusBadge } from '@/components/ui/StatusBadge';
import Link from 'next/link';

export default async function WarehouseDashboard() {
  const supabase = createClient();
  const today = new Date().toISOString().split('T')[0];

  const [
    { data: expectedDeliveries },
    { data: pendingConfirmations },
    { data: stickerTasks },
    { count: warehouseSkus },
    { count: stagedSkus },
  ] = await Promise.all([
    supabase.from('supplier_deliveries')
      .select('*, suppliers(supplier_name), purchase_orders(po_number, customer_orders(order_number)), purchase_order_items:purchase_orders(purchase_order_items(id))')
      .eq('delivery_date', today)
      .neq('delivery_status', 'received'),
    supabase.from('supplier_deliveries')
      .select('*, suppliers(supplier_name), purchase_orders(po_number, customer_orders(order_number))')
      .eq('delivery_status', 'pending_confirmation'),
    supabase.from('labeling_tasks')
      .select('*, products(product_name), customer_orders(order_number)')
      .in('status', ['pending', 'in_progress']),
    supabase.from('inventory_batches').select('*', { count: 'exact', head: true }).gt('quantity_available', 0),
    supabase.from('staging_tasks').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
  ]);

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.5px', color: 'var(--text-primary)' }}>Warehouse overview</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
          {new Date().toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} · {expectedDeliveries?.length ?? 0} deliveries expected today
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        <div className="stat-card"><div className="stat-val">{warehouseSkus ?? 0}</div><div className="stat-lbl">SKUs in warehouse</div><div className="stat-sub">Across active orders</div></div>
        <div className="stat-card"><div className="stat-val">{expectedDeliveries?.length ?? 0}</div><div className="stat-lbl">Expected deliveries today</div><div className="stat-sub">Pending receipt</div></div>
        <div className="stat-card"><div className="stat-val">{pendingConfirmations?.length ?? 0}</div><div className="stat-lbl">Pending confirmation</div><div className="stat-sub">Supplier dispatched, needs WH sign-off</div></div>
        <div className="stat-card"><div className="stat-val">{stagedSkus ?? 0}</div><div className="stat-lbl">SKUs staged for loading</div><div className="stat-sub">Ready for container</div></div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Expected deliveries */}
        <div className="card">
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
            Expected deliveries today
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th className="table-th">PO #</th>
                <th className="table-th">Supplier</th>
                <th className="table-th">For order</th>
                <th className="table-th">Action</th>
              </tr>
            </thead>
            <tbody>
              {expectedDeliveries?.map(d => {
                const po = d.purchase_orders as any;
                return (
                  <tr key={d.id}>
                    <td className="table-td"><span className="td-primary">{po?.po_number}</span></td>
                    <td className="table-td">{(d.suppliers as any)?.supplier_name}</td>
                    <td className="table-td">{po?.customer_orders?.order_number}</td>
                    <td className="table-td">
                      <Link href={`/warehouse/log-delivery/${po?.id}`} className="btn btn-sm btn-primary">
                        Log delivery
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {!expectedDeliveries?.length && (
                <tr><td colSpan={4} className="table-td" style={{ textAlign: 'center', padding: 24 }}>No deliveries scheduled today</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Right: sticker tasks + pending confirmations */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Sticker tasks */}
          <div className="card">
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
              Sticker tasks
            </div>
            {stickerTasks?.map(t => {
              const pct = t.required_quantity > 0 ? Math.round((t.completed_quantity / t.required_quantity) * 100) : 0;
              return (
                <div key={t.id} style={{ padding: '10px 14px', borderBottom: '1px solid var(--bg)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>
                        Apply stickers — {(t.products as any)?.product_name}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 1 }}>
                        {(t.customer_orders as any)?.order_number} · {t.required_quantity} units · {t.label_type ?? 'export label'}
                      </div>
                    </div>
                    <StatusBadge status={t.status} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, height: 4, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ height: '100%', background: 'var(--accent)', borderRadius: 99, width: `${pct}%` }} />
                    </div>
                    <span style={{ fontSize: 10, color: 'var(--text-secondary)', minWidth: 60 }}>{t.completed_quantity}/{t.required_quantity}</span>
                  </div>
                </div>
              );
            })}
            {!stickerTasks?.length && (
              <div style={{ padding: '16px 14px', fontSize: 11, color: 'var(--text-tertiary)' }}>No sticker tasks pending</div>
            )}
          </div>

          {/* Pending confirmations */}
          <div className="card">
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
              Pending confirmations
            </div>
            {pendingConfirmations?.map(d => {
              const po = d.purchase_orders as any;
              return (
                <div key={d.id} style={{ padding: '10px 14px', borderBottom: '1px solid var(--bg)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>
                      {po?.po_number} — {(d.suppliers as any)?.supplier_name}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 1 }}>
                      Supplier logged dispatch {d.delivery_date} — confirm receipt
                    </div>
                  </div>
                  <Link href={`/warehouse/log-delivery/${po?.id}`} className="btn btn-sm btn-primary">
                    Confirm now →
                  </Link>
                </div>
              );
            })}
            {!pendingConfirmations?.length && (
              <div style={{ padding: '14px', fontSize: 11, color: 'var(--text-tertiary)' }}>No pending confirmations</div>
            )}
            <p className="info-note" style={{ margin: '0 14px 12px' }}>
              supplier_deliveries with status pending_confirmation — warehouse confirms here.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
