'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { StatusBadge } from '@/components/ui/StatusBadge'

export default function SupplierPOsPage() {
  const [pos, setPos] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: supplier } = await supabase.from('suppliers').select('id').eq('email', user?.email || '').maybeSingle()
      const { data } = await supabase
        .from('purchase_orders')
        .select('*, customer_orders(order_number, destination_country), purchase_order_items(id)')
        .eq('supplier_id', supplier?.id || '')
        .not('status', 'eq', 'cancelled')
        .order('created_at', { ascending: false })

      if (!active) return
      setPos(data || [])
      setLoading(false)
    }
    load()
    return () => {
      active = false
    }
  }, [])

  const today = new Date().toISOString().split('T')[0]

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
            {pos.map((po) => {
              const overdue = po.expected_delivery_date && po.expected_delivery_date < today && po.status === 'sent'
              return (
                <tr key={po.id}>
                  <td className="table-td"><span className="td-primary">{po.po_number}</span></td>
                  <td className="table-td">{po.customer_orders?.order_number}</td>
                  <td className="table-td">{po.customer_orders?.destination_country || '-'}</td>
                  <td className="table-td">{po.purchase_order_items?.length || 0} SKUs</td>
                  <td className="table-td">{po.issued_date || '-'}</td>
                  <td className="table-td">{po.expected_delivery_date || '-'}</td>
                  <td className="table-td">{overdue ? <span className="badge badge-red">Overdue</span> : <StatusBadge status={po.status} />}</td>
                  <td className="table-td">
                    <div style={{ display: 'flex', gap: 6 }}>
                      {['sent', 'partially_delivered'].includes(po.status) && <Link href={`/supplier/purchase-orders/${po.id}/dispatch`} className="btn btn-sm btn-primary">Log dispatch</Link>}
                      <Link href={`/supplier/purchase-orders/${po.id}`} className="btn btn-sm btn-ghost">View</Link>
                    </div>
                  </td>
                </tr>
              )
            })}
            {loading && <tr><td colSpan={8} className="table-td" style={{ textAlign: 'center', padding: 32 }}>Loading purchase orders...</td></tr>}
            {!loading && pos.length === 0 && <tr><td colSpan={8} className="table-td" style={{ textAlign: 'center', padding: 32 }}>No purchase orders</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
