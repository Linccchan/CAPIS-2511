'use client';
// S14 — Log Delivery / Confirm Receipt  (src/app/warehouse/log-delivery/[poId]/page.js)
import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
export default function LogDeliveryPage() {
    const params = useParams();
    const router = useRouter();
    const supabase = useMemo(() => createClient(), []);
    const [po, setPO] = useState(null);
    const [delivery, setDelivery] = useState(null);
    const [items, setItems] = useState([]);
    const [locations, setLocations] = useState([]);
    const [remarks, setRemarks] = useState('');
    const [saving, setSaving] = useState(false);
    useEffect(() => {
        async function load() {
            const { data: poData } = await supabase.from('purchase_orders')
                .select('*, suppliers(supplier_name), customer_orders(id, order_number)')
                .eq('id', params.poId).single();
            setPO(poData);
            const { data: del } = await supabase.from('supplier_deliveries')
                .select('*, supplier_delivery_items(*, products(product_name, sku, unit))')
                .eq('purchase_order_id', params.poId)
                .eq('delivery_status', 'pending_confirmation')
                .maybeSingle();
            setDelivery(del);
            const dispatchedItems = del?.supplier_delivery_items ?? [];
            setItems(dispatchedItems.map((i) => ({
                ...i,
                actual_qty: String(i.quantity_delivered),
                condition: 'good',
                location_id: '',
            })));
            // Get available (unoccupied) locations
            const { data: locs } = await supabase.from('warehouse_locations').select('*, inventory_batches(quantity_available)')
                .eq('is_active', true).order('location_code');
            // Filter to locations with no stock
            const available = (locs ?? []).filter(l => {
                const batches = l.inventory_batches;
                const totalQty = batches?.reduce((s, b) => s + b.quantity_available, 0) ?? 0;
                return totalQty === 0;
            });
            setLocations(available);
        }
        load();
    }, [params.poId, supabase]);
    function updateItem(id, field, value) {
        setItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));
    }
    async function handleConfirm() {
        setSaving(true);
        const { data: { user } } = await supabase.auth.getUser();
        for (const item of items) {
            const actualQty = Number(item.actual_qty);
            await supabase.from('supplier_delivery_items').update({
                quantity_accepted: actualQty,
                condition_status: item.condition,
                remarks: item.condition !== 'good' ? `Condition: ${item.condition}` : null,
            }).eq('id', item.id);
            await supabase.from('purchase_order_items')
                .update({ quantity_received: actualQty })
                .eq('purchase_order_id', params.poId)
                .eq('product_id', item.product_id);
            if (actualQty > 0) {
                await supabase.from('inventory_batches').insert({
                    order_id: po.customer_orders?.id,
                    product_id: item.product_id,
                    delivery_item_id: item.id,
                    location_id: item.location_id || null,
                    quantity_available: actualQty,
                    quantity_staged: 0,
                    received_date: new Date().toISOString().split('T')[0],
                });
            }
        }
        await supabase.from('supplier_deliveries').update({
            delivery_status: 'received',
            received_by: user?.id,
            remarks: remarks || null,
        }).eq('id', delivery.id);
        // Check if fully delivered
        const { data: poItems } = await supabase.from('purchase_order_items')
            .select('quantity_ordered, quantity_received').eq('purchase_order_id', params.poId);
        const allDelivered = poItems?.every(i => Number(i.quantity_received) >= Number(i.quantity_ordered));
        await supabase.from('purchase_orders').update({
            status: allDelivered ? 'delivered' : 'partially_delivered',
            ...(allDelivered ? { actual_completed_date: new Date().toISOString().split('T')[0] } : {}),
        }).eq('id', params.poId);
        // Notify admin
        const { data: admins } = await supabase.from('profiles').select('id').eq('role', 'admin');
        for (const a of admins ?? []) {
            await supabase.from('notifications').insert({
                user_id: a.id,
                order_id: po.customer_orders?.id,
                type: allDelivered ? 'po_delivered' : 'po_partial',
                title: `${allDelivered ? 'PO delivered' : 'Partial delivery'}: ${po.po_number}`,
                message: allDelivered ? 'All items confirmed by warehouse.' : 'Some items missing or short — review.',
            });
        }
        router.push('/warehouse/dashboard');
    }
    if (!po)
        return <div style={{ padding: 24, color: 'var(--text-tertiary)' }}>Loading…</div>;
    if (!delivery)
        return (<div>
      <Link href="/warehouse/dashboard" className="btn btn-ghost btn-sm" style={{ marginBottom: 16, display: 'inline-flex' }}>← Dashboard</Link>
      <div className="card card-pad" style={{ maxWidth: 480 }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>No pending dispatch found for this PO. The supplier may not have logged a dispatch yet.</p>
      </div>
    </div>);
    const order = po.customer_orders;
    return (<div style={{ maxWidth: 900 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <Link href="/warehouse/dashboard" className="btn btn-ghost btn-sm">← Dashboard</Link>
      </div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.5px', color: 'var(--text-primary)' }}>Confirm delivery receipt</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
          {po.po_number} · {po.suppliers?.supplier_name} · For {order?.order_number} · Supplier dispatched {delivery.delivery_date}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Verify quantities */}
          <div className="card">
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
              Verify quantities received
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th className="table-th">Product</th>
                  <th className="table-th" style={{ textAlign: 'right' }}>Supplier said</th>
                  <th className="table-th" style={{ textAlign: 'right' }}>Actually received</th>
                  <th className="table-th">Condition</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => (<tr key={item.id}>
                    <td className="table-td">
                      <div className="td-primary">{item.products?.product_name}</div>
                      <div style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--text-tertiary)' }}>{item.products?.sku}</div>
                    </td>
                    <td className="table-td" style={{ textAlign: 'right', fontWeight: 500 }}>{item.quantity_delivered} {item.products?.unit}</td>
                    <td className="table-td" style={{ textAlign: 'right' }}>
                      <input type="number" min="0" className="input" style={{ width: 80, textAlign: 'right' }} value={item.actual_qty} onChange={e => updateItem(item.id, 'actual_qty', e.target.value)}/>
                    </td>
                    <td className="table-td">
                      <select className="input" style={{ width: 130 }} value={item.condition} onChange={e => updateItem(item.id, 'condition', e.target.value)}>
                        <option value="good">Good</option>
                        <option value="damaged">Damaged</option>
                        <option value="missing">Missing</option>
                        <option value="wrong_item">Wrong item</option>
                      </select>
                    </td>
                  </tr>))}
              </tbody>
            </table>
          </div>

          {/* Assign locations */}
          <div className="card">
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
              Assign warehouse locations
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th className="table-th">Product</th>
                  <th className="table-th">Assign location</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => (<tr key={item.id}>
                    <td className="table-td"><span className="td-primary">{item.products?.product_name}</span></td>
                    <td className="table-td">
                      <select className="input" style={{ width: 180 }} value={item.location_id} onChange={e => updateItem(item.id, 'location_id', e.target.value)}>
                        <option value="">— Select location —</option>
                        {locations.map(loc => (<option key={loc.id} value={loc.id}>{loc.location_code} · empty</option>))}
                      </select>
                    </td>
                  </tr>))}
              </tbody>
            </table>
            <p className="info-note" style={{ margin: 12 }}>
              Dropdown shows only active, unoccupied warehouse_locations. Codes follow ZONE-RACK-SLOT. Occupancy derived from inventory_batches.
            </p>
          </div>
        </div>

        {/* Receipt summary */}
        <div className="card card-pad" style={{ height: 'fit-content' }}>
          <div className="section-label" style={{ marginBottom: 10 }}>Receipt summary</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {[
            ['Supplier', po.suppliers?.supplier_name],
            ['PO #', po.po_number],
            ['Order', order?.order_number],
            ['Dispatched', delivery.delivery_date],
            ['Confirming', new Date().toISOString().split('T')[0]],
        ].map(([l, v]) => (<div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--bg)', fontSize: 11 }}>
                <span style={{ color: 'var(--text-secondary)' }}>{l}</span>
                <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{v}</span>
              </div>))}
          </div>
          <div style={{ marginTop: 12 }}>
            <label className="section-label">Remarks</label>
            <textarea className="input" rows={3} placeholder="Any notes about this receipt…" value={remarks} onChange={e => setRemarks(e.target.value)}/>
          </div>
          <button onClick={handleConfirm} disabled={saving} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 14 }}>
            {saving ? 'Confirming…' : 'Confirm receipt'}
          </button>
          <p className="info-note" style={{ marginTop: 10, fontSize: 10 }}>
            Updates PO status · creates inventory_batches · notifies admin · triggers cost prompt if unit_cost changed.
          </p>
        </div>
      </div>
    </div>);
}
