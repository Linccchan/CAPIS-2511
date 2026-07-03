'use client';
// S30 — Supplier Cost Management  (src/app/admin/supplier-costs/page.tsx)
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function SupplierCostsPage() {
  const supabase = createClient();
  const [costPrompts, setCostPrompts] = useState<any[]>([]);
  const [costs, setCosts] = useState<any[]>([]);
  const [filter, setFilter] = useState('');
  const [filterSupplier, setFilterSupplier] = useState('');
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [customValues, setCustomValues] = useState<Record<string, string>>({});

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();

      const [{ data: notifs }, { data: c }, { data: s }] = await Promise.all([
        supabase.from('notifications').select('*')
          .eq('user_id', user!.id).eq('type', 'cost_update_prompt').eq('is_read', false),
        supabase.from('supplier_product_costs')
          .select('*, products(product_name, sku), suppliers(supplier_name)')
          .is('effective_to', null).order('created_at', { ascending: false }),
        supabase.from('suppliers').select('id, supplier_name').order('supplier_name'),
      ]);
      setCostPrompts(notifs ?? []);
      setCosts(c ?? []);
      setSuppliers(s ?? []);
    }
    load();
  }, []);

  async function handleDecision(notifId: string, productId: string, supplierId: string, action: 'accept' | 'keep' | 'custom', impliedCost: number) {
    const { data: { user } } = await supabase.auth.getUser();
    const today = new Date().toISOString().split('T')[0];

    if (action !== 'keep') {
      const newCost = action === 'custom' ? Number(customValues[notifId] ?? 0) : impliedCost;
      if (newCost > 0) {
        // Stamp old
        await supabase.from('supplier_product_costs').update({ effective_to: today })
          .eq('product_id', productId).eq('supplier_id', supplierId).is('effective_to', null);
        // Insert new
        await supabase.from('supplier_product_costs').insert({
          product_id: productId, supplier_id: supplierId,
          unit_cost: newCost, currency: 'USD',
          effective_from: today, source: 'po_derived',
          updated_by: user?.id,
        });
      }
    }

    await supabase.from('notifications').update({ is_read: true }).eq('id', notifId);
    setCostPrompts(prev => prev.filter(n => n.id !== notifId));
    window.location.reload();
  }

  const filteredCosts = costs.filter(c => {
    const matchProduct = !filter || c.products?.product_name?.toLowerCase().includes(filter.toLowerCase());
    const matchSupplier = !filterSupplier || c.supplier_id === filterSupplier;
    return matchProduct && matchSupplier;
  });

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.5px', color: 'var(--text-primary)' }}>Supplier cost management</div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <input type="text" className="input" placeholder="Filter by product…" style={{ width: 200 }}
          value={filter} onChange={e => setFilter(e.target.value)} />
        <select className="input" style={{ width: 180 }} value={filterSupplier} onChange={e => setFilterSupplier(e.target.value)}>
          <option value="">All suppliers</option>
          {suppliers.map(s => <option key={s.id} value={s.id}>{s.supplier_name}</option>)}
        </select>
      </div>

      {/* Cost update prompts */}
      {costPrompts.length > 0 && (
        <div style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {costPrompts.map(n => {
            const meta = n.message_data ?? {};
            const implied = meta.implied_cost ?? 0;
            const recorded = meta.recorded_cost ?? 0;
            const change = implied - recorded;
            const changePct = recorded > 0 ? ((change / recorded) * 100).toFixed(1) : '0';

            return (
              <div key={n.id} className="alert-banner alert-warn">
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{n.title}</div>
                  <div style={{ fontSize: 12, marginBottom: 12 }}>{n.message}</div>

                  <div className="card" style={{ overflow: 'hidden', marginBottom: 12 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          <th className="table-th">Product</th>
                          <th className="table-th" style={{ textAlign: 'right' }}>Recorded cost</th>
                          <th className="table-th" style={{ textAlign: 'right' }}>Implied from PO</th>
                          <th className="table-th" style={{ textAlign: 'right' }}>Change</th>
                          <th className="table-th">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="table-td"><span className="td-primary">{meta.product_name ?? 'Product'}</span></td>
                          <td className="table-td" style={{ textAlign: 'right' }}>${Number(recorded).toFixed(2)}</td>
                          <td className="table-td" style={{ textAlign: 'right', fontWeight: 500 }}>${Number(implied).toFixed(2)}</td>
                          <td className="table-td" style={{ textAlign: 'right', color: change > 0 ? '#dc2626' : '#15803d' }}>
                            {change > 0 ? '+' : ''}${change.toFixed(2)} ({change > 0 ? '+' : ''}{changePct}%)
                          </td>
                          <td className="table-td">
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              <button className="btn btn-sm btn-primary" onClick={() => handleDecision(n.id, meta.product_id, meta.supplier_id, 'accept', implied)}>
                                Accept ${Number(implied).toFixed(2)}
                              </button>
                              <button className="btn btn-sm btn-secondary" onClick={() => handleDecision(n.id, meta.product_id, meta.supplier_id, 'keep', implied)}>
                                Keep ${Number(recorded).toFixed(2)}
                              </button>
                              <div style={{ display: 'flex', gap: 4 }}>
                                <input type="number" className="input" style={{ width: 80 }} placeholder="Custom…"
                                  value={customValues[n.id] ?? ''} onChange={e => setCustomValues(prev => ({ ...prev, [n.id]: e.target.value }))} />
                                <button className="btn btn-sm btn-ghost" onClick={() => handleDecision(n.id, meta.product_id, meta.supplier_id, 'custom', implied)}>
                                  Set
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <p className="info-note" style={{ fontSize: 10 }}>
                    Triggered when PO delivered and unit_cost differs from supplier_product_costs. No auto-write — human confirms first.
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Current costs table */}
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10 }}>Current supplier costs</div>
      <div className="card">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th className="table-th">Product</th>
              <th className="table-th">Supplier</th>
              <th className="table-th" style={{ textAlign: 'right' }}>Unit cost (USD)</th>
              <th className="table-th">Effective from</th>
              <th className="table-th">Source</th>
              <th className="table-th">History</th>
              <th className="table-th">Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredCosts.map(c => (
              <tr key={c.id}>
                <td className="table-td">
                  <div className="td-primary">{c.products?.product_name}</div>
                  <div style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--text-tertiary)' }}>{c.products?.sku}</div>
                </td>
                <td className="table-td">{c.suppliers?.supplier_name}</td>
                <td className="table-td" style={{ textAlign: 'right', fontWeight: 500 }}>${Number(c.unit_cost).toFixed(2)}</td>
                <td className="table-td">{c.effective_from}</td>
                <td className="table-td">
                  <span className={`badge ${c.source === 'po_derived' ? 'badge-dark' : 'badge-gray'}`}>
                    {c.source === 'po_derived' ? 'PO-derived' : 'Manual'}
                  </span>
                </td>
                <td className="table-td">
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)', cursor: 'pointer', textDecoration: 'underline' }}>
                    View versions
                  </span>
                </td>
                <td className="table-td">
                  <button className="btn btn-sm btn-ghost">Update</button>
                </td>
              </tr>
            ))}
            {!filteredCosts.length && (
              <tr><td colSpan={7} className="table-td" style={{ textAlign: 'center', padding: 32 }}>No cost records yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
