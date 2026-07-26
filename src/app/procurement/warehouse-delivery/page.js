'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { useRouter } from 'next/navigation'

export default function LogDeliveryPage() {
  const router = useRouter()

  const [purchaseOrders, setPurchaseOrders] = useState([])
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [selectedPO, setSelectedPO] = useState(null)
  const [showReceiveModal, setShowReceiveModal] = useState(false)
  const [items, setItems] = useState([])
  const [loadingItems, setLoadingItems] = useState(false)

  useEffect(() => {
    let active = true

    async function load() {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select(`
          *,
          suppliers(supplier_name),
          customer_orders(order_number)
        `)
        .eq('status', 'delivered')
        .order('actual_completed_date', { ascending: false })

      if (error) {
        console.error(error)
        return
      }

      if (active) setPurchaseOrders(data ?? [])
    }

    load()

    return () => {
      active = false
    }
  }, [])

  const displayed = useMemo(() => {
    const q = search.toLowerCase().trim()

    if (!q) return purchaseOrders

    return purchaseOrders.filter((po) =>
      po.po_number?.toLowerCase().includes(q) ||
      po.customer_orders?.order_number?.toLowerCase().includes(q) ||
      po.suppliers?.supplier_name?.toLowerCase().includes(q)
    )
  }, [purchaseOrders, search])


  return (
    <div style={{ maxWidth: '100%' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 20,
        }}
      >
        <div>
          <div style={{fontSize: 20, fontWeight: 700, letterSpacing: '-0.5px', color: 'var(--text-primary)'}}>
            Warehouse Delivery Status
          </div>

          <div style={{fontSize: 13, color: 'var(--text-secondary)', marginTop: 4}}>
            View purchase orders status and check whather it has been received (delivered/partially delivered)
          </div>
        </div>

        <input
          type="text"
          className="input"
          placeholder="Search PO #, supplier, order..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: 260 }}
        />
      </div>

      <div className="card">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th className="table-th">PO #</th>
              <th className="table-th">Order</th>
              <th className="table-th">Supplier</th>
              <th className="table-th">Status</th>
            </tr>
          </thead>

          <tbody>
            {displayed.map((po) => (
              <tr key={po.id}>
                <td className="table-td"><span className="td-primary">{po.po_number}</span></td>
                <td className="table-td">{po.customer_orders?.order_number}</td>
                <td className="table-td">{po.suppliers?.supplier_name}</td>
                <td className="table-td"><StatusBadge status={po.status}/></td>
              </tr>
            ))}

            {displayed.length === 0 && (
              <tr>
                <td colSpan={6} className="table-td" style={{ textAlign: 'center', padding: 32 }}>
                  No delivered purchase orders found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
