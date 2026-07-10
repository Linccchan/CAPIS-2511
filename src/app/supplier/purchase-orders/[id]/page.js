'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { StatusBadge } from '@/components/ui/StatusBadge'

export default function PODetailPage() {
  const params = useParams()
  const [po, setPo] = useState(null)
  const [deliveries, setDeliveries] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    async function load() {
      const [{ data: poData }, { data: deliveryData }] = await Promise.all([
        supabase
          .from('purchase_orders')
          .select('*, suppliers(supplier_name), customer_orders(order_number, destination_country), purchase_order_items(*, products(product_name, sku, unit))')
          .eq('id', params.id)
          .single(),
        supabase
          .from('supplier_deliveries')
          .select('*, supplier_delivery_items(quantity_delivered, products(product_name))')
          .eq('purchase_order_id', params.id)
          .order('delivery_date', { ascending: false }),
      ])
      if (!active) return
      setPo(poData)
      setDeliveries(deliveryData || [])
      setLoading(false)
    }
    load()
    return () => {
      active = false
    }
  }, [params.id])

  if (loading) return <div className="card card-pad">Loading purchase order...</div>
  if (!po) return <div className="card card-pad">Purchase order not found.</div>

  const today = new Date().toISOString().split('T')[0]
  const overdue = po.expected_delivery_date && po.expected_delivery_date < today && po.status === 'sent'
  const items = po.purchase_order_items || []
  const order = po.customer_orders
  const canDispatch = ['sent', 'partially_delivered'].includes(po.status)
  const dispatchedQty = {}
  deliveries.forEach((delivery) => {
    delivery.supplier_delivery_items?.forEach((item) => {
      dispatchedQty[item.product_id] = (dispatchedQty[item.product_id] || 0) + Number(item.quantity_delivered)
    })
  })

  return (
    <div style={{ maxWidth: 860 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <Link href="/supplier/dashboard" className="btn btn-ghost btn-sm">Back to purchase orders</Link>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.5px', color: 'var(--text-primary)' }}>{po.po_number}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3 }}>
            Issued {po.issued_date || '-'} - Expected {po.expected_delivery_date || '-'} - For Order {order?.order_number}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {overdue && <span className="badge badge-red">Overdue</span>}
          <StatusBadge status={po.status} />
          {canDispatch && <Link href={`/supplier/purchase-orders/${params.id}/dispatch`} className="btn btn-primary">Log dispatch</Link>}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 16 }}>
        <div className="card">
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
            Items ordered
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th className="table-th">Product</th>
                <th className="table-th">SKU</th>
                <th className="table-th" style={{ textAlign: 'right' }}>Qty ordered</th>
                <th className="table-th" style={{ textAlign: 'right' }}>Qty dispatched</th>
                <th className="table-th">Unit</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="table-td"><span className="td-primary">{item.products?.product_name}</span></td>
                  <td className="table-td" style={{ fontFamily: 'monospace', fontSize: 11 }}>{item.products?.sku || '-'}</td>
                  <td className="table-td" style={{ textAlign: 'right' }}>{item.quantity_ordered}</td>
                  <td className="table-td" style={{ textAlign: 'right' }}>{dispatchedQty[item.product_id] || <span style={{ color: 'var(--text-tertiary)' }}>-</span>}</td>
                  <td className="table-td">{item.products?.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card card-pad" style={{ height: 'fit-content' }}>
          <div className="section-label">PO summary</div>
          {[
            ['PO number', po.po_number],
            ['Order ref', order?.order_number || '-'],
            ['Destination', order?.destination_country || '-'],
            ['Issued', po.issued_date || '-'],
            ['Expected', po.expected_delivery_date || '-'],
            ['Total SKUs', items.length],
            ['Total qty', items.reduce((sum, item) => sum + item.quantity_ordered, 0)],
          ].map(([label, value]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--bg)', fontSize: 12 }}>
              <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
              <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{value}</span>
            </div>
          ))}
          {canDispatch && <Link href={`/supplier/purchase-orders/${params.id}/dispatch`} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 14 }}>Log dispatch</Link>}
        </div>
      </div>
    </div>
  )
}
