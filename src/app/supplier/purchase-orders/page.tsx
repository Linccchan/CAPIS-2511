// src/app/supplier/purchase-orders/page.tsx
import { createClient } from '@/lib/supabase/server';
import { StatusBadge } from '@/components/ui/StatusBadge';
import Link from 'next/link';

export default async function SupplierPOsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: supplier } = await supabase.from('suppliers').select('id').eq('email', user?.email).maybeSingle();
  const today = new Date().toISOString().split('T')[0];

  const { data: pos } = await supabase.from('purchase_orders')
    .select('*, customer_orders(order_number, destination_country), purchase_order_items(id)')
    .eq('supplier_id', supplier?.id ?? '')
    .not('status', 'eq', 'cancelled')
    .order('created_at', { ascending: false });

  return (
    <div style={{ maxWidth: 860 }}>
      <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.5px', color: 'var(--text-primary)', marginBottom: 20 }}>Purchase orders</div>
      <div className="card">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th className="table-th">PO #</th>
              <th className="table-th">For order</th>
              <th className="table-th">Destination</th>
              <th className="table-th">Items</th>
              <th className="table-th">Issued</th>
              <th className="table-th">Expected</th>
              <th className="table-th">Status</th>
              <th className="table-th"></th>
            </tr>
          </thead>
          <tbody>
            {pos?.map(po => {
              const overdue = po.expected_delivery_date && po.expected_delivery_date < today && po.status === 'sent';
              const order = po.customer_orders as any;
              return (
                <tr key={po.id}>
                  <td className="table-td"><span className="td-primary">{po.po_number}</span></td>
                  <td className="table-td">{order?.order_number}</td>
                  <td className="table-td">{order?.destination_country ?? '—'}</td>
                  <td className="table-td">{(po.purchase_order_items as any[])?.length ?? 0} SKUs</td>
                  <td className="table-td">{po.issued_date ?? '—'}</td>
                  <td className="table-td">
                    <span style={{ color: overdue ? '#dc2626' : undefined, fontWeight: overdue ? 500 : undefined }}>
                      {po.expected_delivery_date ?? '—'}{overdue ? ' ⚠' : ''}
                    </span>
                  </td>
                  <td className="table-td">
                    {overdue ? <span className="badge badge-red">Overdue</span> : <StatusBadge status={po.status} />}
                  </td>
                  <td className="table-td">
                    <div style={{ display: 'flex', gap: 6 }}>
                      {['sent', 'partially_delivered'].includes(po.status) && (
                        <Link href={`/supplier/purchase-orders/${po.id}/dispatch`} className="btn btn-sm btn-primary">Log dispatch</Link>
                      )}
                      <Link href={`/supplier/purchase-orders/${po.id}`} className="btn btn-sm btn-ghost">View</Link>
                    </div>
                  </td>
                </tr>
              );
            })}
            {!pos?.length && (
              <tr><td colSpan={8} className="table-td" style={{ textAlign: 'center', padding: 32 }}>No purchase orders</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
