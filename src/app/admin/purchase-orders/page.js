'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { useRouter } from 'next/navigation'

export default function PurchaseOrdersPage() {
  const router = useRouter()

  const [pos, setPos] = useState([])
  const [tab, setTab] = useState('All')
  const [search, setSearch] = useState('')

  useEffect(() => {
    let active = true
    async function load() {
      const { data } = await supabase
        .from('purchase_orders')
        .select('*, suppliers(supplier_name), customer_orders(order_number)')
        .not('status', 'in', '(cancelled)')
        .order('created_at', { ascending: false })
      if (active) setPos(data || [])
    }
    load()
    return () => {
      active = false
    }
  }, [])

  const today = new Date().toISOString().split('T')[0]
  const tabMap = useMemo(() => {
    const overdue = pos.filter((po) => po.status === 'sent' && po.expected_delivery_date && po.expected_delivery_date < today)
    return {
      All: pos,
      Overdue: overdue,
      Sent: pos.filter((po) => po.status === 'sent' && !(po.expected_delivery_date && po.expected_delivery_date < today)),
      Pending: pos.filter((po) => po.status === 'Pending'),
      'Partially Delivered': pos.filter((po) => po.status === 'partially_delivered'),
      Delivered: pos.filter((po) => po.status === 'delivered'),
    }
  }, [pos, today])

  const displayed = (tabMap[tab] || []).filter((po) => {
    const q = search.toLowerCase().trim()

    if (!q) return true

    return (
      po.po_number?.toLowerCase().includes(q) ||
      po.customer_orders?.order_number?.toLowerCase().includes(q) ||
      po.suppliers?.supplier_name?.toLowerCase().includes(q) ||
      po.status?.toLowerCase().includes(q)
    )
  })

  return (
    <div style={{ maxWidth: '100%'}}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.5px', color: 'var(--text-primary)' }}>Purchase orders</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            className="input"
            placeholder="Search PO #, supplier, order..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 250 }}
          />
          <button className="btn btn-primary" onClick={() => router.push('/order-management/purchase-orders')}>+ Create PO</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {['All', 'Pending', 'Partially Delivered', 'Delivered', 'Sent', 'Overdue'].map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setTab(item)}
            style={{
              padding: '7px 12px',
              fontSize: 12,
              fontWeight: tab === item ? 500 : 400,
              color: tab === item ? 'var(--text-primary)' : 'var(--text-tertiary)',
              border: 'none',
              borderBottom: tab === item ? '2px solid var(--text-primary)' : '2px solid transparent',
              background: 'transparent',
              cursor: 'pointer',
              marginBottom: -1,
            }}
          >
            {item} {tabMap[item]?.length > 0 && `(${tabMap[item].length})`}
          </button>
        ))}
      </div>

      <div className="card">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th className="table-th">PO #</th>
              <th className="table-th">Order</th>
              <th className="table-th">Supplier</th>
              <th className="table-th">Issued</th>
              <th className="table-th">Expected</th>
              <th className="table-th">Actual delivery</th>
              <th className="table-th">Status</th>
            </tr>
          </thead>
          <tbody>
            {displayed.map((po) => {
              const isOverdue = po.status === 'sent' && po.expected_delivery_date && po.expected_delivery_date < today
              return (
                <tr key={po.id} style={{ background: isOverdue ? '#fef2f2' : undefined }}>
                  <td className="table-td"><span className="td-primary">{po.po_number}</span></td>
                  <td className="table-td">{po.customer_orders?.order_number}</td>
                  <td className="table-td">{po.suppliers?.supplier_name}</td>
                  <td className="table-td">{po.issued_date || '-'}</td>
                  <td className="table-td">{po.expected_delivery_date || '-'}</td>
                  <td className="table-td">{po.actual_completed_date || '-'}</td>
                  <td className="table-td">{isOverdue ? <span className="badge badge-red">Overdue</span> : <StatusBadge status={po.status} />}</td>
                </tr>
              )
            })}
            {displayed.length === 0 && <tr><td colSpan={7} className="table-td" style={{ textAlign: 'center', padding: 32 }}>No purchase orders</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
