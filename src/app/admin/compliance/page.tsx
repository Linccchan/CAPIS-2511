// S10 — Compliance & Stickers  (src/app/admin/compliance/page.tsx)
'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { StatusBadge } from '@/components/ui/StatusBadge';

export default function CompliancePage() {
  const supabase = createClient();
  const [designs, setDesigns] = useState<any[]>([]);
  const [labelingTasks, setLabelingTasks] = useState<any[]>([]);
  const [filterOrder, setFilterOrder] = useState('');
  const [orders, setOrders] = useState<any[]>([]);
  const [updating, setUpdating] = useState<string | null>(null);

  async function load() {
    const [{ data: d }, { data: lt }, { data: o }] = await Promise.all([
      supabase.from('sticker_designs')
        .select('*, products(product_name, sku), customer_orders(order_number, destination_country)')
        .order('created_at', { ascending: false }),
      supabase.from('labeling_tasks')
        .select('*, products(product_name), customer_orders(order_number), profiles(full_name)')
        .order('created_at', { ascending: false }),
      supabase.from('customer_orders').select('id, order_number').not('status', 'in', '(completed,cancelled)'),
    ]);
    setDesigns(d ?? []);
    setLabelingTasks(lt ?? []);
    setOrders(o ?? []);
  }
  useEffect(() => { load(); }, []);

  async function advanceDesign(id: string, currentStatus: string) {
    const next: Record<string, string> = {
      photo_sent: 'awaiting_customer',
      awaiting_customer: 'design_received',
      design_received: 'printed',
    };
    if (!next[currentStatus]) return;
    setUpdating(id);
    await supabase.from('sticker_designs').update({ status: next[currentStatus] }).eq('id', id);
    await load();
    setUpdating(null);
  }

  const totalLabels = labelingTasks.reduce((s, t) => s + t.required_quantity, 0);
  const completedLabels = labelingTasks.reduce((s, t) => s + t.completed_quantity, 0);

  const filteredDesigns = filterOrder ? designs.filter(d => (d.customer_orders as any)?.order_number === filterOrder) : designs;
  const filteredLabeling = filterOrder ? labelingTasks.filter(t => (t.customer_orders as any)?.order_number === filterOrder) : labelingTasks;

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.5px', color: 'var(--text-primary)' }}>Compliance & sticker tracking</div>
        <select className="input" style={{ width: 200 }} value={filterOrder} onChange={e => setFilterOrder(e.target.value)}>
          <option value="">Filter by order…</option>
          {orders.map(o => <option key={o.id} value={o.order_number}>{o.order_number}</option>)}
        </select>
      </div>

      {/* Sticker designs */}
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10 }}>Sticker designs</div>
      <div className="card" style={{ marginBottom: 20 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th className="table-th">Order</th>
              <th className="table-th">Product</th>
              <th className="table-th">Destination</th>
              <th className="table-th">Design file</th>
              <th className="table-th">Status</th>
              <th className="table-th">Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredDesigns.map(d => {
              const order = d.customer_orders as any;
              return (
                <tr key={d.id}>
                  <td className="table-td"><span className="td-primary">{order?.order_number}</span></td>
                  <td className="table-td">{(d.products as any)?.product_name}</td>
                  <td className="table-td">{order?.destination_country ?? '—'}</td>
                  <td className="table-td">
                    {d.file_path
                      ? <a href={d.file_path} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', textDecoration: 'underline', fontSize: 11 }}>
                          {d.file_path.split('/').pop()}
                        </a>
                      : <span style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>—</span>
                    }
                  </td>
                  <td className="table-td"><StatusBadge status={d.status} /></td>
                  <td className="table-td">
                    {d.status !== 'printed' && (
                      <button onClick={() => advanceDesign(d.id, d.status)} disabled={updating === d.id}
                        className="btn btn-sm btn-ghost">
                        {d.status === 'photo_sent' ? 'Mark awaiting customer' :
                         d.status === 'awaiting_customer' ? 'Design received' :
                         d.status === 'design_received' ? 'Mark printed' : '—'}
                      </button>
                    )}
                    {d.status === 'awaiting_customer' && (
                      <button className="btn btn-sm btn-secondary" style={{ marginLeft: 6 }}>Resend photos</button>
                    )}
                  </td>
                </tr>
              );
            })}
            {!filteredDesigns.length && (
              <tr><td colSpan={6} className="table-td" style={{ textAlign: 'center', padding: 32 }}>No sticker designs</td></tr>
            )}
          </tbody>
        </table>
        <p className="info-note" style={{ margin: 12 }}>
          sticker_designs — status: photo_sent / awaiting_customer / design_received / printed. Marking printed auto-creates labeling_task.
        </p>
      </div>

      {/* Labeling tasks */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Labeling tasks</div>
        {totalLabels > 0 && (
          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
            Overall: {completedLabels.toLocaleString()} / {totalLabels.toLocaleString()} labels applied ({Math.round((completedLabels / totalLabels) * 100)}%)
          </div>
        )}
      </div>
      <div className="card">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th className="table-th">Order</th>
              <th className="table-th">Product</th>
              <th className="table-th">Label type</th>
              <th className="table-th" style={{ textAlign: 'right' }}>Required</th>
              <th className="table-th" style={{ textAlign: 'right' }}>Completed</th>
              <th className="table-th">Assigned to</th>
              <th className="table-th">Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredLabeling.map(t => (
              <tr key={t.id}>
                <td className="table-td"><span className="td-primary">{(t.customer_orders as any)?.order_number}</span></td>
                <td className="table-td">{(t.products as any)?.product_name}</td>
                <td className="table-td">{t.label_type ?? '—'}</td>
                <td className="table-td" style={{ textAlign: 'right' }}>{t.required_quantity.toLocaleString()}</td>
                <td className="table-td" style={{ textAlign: 'right' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                    <div style={{ width: 60, height: 4, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ height: '100%', background: 'var(--accent)', borderRadius: 99, width: `${t.required_quantity > 0 ? Math.round((t.completed_quantity / t.required_quantity) * 100) : 0}%` }} />
                    </div>
                    <span>{t.completed_quantity.toLocaleString()}</span>
                  </div>
                </td>
                <td className="table-td">{(t.profiles as any)?.full_name ?? <span style={{ color: 'var(--text-tertiary)' }}>Unassigned</span>}</td>
                <td className="table-td"><StatusBadge status={t.status} /></td>
              </tr>
            ))}
            {!filteredLabeling.length && (
              <tr><td colSpan={7} className="table-td" style={{ textAlign: 'center', padding: 32 }}>No labeling tasks</td></tr>
            )}
          </tbody>
        </table>
        <p className="info-note" style={{ margin: 12 }}>
          labeling_tasks — status: pending / in_progress / completed · required vs completed quantity per product.
        </p>
      </div>
    </div>
  );
}
