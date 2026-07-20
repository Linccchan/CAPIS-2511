'use client';
// S16 — Staging Tracker  (src/app/warehouse/staging/page.js)
import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { StatusBadge } from '@/components/ui/StatusBadge';
export default function StagingPage() {
    const supabase = useMemo(() => createClient(), []);
    const [orders, setOrders] = useState([]);
    const [selectedOrderId, setSelectedOrderId] = useState('');
    const [tasks, setTasks] = useState([]);
    const [labelingTasks, setLabelingTasks] = useState([]);
    const [saving, setSaving] = useState(false);
    useEffect(() => {
        async function loadOrders() {
            const { data } = await supabase.from('customer_orders')
                .select('id, order_number, status, customers(company_name)')
                .in('status', ['warehouse_preparation', 'ready_for_shipment'])
                .order('order_number');
            setOrders(data ?? []);
            if (data?.length)
                setSelectedOrderId(data[0].id);
        }
        loadOrders();
    }, [supabase]);
    useEffect(() => {
        if (!selectedOrderId)
            return;
        async function loadTasks() {
            const [{ data: st }, { data: lt }] = await Promise.all([
                supabase.from('staging_tasks')
                    .select('*, products(product_name, sku, unit), warehouse_locations(location_code), profiles(full_name)')
                    .eq('order_id', selectedOrderId),
                supabase.from('labeling_tasks')
                    .select('*, products(id, product_name)')
                    .eq('order_id', selectedOrderId),
            ]);
            setTasks(st ?? []);
            setLabelingTasks(lt ?? []);
        }
        loadTasks();
    }, [selectedOrderId, supabase]);
    async function updateStaged(id, qty, requiredQty) {
        // Staged quantity is bounded by what the order actually requires
        const clamped = Math.max(0, Math.min(Number(qty) || 0, Number(requiredQty)));
        await supabase.from('staging_tasks').update({ staged_quantity: clamped }).eq('id', id);
    }
    async function markComplete(taskId, requiredQty) {
        setSaving(true);
        await supabase.from('staging_tasks').update({
            status: 'completed',
            staged_quantity: requiredQty,
            completed_at: new Date().toISOString(),
        }).eq('id', taskId);
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'completed', staged_quantity: requiredQty } : t));
        setSaving(false);
    }
    async function markReadyToShip() {
        setSaving(true);
        await supabase.from('customer_orders').update({ status: 'ready_for_shipment' }).eq('id', selectedOrderId);
        await supabase.from('shipments').update({ status: 'ready_for_loading' }).eq('order_id', selectedOrderId);
        setOrders(prev => prev.map(o => o.id === selectedOrderId ? { ...o, status: 'ready_for_shipment' } : o));
        setSaving(false);
    }
    const selectedOrder = orders.find(o => o.id === selectedOrderId);
    const allStaged = tasks.length > 0 && tasks.every(t => t.status === 'completed');
    const allStickered = labelingTasks.every(t => t.status === 'completed');
    const stagedCount = tasks.filter(t => t.status === 'completed').length;
    function getStickerStatus(productId) {
        const lt = labelingTasks.find(l => l.product_id === productId);
        return lt?.status ?? 'pending';
    }
    return (<div style={{ maxWidth: 900 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.5px', color: 'var(--text-primary)' }}>Staging tracker</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Order:</label>
          <select className="input" style={{ width: 200 }} value={selectedOrderId} onChange={e => setSelectedOrderId(e.target.value)}>
            {orders.map(o => (<option key={o.id} value={o.id}>
                {o.order_number} — {o.customers?.company_name}
              </option>))}
          </select>
        </div>
      </div>

      {selectedOrder && (<>
          {/* Progress header */}
          <div className="card card-pad" style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                {selectedOrder.order_number} staging progress
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3 }}>
                {stagedCount}/{tasks.length} SKUs staged · {allStickered ? 'All stickers applied' : `${labelingTasks.filter(t => t.status === 'completed').length}/${labelingTasks.length} sticker tasks done`}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <StatusBadge status={selectedOrder.status}/>
              {allStaged && allStickered && selectedOrder.status === 'warehouse_preparation' && (<button onClick={markReadyToShip} disabled={saving} className="btn btn-primary">
                  Mark order as ready for shipment →
                </button>)}
            </div>
          </div>

          {/* Staging table */}
          <div className="card">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th className="table-th">Product</th>
                  <th className="table-th">Location</th>
                  <th className="table-th" style={{ textAlign: 'right' }}>Qty</th>
                  <th className="table-th" style={{ textAlign: 'center' }}>Stickers</th>
                  <th className="table-th" style={{ textAlign: 'center' }}>Staged</th>
                  <th className="table-th">Marked by</th>
                  <th className="table-th">Action</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map(t => {
                const stickerDone = getStickerStatus(t.product_id) === 'completed';
                const staged = t.status === 'completed';
                return (<tr key={t.id}>
                      <td className="table-td">
                        <div className="td-primary">{t.products?.product_name}</div>
                        <div style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--text-tertiary)' }}>{t.products?.sku}</div>
                      </td>
                      <td className="table-td">
                        <span style={{ fontFamily: 'monospace', fontSize: 11, background: 'var(--bg)', padding: '2px 6px', borderRadius: 4 }}>
                          {t.warehouse_locations?.location_code ?? '—'}
                        </span>
                      </td>
                      <td className="table-td" style={{ textAlign: 'right' }}>
                        {staged ? (<span style={{ fontWeight: 500 }}>{t.staged_quantity} {t.products?.unit}</span>) : (<input type="number" min="0" max={t.required_quantity} className="input" style={{ width: 70, textAlign: 'right' }} defaultValue={t.staged_quantity} onBlur={e => updateStaged(t.id, Number(e.target.value), t.required_quantity)}/>)}
                      </td>
                      <td className="table-td" style={{ textAlign: 'center' }}>
                        <span style={{ fontSize: 14 }}>{stickerDone ? '✓' : '○'}</span>
                      </td>
                      <td className="table-td" style={{ textAlign: 'center' }}>
                        <span style={{ fontSize: 14 }}>{staged ? '✓' : '○'}</span>
                      </td>
                      <td className="table-td">
                        {staged
                        ? <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{t.profiles?.full_name} · {t.completed_at ? new Date(t.completed_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }) : '—'}</span>
                        : '—'}
                      </td>
                      <td className="table-td">
                        {!staged && (<button onClick={() => markComplete(t.id, t.required_quantity)} disabled={saving} className="btn btn-sm btn-primary">
                            Mark staged
                          </button>)}
                      </td>
                    </tr>);
            })}
                {!tasks.length && (<tr><td colSpan={7} className="table-td" style={{ textAlign: 'center', padding: 32 }}>No staging tasks for this order</td></tr>)}
              </tbody>
            </table>
            {allStaged && allStickered && (<div style={{ padding: '12px 16px', background: '#f0fdf4', borderTop: '1px solid #bbf7d0', fontSize: 12, color: '#15803d', fontWeight: 500 }}>
                All items staged and verified. Ready for container loading.
              </div>)}
            <p className="info-note" style={{ margin: 12 }}>
              staging_tasks + labeling_tasks — all completed triggers customer_orders.status = ready_for_shipment
            </p>
          </div>
        </>)}

      {!orders.length && (<div className="card card-pad" style={{ textAlign: 'center' }}>
          <p style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>No orders currently in warehouse preparation.</p>
        </div>)}
    </div>);
}
