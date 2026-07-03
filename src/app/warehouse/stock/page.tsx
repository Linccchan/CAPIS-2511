// S15 — Stock & Locations  (src/app/warehouse/stock/page.tsx)
import { createClient } from '@/lib/supabase/server';
import { StatusBadge } from '@/components/ui/StatusBadge';

export default async function StockPage() {
  const supabase = createClient();

  const [{ data: batches }, { data: locations }] = await Promise.all([
    supabase.from('inventory_batches')
      .select('*, products(product_name, sku, unit), warehouse_locations(location_code), customer_orders(order_number, status), staging_tasks(status)')
      .gt('quantity_available', 0)
      .order('received_date', { ascending: false }),
    supabase.from('warehouse_locations')
      .select('*, inventory_batches(quantity_available)')
      .eq('is_active', true)
      .order('location_code'),
  ]);

  // Build rack map by zone
  const zones: Record<string, any[]> = {};
  (locations ?? []).forEach(loc => {
    const zone = loc.location_code.split('-')[0] ?? 'X';
    if (!zones[zone]) zones[zone] = [];
    zones[zone].push(loc);
  });

  function getLocationStatus(loc: any): 'occupied' | 'staging' | 'empty' {
    const batches = loc.inventory_batches as any[];
    const qty = batches?.reduce((s: number, b: any) => s + b.quantity_available, 0) ?? 0;
    if (qty > 0) return 'occupied';
    return 'empty';
  }

  function getBatchStatus(batch: any): string {
    const tasks = batch.staging_tasks as any[];
    if (tasks?.some((t: any) => t.status === 'completed')) return 'Staged';
    if (tasks?.some((t: any) => t.status === 'in_progress')) return 'Stickering';
    return 'Received';
  }

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.5px', color: 'var(--text-primary)' }}>Stock & warehouse locations</div>
        </div>
        <input type="text" className="input" placeholder="Find product…" style={{ width: 200 }} />
      </div>

      {/* Zone rack maps */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14, marginBottom: 20 }}>
        {Object.entries(zones).map(([zone, locs]) => (
          <div key={zone} className="card card-pad">
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
              Zone {zone} — Rack map
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 12 }}>
              Dark = occupied · Gray = staging · White = empty
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
              {locs.map(loc => {
                const status = getLocationStatus(loc);
                const bg = status === 'occupied' ? 'var(--accent)' : status === 'staging' ? '#9E9E9B' : 'var(--bg)';
                const color = status === 'empty' ? 'var(--text-tertiary)' : '#fff';
                return (
                  <div key={loc.id} title={loc.location_code}
                    style={{ background: bg, color, borderRadius: 4, padding: '6px 4px', textAlign: 'center', fontSize: 10, fontWeight: 500, border: '1px solid var(--border)', cursor: 'default' }}>
                    {loc.location_code.replace(`${zone}-`, '')}
                  </div>
                );
              })}
            </div>
            <p className="info-note" style={{ marginTop: 10, fontSize: 10 }}>
              Occupancy derived from inventory_batches quantities — no stored is_occupied flag.
            </p>
          </div>
        ))}
      </div>

      {/* Current stock table */}
      <div className="card">
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
          Current stock
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th className="table-th">Product</th>
              <th className="table-th">Order</th>
              <th className="table-th" style={{ textAlign: 'right' }}>Qty</th>
              <th className="table-th">Location</th>
              <th className="table-th">Status</th>
              <th className="table-th">Received</th>
            </tr>
          </thead>
          <tbody>
            {batches?.map(b => {
              const status = getBatchStatus(b);
              return (
                <tr key={b.id}>
                  <td className="table-td">
                    <div className="td-primary">{(b.products as any)?.product_name}</div>
                    <div style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--text-tertiary)' }}>{(b.products as any)?.sku}</div>
                  </td>
                  <td className="table-td">{(b.customer_orders as any)?.order_number ?? '—'}</td>
                  <td className="table-td" style={{ textAlign: 'right', fontWeight: 500 }}>{b.quantity_available} {(b.products as any)?.unit}</td>
                  <td className="table-td">
                    <span style={{ fontFamily: 'monospace', fontSize: 11, background: 'var(--bg)', padding: '2px 6px', borderRadius: 4 }}>
                      {(b.warehouse_locations as any)?.location_code ?? 'Unassigned'}
                    </span>
                  </td>
                  <td className="table-td">
                    <span className={`badge ${status === 'Staged' ? 'badge-dark' : status === 'Stickering' ? 'badge-yellow' : 'badge-gray'}`}>
                      {status}
                    </span>
                  </td>
                  <td className="table-td">{b.received_date ?? '—'}</td>
                </tr>
              );
            })}
            {!batches?.length && (
              <tr><td colSpan={6} className="table-td" style={{ textAlign: 'center', padding: 32 }}>No stock in warehouse</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
