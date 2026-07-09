'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { StatusBadge } from '@/components/ui/StatusBadge'

export default function DeliveryHistoryPage() {
  const [deliveries, setDeliveries] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: supplier } = await supabase.from('suppliers').select('id').eq('email', user?.email || '').maybeSingle()
      const { data } = await supabase
        .from('supplier_deliveries')
        .select('*, purchase_orders(po_number, expected_delivery_date, customer_orders(order_number)), supplier_delivery_items(quantity_delivered, quantity_accepted, condition_status, products(product_name))')
        .eq('supplier_id', supplier?.id || '')
        .order('delivery_date', { ascending: false })

      if (!active) return
      setDeliveries(data || [])
      setLoading(false)
    }
    load()
    return () => {
      active = false
    }
  }, [])

  const onTimeCount = deliveries.filter((delivery) => {
    const po = delivery.purchase_orders
    return po?.expected_delivery_date && delivery.delivery_date <= po.expected_delivery_date
  }).length
  const lateCount = deliveries.length - onTimeCount
  const discrepancies = deliveries.flatMap((delivery) =>
    delivery.supplier_delivery_items
      ?.filter((item) => ['damaged', 'missing', 'wrong_item'].includes(item.condition_status))
      .map((item) => ({
        po: delivery.purchase_orders?.po_number,
        date: delivery.delivery_date,
        product: item.products?.product_name,
        condition: item.condition_status,
      })) || [],
  )
  const partialDispatches = deliveries.filter((delivery) =>
    delivery.supplier_delivery_items?.some((item) => item.quantity_delivered < item.quantity_accepted || item.quantity_accepted === 0),
  )

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.5px' }}>Delivery history</div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn btn-secondary btn-sm">Oct 2024</button>
          <button className="btn btn-secondary btn-sm">Sep 2024</button>
          <button className="btn btn-ghost btn-sm">All time</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { val: deliveries.length, lbl: 'Total deliveries', sub: 'Since account creation' },
          { val: onTimeCount, lbl: 'On time', sub: `${Math.round((onTimeCount / Math.max(deliveries.length || 1, 1)) * 100)}% rate` },
          { val: lateCount, lbl: 'Late', sub: 'Avg +4.2 days' },
          { val: partialDispatches.length, lbl: 'Partial dispatches', sub: 'Short qty events' },
        ].map((item) => (
          <div key={item.lbl} className="stat-card">
            <div className="stat-val">{item.val}</div>
            <div className="stat-lbl">{item.lbl}</div>
            <div className="stat-sub">{item.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 16 }}>
        <div className="card">
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
            All deliveries
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th className="table-th">PO #</th>
                <th className="table-th">Dispatched</th>
                <th className="table-th">WH confirmed</th>
                <th className="table-th">Items</th>
                <th className="table-th">On time?</th>
                <th className="table-th">Status</th>
              </tr>
            </thead>
            <tbody>
              {deliveries.map((delivery) => {
                const po = delivery.purchase_orders
                const onTime = !po?.expected_delivery_date || delivery.delivery_date <= po.expected_delivery_date
                const totalQty = delivery.supplier_delivery_items?.reduce((sum, item) => sum + item.quantity_delivered, 0) || 0
                const acceptedQty = delivery.supplier_delivery_items?.reduce((sum, item) => sum + item.quantity_accepted, 0) || 0
                return (
                  <tr key={delivery.id}>
                    <td className="table-td"><span className="td-primary">{po?.po_number}</span></td>
                    <td className="table-td">{delivery.delivery_date}{delivery.delivery_status === 'pending_confirmation' ? ' (logged)' : ''}</td>
                    <td className="table-td">{['received', 'with_discrepancy'].includes(delivery.delivery_status) ? delivery.delivery_date : <span style={{ color: 'var(--text-tertiary)' }}>Pending</span>}</td>
                    <td className="table-td">{acceptedQty || totalQty} / {totalQty}</td>
                    <td className="table-td"><span style={{ fontSize: 11, fontWeight: 500, color: onTime ? '#15803d' : '#dc2626' }}>{onTime ? 'On time' : 'Late'}</span></td>
                    <td className="table-td"><StatusBadge status={delivery.delivery_status} /></td>
                  </tr>
                )
              })}
              {loading && <tr><td colSpan={6} className="table-td" style={{ textAlign: 'center', padding: 32 }}>Loading delivery history...</td></tr>}
              {!loading && deliveries.length === 0 && <tr><td colSpan={6} className="table-td" style={{ textAlign: 'center', padding: 32 }}>No delivery history yet</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="card">
          <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
            Discrepancy log
          </div>
          {discrepancies.map((item, index) => (
            <div key={`${item.po}-${index}`} style={{ padding: '10px 14px', borderBottom: '1px solid var(--bg)' }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>
                {item.po} - <span style={{ textTransform: 'capitalize' }}>{item.condition?.replace('_', ' ')}</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{item.product} - {item.date}</div>
            </div>
          ))}
          {discrepancies.length === 0 && <div style={{ padding: '16px 14px', fontSize: 11, color: 'var(--text-tertiary)' }}>No discrepancies recorded</div>}
        </div>
      </div>
    </div>
  )
}
