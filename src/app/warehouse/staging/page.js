'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { StatusBadge } from '@/components/ui/StatusBadge'

const READY_STATUSES = ['ready_for_shipment', 'Ready for Shipment', 'Ready For Shipment']

export default function StagingPage() {
  const [purchaseOrders, setPurchaseOrders] = useState([])
  const [readyOrders, setReadyOrders] = useState([])
  const [search, setSearch] = useState('')
  const [warehouseLocations, setWarehouseLocations] = useState([])
  const [selectedLocations, setSelectedLocations] = useState({})
  const [message, setMessage] = useState(null)

  async function load() {
    const [{ data: staging, error }, { data: locations }, { data: ready }] =
      await Promise.all([
        supabase
          .from('purchase_orders')
          .select(`
              *,
              suppliers(supplier_name),
              customer_orders(order_number)
            `)
          .eq('status', 'Staging')
          .order('actual_completed_date', { ascending: false }),

        // Only free, active slots — assigning an occupied one would silently
        // steal it from the purchase order already stored there.
        supabase
          .from('warehouse_locations')
          .select('id, location_code')
          .eq('occupied', false)
          .eq('is_active', true)
          .order('location_code'),

        supabase
          .from('purchase_orders')
          .select(`
              *,
              suppliers(supplier_name),
              customer_orders(order_number),
              warehouse_locations(location_code)
            `)
          .in('status', READY_STATUSES)
          .order('actual_completed_date', { ascending: false }),
      ])

    if (error) {
      setMessage({ type: 'error', text: `Could not load staging queue: ${error.message}` })
      return
    }

    setPurchaseOrders(staging ?? [])
    setWarehouseLocations(locations ?? [])
    setReadyOrders(ready ?? [])
  }

  useEffect(() => {
    load()
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

async function confirmStaging(poId) {
  const locationId = selectedLocations[poId]

  if (!locationId) {
    setMessage({ type: 'error', text: 'Select a warehouse location before confirming.' })
    return
  }

  setMessage(null)

  // Claim the location first: if this fails, nothing else has changed yet.
  const { error: locationError } = await supabase
    .from('warehouse_locations')
    .update({
      occupied: true,
      purchase_order_id: poId,
    })
    .eq('id', locationId)

  if (locationError) {
    setMessage({ type: 'error', text: `Could not assign the location: ${locationError.message}` })
    return
  }

  // Update purchase order
  const { error } = await supabase
    .from('purchase_orders')
    .update({
      status: 'Ready for Shipment',
    })
    .eq('id', poId)

  if (error) {
    // Release the slot we just claimed so it does not stay locked.
    await supabase
      .from('warehouse_locations')
      .update({ occupied: false, purchase_order_id: null })
      .eq('id', locationId)
    setMessage({ type: 'error', text: `Could not update the purchase order: ${error.message}` })
    return
  }

  // Update all purchase order items
  const { error: itemsError } = await supabase
    .from('purchase_order_items')
    .update({
      status: 'Ready for Shipment',
    })
    .eq('purchase_order_id', poId)

  if (itemsError) {
    setMessage({ type: 'error', text: `Purchase order staged, but its items could not be updated: ${itemsError.message}` })
  } else {
    setMessage({ type: 'success', text: 'Staging confirmed — the purchase order is now ready for shipment.' })
  }

  // Reload so the PO moves from the staging queue into the ready list and the
  // location drops out of the available slots.
  setSelectedLocations((prev) => {
    const next = { ...prev }
    delete next[poId]
    return next
  })
  await load()
}

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
          <div
            style={{
              fontSize: 20,
              fontWeight: 700,
              letterSpacing: '-0.5px',
              color: 'var(--text-primary)',
            }}
          >
            Staging
          </div>

          <div
            style={{
              fontSize: 13,
              color: 'var(--text-secondary)',
              marginTop: 4,
            }}
          >
            Purchase orders ready for staging.
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

      {message && (
        <div
          className="card card-pad"
          style={{
            marginBottom: 16,
            fontSize: 13,
            color: message.type === 'error' ? '#b91c1c' : 'var(--text-primary)',
            background: message.type === 'error' ? '#fef2f2' : '#fff',
          }}
        >
          {message.type === 'error' ? '' : '✓ '}{message.text}
        </div>
      )}

      <div className="card">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th className="table-th">PO #</th>
              <th className="table-th">Order</th>
              <th className="table-th">Supplier</th>
              <th className="table-th">Completed</th>
              <th className="table-th">Warehouse Location</th>
              <th className="table-th">Status</th>
              <th className="table-th">Action</th>
            </tr>
                      </thead>

                      <tbody>
                        {displayed.map((po) => (
            <tr key={po.id}>
              <td className="table-td">
                <span className="td-primary">
                  {po.po_number}
                </span>
              </td>

              <td className="table-td">
                {po.customer_orders?.order_number}
              </td>

              <td className="table-td">
                {po.suppliers?.supplier_name}
              </td>

              <td className="table-td">
                {po.actual_completed_date || '-'}
              </td>

              <td className="table-td">
                <select
                  className="input"
                  value={selectedLocations[po.id] || ''}
                  onChange={(e) =>
                    setSelectedLocations(prev => ({
                      ...prev,
                      [po.id]: e.target.value,
                    }))
                  }
                >
                  <option value="">Select location</option>

                  {warehouseLocations.map(location => (
                    <option
                      key={location.id}
                      value={location.id}
                    >
                      {location.location_code}
                    </option>
                  ))}
                </select>
              </td>

              <td className="table-td">
                <StatusBadge status={po.status} />
              </td>

              <td className="table-td">
                <button
                  className="rounded bg-green-600 px-3 py-2 text-xs font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-400"
                  disabled={!selectedLocations[po.id]}
                  onClick={() => confirmStaging(po.id)}
                >
                  Confirm
                </button>
              </td>
            </tr>
            ))}

            {displayed.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="table-td"
                  style={{
                    textAlign: 'center',
                    padding: 32,
                  }}
                >
                  No purchase orders currently in staging.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Where confirmed items land — previously only a count on the dashboard */}
      <div style={{ marginTop: 28 }}>
        <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.3px', color: 'var(--text-primary)' }}>
          Ready for shipment
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4, marginBottom: 12 }}>
          Staged and awaiting container loading.
        </div>

        <div className="card">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th className="table-th">PO #</th>
                <th className="table-th">Order</th>
                <th className="table-th">Supplier</th>
                <th className="table-th">Location</th>
                <th className="table-th">Status</th>
              </tr>
            </thead>
            <tbody>
              {readyOrders.map((po) => (
                <tr key={po.id}>
                  <td className="table-td"><span className="td-primary">{po.po_number}</span></td>
                  <td className="table-td">{po.customer_orders?.order_number}</td>
                  <td className="table-td">{po.suppliers?.supplier_name}</td>
                  <td className="table-td">{po.warehouse_locations?.[0]?.location_code || '—'}</td>
                  <td className="table-td"><StatusBadge status={po.status} /></td>
                </tr>
              ))}

              {readyOrders.length === 0 && (
                <tr>
                  <td colSpan={5} className="table-td" style={{ textAlign: 'center', padding: 32 }}>
                    Nothing staged yet. Confirmed purchase orders appear here.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
