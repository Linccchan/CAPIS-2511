'use client';
// S21 — Log Dispatch  (src/app/supplier/purchase-orders/[id]/dispatch/page.js)
import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
export default function LogDispatchPage() {
    const params = useParams();
    const router = useRouter();
    const supabase = useMemo(() => createClient(), []);
    const [po, setPO] = useState(null);
    const [items, setItems] = useState([]);
    const [dispatchDate, setDispatchDate] = useState(new Date().toISOString().split('T')[0]);
    const [courierPlate, setCourierPlate] = useState('');
    const [driverName, setDriverName] = useState('');
    const [drFile, setDrFile] = useState(null);
    const [remarks, setRemarks] = useState('');
    const [saving, setSaving] = useState(false);
    useEffect(() => {
        async function load() {
            const { data } = await supabase.from('purchase_orders')
                .select('*, suppliers(*), customer_orders(order_number, destination_country), purchase_order_items(*, products(product_name, sku, unit))')
                .eq('id', params.id).single();
            setPO(data);
            setItems((data?.purchase_order_items ?? []).map((i) => ({
                ...i,
                dispatch_qty: String(i.quantity_ordered - i.quantity_received),
                partial_reason: '',
                fulfilled: true,
            })));
        }
        load();
    }, [params.id, supabase]);
    function updateItem(id, field, value) {
        setItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));
    }
    const hasPartial = items.some(i => i.fulfilled && Number(i.dispatch_qty) < (i.quantity_ordered - i.quantity_received));
    const unfulfilled = items.filter(i => !i.fulfilled);
    async function handleSubmit() {
        setSaving(true);
        const { data: { user } } = await supabase.auth.getUser();
        let drPath = '';
        if (drFile) {
            const { data } = await supabase.storage
                .from('export-documents')
                .upload(`deliveries/dr-${params.id}-${Date.now()}.${drFile.name.split('.').pop()}`, drFile);
            drPath = data?.path ?? '';
        }
        const { data: delivery, error } = await supabase.from('supplier_deliveries').insert({
            purchase_order_id: params.id,
            supplier_id: po.supplier_id,
            delivery_date: dispatchDate,
            delivery_status: 'pending_confirmation',
            remarks: `Courier/Truck: ${courierPlate} | Driver: ${driverName}${remarks ? ' | ' + remarks : ''}`,
        }).select().single();
        if (error || !delivery) {
            setSaving(false);
            return;
        }
        for (const item of items) {
            if (!item.fulfilled)
                continue;
            // Cannot dispatch more than the undelivered remainder of the PO line
            const remaining = Number(item.quantity_ordered) - Number(item.quantity_received);
            const qty = Math.min(Number(item.dispatch_qty), remaining);
            if (qty <= 0)
                continue;
            await supabase.from('supplier_delivery_items').insert({
                delivery_id: delivery.id,
                product_id: item.product_id,
                quantity_delivered: qty,
                quantity_accepted: 0,
                condition_status: 'good',
                remarks: item.partial_reason || null,
            });
        }
        // Notify admin + warehouse
        const { data: staff } = await supabase.from('profiles').select('id').in('role', ['admin', 'warehouse']);
        for (const s of staff ?? []) {
            await supabase.from('notifications').insert({
                user_id: s.id,
                order_id: po.order_id,
                type: 'dispatch_logged',
                title: `Dispatch logged: ${po.po_number}`,
                message: `${po.suppliers?.supplier_name} dispatched goods via ${courierPlate || 'unknown courier'}. Awaiting warehouse confirmation.`,
            });
        }
        router.push('/supplier/dashboard');
    }
    if (!po)
        return <div style={{ padding: 24, color: 'var(--text-tertiary)' }}>Loading…</div>;
    const order = po.customer_orders;
    const fulfilledItems = items.filter(i => i.fulfilled);
    const isPartial = fulfilledItems.some(i => Number(i.dispatch_qty) < (i.quantity_ordered - i.quantity_received));
    return (<div style={{ maxWidth: 860 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <Link href={`/supplier/purchase-orders/${params.id}`} className="btn btn-ghost btn-sm">← {po.po_number}</Link>
      </div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.5px', color: 'var(--text-primary)' }}>Log dispatch</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
          {po.po_number} · {po.suppliers?.supplier_name} · For {order?.order_number}
        </div>
      </div>

      {/* Flow explainer */}
      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
          {[
            { label: 'PO issued', done: true },
            { label: 'You log dispatch', done: false, active: true },
            { label: 'Warehouse confirms', done: false },
            { label: 'PO marked delivered', done: false },
        ].map((step, i, arr) => (<div key={i} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 22, height: 22, borderRadius: '50%', background: step.done ? 'var(--accent)' : step.active ? '#fff' : 'var(--bg)', border: `1.5px solid ${step.done || step.active ? 'var(--accent)' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600, color: step.done ? '#fff' : step.active ? 'var(--accent)' : 'var(--text-tertiary)' }}>
                  {step.done ? '✓' : i + 1}
                </div>
                <div style={{ fontSize: 10, color: step.active ? 'var(--text-primary)' : 'var(--text-tertiary)', fontWeight: step.active ? 500 : 400, textAlign: 'center', whiteSpace: 'nowrap' }}>
                  {step.label}
                </div>
              </div>
              {i < arr.length - 1 && <div style={{ flex: 1, height: 1, background: step.done ? 'var(--accent)' : 'var(--border)', margin: '0 6px', marginBottom: 16 }}/>}
            </div>))}
        </div>
        <p className="info-note" style={{ marginTop: 12 }}>
          Supplier logs dispatch → creates supplier_deliveries (pending_confirmation). Warehouse confirms in receipt screen. PO advances to delivered only after warehouse sign-off.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Quantities */}
          <div className="card">
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
              Quantities dispatching
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th className="table-th">Product</th>
                  <th className="table-th" style={{ textAlign: 'right' }}>Ordered</th>
                  <th className="table-th" style={{ textAlign: 'right' }}>Dispatching qty</th>
                  <th className="table-th">Reason if partial</th>
                  <th className="table-th">Can fulfill?</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => {
            const remaining = item.quantity_ordered - item.quantity_received;
            return (<tr key={item.id}>
                      <td className="table-td"><span className="td-primary">{item.products?.product_name}</span><div style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--text-tertiary)' }}>{item.products?.sku}</div></td>
                      <td className="table-td" style={{ textAlign: 'right' }}>{remaining} {item.products?.unit}</td>
                      <td className="table-td" style={{ textAlign: 'right' }}>
                        {item.fulfilled && (<input type="number" min="0" max={remaining} className="input" style={{ width: 80, textAlign: 'right' }} value={item.dispatch_qty} onChange={e => updateItem(item.id, 'dispatch_qty', e.target.value)}/>)}
                      </td>
                      <td className="table-td">
                        {item.fulfilled && Number(item.dispatch_qty) < remaining && (<input type="text" className="input" placeholder="Short supply reason…" value={item.partial_reason} onChange={e => updateItem(item.id, 'partial_reason', e.target.value)}/>)}
                      </td>
                      <td className="table-td">
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                          <input type="checkbox" checked={item.fulfilled} onChange={e => updateItem(item.id, 'fulfilled', e.target.checked)}/>
                          <span style={{ fontSize: 11 }}>Yes</span>
                        </label>
                      </td>
                    </tr>);
        })}
              </tbody>
            </table>
            <p className="info-note" style={{ margin: 12 }}>
              Partial dispatch sets PO to partially_delivered and notifies admin.
            </p>
          </div>

          {/* Dispatch details */}
          <div className="card card-pad">
            <div className="section-label" style={{ marginBottom: 14 }}>Dispatch details</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label className="section-label">Dispatch date</label>
                <input type="date" className="input" value={dispatchDate} onChange={e => setDispatchDate(e.target.value)}/>
              </div>
              <div>
                <label className="section-label">Courier / truck plate</label>
                <input type="text" className="input" placeholder="e.g. ABC-1234" value={courierPlate} onChange={e => setCourierPlate(e.target.value)}/>
              </div>
              <div>
                <label className="section-label">Driver name</label>
                <input type="text" className="input" placeholder="Full name" value={driverName} onChange={e => setDriverName(e.target.value)}/>
              </div>
              <div>
                <label className="section-label">Delivery receipt / waybill</label>
                <div style={{ border: '1px dashed var(--border)', borderRadius: 'var(--radius)', padding: '10px 12px', background: 'var(--bg)', fontSize: 11, color: 'var(--text-tertiary)' }}>
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => setDrFile(e.target.files?.[0] ?? null)} style={{ display: 'block', fontSize: 11, width: '100%' }}/>
                  {!drFile && <div style={{ marginTop: 4 }}>Drop DR / waybill here or click to upload (PDF, JPG, PNG)</div>}
                </div>
              </div>
            </div>
            <div>
              <label className="section-label">Remarks</label>
              <textarea className="input" rows={3} placeholder="Any notes about this dispatch…" value={remarks} onChange={e => setRemarks(e.target.value)}/>
            </div>
          </div>
        </div>

        {/* Dispatch summary */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="card card-pad">
            <div className="section-label" style={{ marginBottom: 10 }}>Dispatch summary</div>
            <div style={{ fontSize: 11, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>PO</span>
                <span style={{ fontWeight: 500 }}>{po.po_number}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Date</span>
                <span style={{ fontWeight: 500 }}>{dispatchDate}</span>
              </div>
              <div className="divider" style={{ margin: '4px 0' }}/>
              {items.map(item => {
            const remaining = item.quantity_ordered - item.quantity_received;
            const qty = Number(item.dispatch_qty);
            const full = item.fulfilled && qty >= remaining;
            const partial = item.fulfilled && qty > 0 && qty < remaining;
            return (<div key={item.id} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{item.products?.product_name?.split(' ').slice(0, 2).join(' ')}</span>
                    <span style={{ fontWeight: 500, color: item.fulfilled ? (full ? 'var(--text-primary)' : '#ca8a04') : '#dc2626' }}>
                      {item.fulfilled ? `${qty} / ${remaining} ${item.products?.unit} ${full ? '✓' : '⚠'}` : 'Cannot fulfill'}
                    </span>
                  </div>);
        })}
              {isPartial && (<div className="alert-banner alert-warn" style={{ marginTop: 8, padding: '8px 10px', fontSize: 11 }}>
                  <span>⚠ Partial dispatch — admin will be notified. PO set to partially_delivered.</span>
                </div>)}
            </div>
          </div>

          <button onClick={handleSubmit} disabled={saving} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
            {saving ? 'Submitting…' : 'Submit dispatch record'}
          </button>
          <p style={{ fontSize: 10, color: 'var(--text-tertiary)', textAlign: 'center' }}>
            Warehouse will confirm receipt. You will be notified once done.
          </p>
          <p className="info-note" style={{ fontSize: 10 }}>
            Creates supplier_deliveries + supplier_delivery_items (status: pending_confirmation)
          </p>
        </div>
      </div>
    </div>);
}
