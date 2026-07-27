'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function WarehouseLocationsPage() {
  const [locations, setLocations] = useState([])
  const [search, setSearch] = useState('')

  useEffect(() => {
    let active = true

    async function load() {
      const { data, error } = await supabase
        .from('warehouse_locations')
        .select('*')
        .order('location_code')

      if (error) {
        console.error(error)
        return
      }

      // warehouse_locations.purchase_order_id has no foreign key, so the
      // purchase orders can't be embedded — look them up and attach in code
      // to show a readable PO number instead of a raw id.
      const poIds = [...new Set((data ?? []).map((l) => l.purchase_order_id).filter(Boolean))]
      let poById = {}
      if (poIds.length) {
        const { data: pos } = await supabase
          .from('purchase_orders')
          .select('id, po_number, suppliers(supplier_name), customer_orders(order_number)')
          .in('id', poIds)
        poById = Object.fromEntries((pos ?? []).map((po) => [po.id, po]))
      }

      if (active) {
        setLocations((data ?? []).map((l) => ({
          ...l,
          purchase_orders: l.purchase_order_id ? poById[l.purchase_order_id] || null : null,
        })))
      }
    }

    load()

    return () => {
      active = false
    }
  }, [])

  const displayed = useMemo(() => {
    const q = search.toLowerCase().trim()

    if (!q) return locations

    return locations.filter(
      (location) =>
        location.location_code?.toLowerCase().includes(q) ||
        location.description?.toLowerCase().includes(q) ||
        location.purchase_orders?.po_number?.toLowerCase().includes(q) ||
        location.purchase_orders?.suppliers?.supplier_name?.toLowerCase().includes(q)
    )
  }, [locations, search])

  async function clearLocation(locationId) {
    const { error } = await supabase
        .from('warehouse_locations')
        .update({
        purchase_order_id: null,
        occupied: false,
        })
        .eq('id', locationId)

    if (error) {
        console.error(error)
        return
    }

    setLocations(prev =>
        prev.map(location =>
        location.id === locationId
            ? {
                ...location,
                purchase_order_id: null,
                purchase_orders: null,
                occupied: false,
            }
            : location
        )
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
            Warehouse Locations
          </div>

          <div
            style={{
              fontSize: 13,
              color: 'var(--text-secondary)',
              marginTop: 4,
            }}
          >
            Manage warehouse storage locations.
          </div>
        </div>

        <input
          type="text"
          className="input"
          placeholder="Search location..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: 260 }}
        />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
          gap: 18,
        }}
      >
        {displayed.map((location) => (
          <div
            key={location.id}
            style={{
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: 18,
              background: location.occupied ? '#374151' : '#fff',
              color: location.occupied ? '#fff' : 'var(--text-primary)',
              transition: '.2s',
            }}
          >
<div
  style={{
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  }}
>
  <div
    style={{
      fontSize: 22,
      fontWeight: 700,
    }}
  >
    {location.location_code}
  </div>

  <span
    style={{
      padding: '4px 10px',
      borderRadius: 999,
      fontSize: 11,
      fontWeight: 600,
      background: location.occupied ? '#dc2626' : '#16a34a',
      color: '#fff',
      whiteSpace: 'nowrap',
    }}
  >
    {location.occupied ? 'Occupied' : 'Available'}
  </span>
</div>

            <div
              style={{
                fontSize: 13,
                opacity: .85,
                minHeight: 42,
                marginBottom: 0,
              }}
            >
              {location.description || 'No description'}
            </div>


            {location.purchase_order_id && (
            <div
                style={{
                marginTop: 0,
                padding: 10,
                borderRadius: 8,
                background: location.occupied
                    ? 'rgba(255,255,255,.12)'
                    : '#f3f4f6',
                }}
            >
                <div
                style={{
                    fontSize: 11,
                    opacity: .8,
                    marginBottom: 4,
                }}
                >
                Purchase Order
                </div>

                <div
                style={{
                    fontSize: 13,
                    fontWeight: 600,
                    marginBottom: 2,
                }}
                >
                {location.purchase_orders?.po_number || 'Unknown PO'}
                </div>

                <div
                style={{
                    fontSize: 11,
                    opacity: .8,
                    marginBottom: 10,
                }}
                >
                {[
                  location.purchase_orders?.suppliers?.supplier_name,
                  location.purchase_orders?.customer_orders?.order_number,
                ].filter(Boolean).join(' · ') || '—'}
                </div>

                <button
                onClick={() => clearLocation(location.id)}
                style={{
                    width: '100%',
                    padding: '8px',
                    border: 'none',
                    borderRadius: 6,
                    background: '#dc2626',
                    color: '#fff',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 600,
                }}
                >
                Clear
                </button>
            </div>
            )}
                    </div>
        ))}

        {displayed.length === 0 && (
          <div
            style={{
              gridColumn: '1 / -1',
              textAlign: 'center',
              padding: 48,
              border: '1px dashed var(--border)',
              borderRadius: 12,
              color: 'var(--text-secondary)',
            }}
          >
            No warehouse locations found.
          </div>
        )}
      </div>
    </div>
  )
}