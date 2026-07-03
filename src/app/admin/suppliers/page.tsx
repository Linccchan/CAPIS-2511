// S09 — Suppliers  (src/app/admin/suppliers/page.tsx)
import { createClient } from '@/lib/supabase/server';

export default async function SuppliersPage() {
  const supabase = createClient();

  const { data: suppliers } = await supabase.from('suppliers')
    .select('*, supplier_performance(average_lead_time_days, late_delivery_count, total_purchase_orders, reliability_score), purchase_orders(id, status)')
    .order('supplier_name');

  function reliabilityLabel(score?: number | null) {
    if (!score) return { label: 'N/A', cls: 'badge-gray' };
    if (score >= 0.85) return { label: 'Good', cls: 'badge-green' };
    if (score >= 0.7) return { label: 'Fair', cls: 'badge-yellow' };
    return { label: 'At risk', cls: 'badge-red' };
  }

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.5px', color: 'var(--text-primary)' }}>Suppliers</div>
        <button className="btn btn-primary">+ Add supplier</button>
      </div>

      <div className="card">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th className="table-th">Supplier</th>
              <th className="table-th">Type</th>
              <th className="table-th" style={{ textAlign: 'right' }}>Avg lead days</th>
              <th className="table-th" style={{ textAlign: 'right' }}>On-time rate</th>
              <th className="table-th" style={{ textAlign: 'right' }}>Active POs</th>
              <th className="table-th">Reliability</th>
              <th className="table-th"></th>
            </tr>
          </thead>
          <tbody>
            {suppliers?.map(s => {
              const perf = (s.supplier_performance as any)?.[0];
              const pos = s.purchase_orders as any[];
              const activePOs = pos?.filter(p => ['sent', 'partially_delivered'].includes(p.status)).length ?? 0;
              const onTimeRate = perf
                ? Math.round(((perf.total_purchase_orders - perf.late_delivery_count) / Math.max(perf.total_purchase_orders, 1)) * 100)
                : null;
              const rel = reliabilityLabel(perf?.reliability_score);
              return (
                <tr key={s.id}>
                  <td className="table-td">
                    <div className="td-primary">{s.supplier_name}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{s.email}</div>
                  </td>
                  <td className="table-td" style={{ textTransform: 'capitalize' }}>{s.supplier_type ?? '—'}</td>
                  <td className="table-td" style={{ textAlign: 'right' }}>
                    {perf?.average_lead_time_days ? `${Math.round(perf.average_lead_time_days)} days` : '—'}
                  </td>
                  <td className="table-td" style={{ textAlign: 'right' }}>
                    {onTimeRate != null ? `${onTimeRate}%` : '—'}
                  </td>
                  <td className="table-td" style={{ textAlign: 'right' }}>{activePOs}</td>
                  <td className="table-td">
                    <span className={`badge ${rel.cls}`}>{rel.label}</span>
                  </td>
                  <td className="table-td">
                    <button className="btn btn-sm btn-ghost">View</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="info-note" style={{ margin: 12 }}>
          Avg lead days and on-time rate computed from supplier_performance table — recalculated after every confirmed delivery.
        </p>
      </div>
    </div>
  );
}
