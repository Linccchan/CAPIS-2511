'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function StockPage() {
  const [batches, setBatches] = useState([])
  const [locations, setLocations] = useState([])

  useEffect(() => {
    let active = true
    async function load() {
      const [{ data: batchData }, { data: locationData }] = await Promise.all([
        supabase
          .from('inventory_batches')
          .select('*, products(product_name, sku, unit), warehouse_locations(location_code), customer_orders(order_number, status), staging_tasks(status)')
          .gt('quantity_available', 0)
          .order('received_date', { ascending: false }),
        supabase
          .from('warehouse_locations')
          .select('*, inventory_batches(quantity_available)')
          .eq('is_active', true)
          .order('location_code'),
      ])
      if (!active) return
      setBatches(batchData || [])
      setLocations(locationData || [])
    }
    load()
    return () => {
      active = false
    }
  }, [])

  const zones = {}
  locations.forEach((location) => {
    const zone = location.location_code.split('-')[0] || 'X'
    zones[zone] = [...(zones[zone] || []), location]
  })

  const getLocationStatus = (location) => {
    const qty = location.inventory_batches?.reduce((sum, batch) => sum + batch.quantity_available, 0) || 0
    return qty > 0 ? 'occupied' : 'empty'
  }

  const getBatchStatus = (batch) => {
    if (batch.staging_tasks?.some((task) => task.status === 'completed')) return 'Staged'
    if (batch.staging_tasks?.some((task) => task.status === 'in_progress')) return 'Stickering'
    return 'Received'
  }

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.5px', color: 'var(--text-primary)' }}>Stock & warehouse locations</div>
        </div>
        <input type="text" className="input" placeholder="Find product..." style={{ width: 200 }} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14, marginBottom: 20 }}>
        {Object.entries(zones).map(([zone, locs]) => (
          <div key={zone} className="card card-pad">
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>Zone {zone} - Rack map</div>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 12 }}>Dark = occupied - White = empty</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
              {locs.map((location) => {
                const status = getLocationStatus(location)
                return (
                  <div
                    key={location.id}
                    title={location.location_code}
                    style={{
                      background: status === 'occupied' ? 'var(--accent)' : 'var(--bg)',
                      color: status === 'empty' ? 'var(--text-tertiary)' : '#fff',
                      borderRadius: 4,
                      padding: '6px 4px',
                      textAlign: 'center',
                      fontSize: 10,
                      fontWeight: 500,
                      border: '1px solid var(--border)',
                    }}
                  >
                    {location.location_code.replace(`${zone}-`, '')}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

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
            {batches.map((batch) => {
              const status = getBatchStatus(batch)
              return (
                <tr key={batch.id}>
                  <td className="table-td">
                    <div className="td-primary">{batch.products?.product_name}</div>
                    <div style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--text-tertiary)' }}>{batch.products?.sku}</div>
                  </td>
                  <td className="table-td">{batch.customer_orders?.order_number || '-'}</td>
                  <td className="table-td" style={{ textAlign: 'right', fontWeight: 500 }}>{batch.quantity_available} {batch.products?.unit}</td>
                  <td className="table-td">{batch.warehouse_locations?.location_code || 'Unassigned'}</td>
                  <td className="table-td"><span className={`badge ${status === 'Staged' ? 'badge-dark' : status === 'Stickering' ? 'badge-yellow' : 'badge-gray'}`}>{status}</span></td>
                  <td className="table-td">{batch.received_date || '-'}</td>
                </tr>
              )
            })}
            {batches.length === 0 && <tr><td colSpan={6} className="table-td" style={{ textAlign: 'center', padding: 32 }}>No stock in warehouse</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
