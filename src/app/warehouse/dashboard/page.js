'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { StatusBadge } from '@/components/ui/StatusBadge'

export default function WarehouseDashboard() {
  const [expectedDeliveries, setExpectedDeliveries] = useState([])
  const [pendingConfirmations, setPendingConfirmations] = useState([])
  const [stickerTasks, setStickerTasks] = useState([])
  const [warehouseSkus, setWarehouseSkus] = useState(0)
  const [stagedSkus, setStagedSkus] = useState(0)

  useEffect(() => {
    let active = true
    async function load() {
      const today = new Date().toISOString().split('T')[0]
      const [
        { data: expected },
        { data: pending },
        { data: tasks },
        { count: stockCount },
        { count: stagedCount },
      ] = await Promise.all([
        supabase
          .from('supplier_deliveries')
          .select('*, suppliers(supplier_name), purchase_orders(id, po_number, customer_orders(order_number))')
          .eq('delivery_date', today)
          .neq('delivery_status', 'received'),
        supabase
          .from('supplier_deliveries')
          .select('*, suppliers(supplier_name), purchase_orders(id, po_number, customer_orders(order_number))')
          .eq('delivery_status', 'pending_confirmation'),
        supabase
          .from('labeling_tasks')
          .select('*, products(product_name), customer_orders(order_number)')
          .in('status', ['pending', 'in_progress']),
        supabase.from('inventory_batches').select('*', { count: 'exact', head: true }).gt('quantity_available', 0),
        supabase.from('staging_tasks').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
      ])
      if (!active) return
      setExpectedDeliveries(expected || [])
      setPendingConfirmations(pending || [])
      setStickerTasks(tasks || [])
      setWarehouseSkus(stockCount || 0)
      setStagedSkus(stagedCount || 0)
    }
    load()
    return () => {
      active = false
    }
  }, [])

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.5px', color: 'var(--text-primary)' }}>Warehouse overview</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
          {new Date().toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} - {expectedDeliveries.length} deliveries expected today
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        <div className="stat-card"><div className="stat-val">{warehouseSkus}</div><div className="stat-lbl">SKUs in warehouse</div><div className="stat-sub">Across active orders</div></div>
        <div className="stat-card"><div className="stat-val">{expectedDeliveries.length}</div><div className="stat-lbl">Expected deliveries today</div><div className="stat-sub">Pending receipt</div></div>
        <div className="stat-card"><div className="stat-val">{pendingConfirmations.length}</div><div className="stat-lbl">Pending confirmation</div><div className="stat-sub">Supplier dispatched, needs WH sign-off</div></div>
        <div className="stat-card"><div className="stat-val">{stagedSkus}</div><div className="stat-lbl">SKUs staged for loading</div><div className="stat-sub">Ready for container</div></div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="card">
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
            Expected deliveries today
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th className="table-th">PO #</th>
                <th className="table-th">Supplier</th>
                <th className="table-th">For order</th>
                <th className="table-th">Action</th>
              </tr>
            </thead>
            <tbody>
              {expectedDeliveries.map((delivery) => {
                const po = delivery.purchase_orders
                return (
                  <tr key={delivery.id}>
                    <td className="table-td"><span className="td-primary">{po?.po_number}</span></td>
                    <td className="table-td">{delivery.suppliers?.supplier_name}</td>
                    <td className="table-td">{po?.customer_orders?.order_number}</td>
                    <td className="table-td"><Link href={`/warehouse/log-delivery/${po?.id}`} className="btn btn-sm btn-primary">Log delivery</Link></td>
                  </tr>
                )
              })}
              {expectedDeliveries.length === 0 && <tr><td colSpan={4} className="table-td" style={{ textAlign: 'center', padding: 24 }}>No deliveries scheduled today</td></tr>}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="card">
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
              Sticker tasks
            </div>
            {stickerTasks.map((task) => {
              const pct = task.required_quantity > 0 ? Math.round((task.completed_quantity / task.required_quantity) * 100) : 0
              return (
                <div key={task.id} style={{ padding: '10px 14px', borderBottom: '1px solid var(--bg)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>Apply stickers - {task.products?.product_name}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 1 }}>{task.customer_orders?.order_number} - {task.required_quantity} units</div>
                    </div>
                    <StatusBadge status={task.status} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, height: 4, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ height: '100%', background: 'var(--accent)', borderRadius: 99, width: `${pct}%` }} />
                    </div>
                    <span style={{ fontSize: 10, color: 'var(--text-secondary)', minWidth: 60 }}>{task.completed_quantity}/{task.required_quantity}</span>
                  </div>
                </div>
              )
            })}
            {stickerTasks.length === 0 && <div style={{ padding: '16px 14px', fontSize: 11, color: 'var(--text-tertiary)' }}>No sticker tasks pending</div>}
          </div>

          <div className="card">
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
              Pending confirmations
            </div>
            {pendingConfirmations.map((delivery) => {
              const po = delivery.purchase_orders
              return (
                <div key={delivery.id} style={{ padding: '10px 14px', borderBottom: '1px solid var(--bg)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>{po?.po_number} - {delivery.suppliers?.supplier_name}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 1 }}>Supplier logged dispatch {delivery.delivery_date}</div>
                  </div>
                  <Link href={`/warehouse/log-delivery/${po?.id}`} className="btn btn-sm btn-primary">Confirm now</Link>
                </div>
              )
            })}
            {pendingConfirmations.length === 0 && <div style={{ padding: '14px', fontSize: 11, color: 'var(--text-tertiary)' }}>No pending confirmations</div>}
          </div>
        </div>
      </div>
    </div>
  )
}
