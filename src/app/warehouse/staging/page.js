'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { StatusBadge } from '@/components/ui/StatusBadge'

export default function StagingPage() {
  const [purchaseOrders, setPurchaseOrders] = useState([])
  const [search, setSearch] = useState('')
  const [warehouseLocations, setWarehouseLocations] = useState([])
const [selectedLocations, setSelectedLocations] = useState({})

  useEffect(() => {
    let active = true

    async function load() {
      const [{ data: purchaseOrders, error }, { data: locations }] =
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

          supabase
            .from('warehouse_locations')
            .select('id, location_code')
            .order('location_code')
        ])

      if (error) {
        console.error(error)
        return
      }

      if (active) {
        setPurchaseOrders(purchaseOrders ?? [])
        setWarehouseLocations(locations ?? [])
      }
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

    async function confirmStaging(poId) {
      const locationId = selectedLocations[poId]

      if (!locationId) return

      // Update purchase order
      const { error } = await supabase
        .from('purchase_orders')
        .update({
          status: 'Ready for Shipment',
        })
        .eq('id', poId)

      if (error) {
        console.error(error)
        return
      }

      // Update all purchase order items for this PO
      const { error: itemsError } = await supabase
        .from('purchase_order_items')
        .update({
          status: 'Ready for Shipment',
        })
        .eq('purchase_order_id', poId)

      if (itemsError) {
        console.error(itemsError)
        return
      }

      // Remove the PO from the current table
      setPurchaseOrders(prev =>
        prev.filter(po => po.id !== poId)
      )
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
    </div>
  )
}