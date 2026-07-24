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

      if (active) setLocations(data ?? [])
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
        location.description?.toLowerCase().includes(q)
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
                fontSize: 22,
                fontWeight: 700,
                marginBottom: 6,
              }}
            >
              {location.location_code}
            </div>

            <div
              style={{
                fontSize: 13,
                opacity: .85,
                minHeight: 42,
                marginBottom: 18,
              }}
            >
              {location.description || 'No description'}
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span
                style={{
                  fontSize: 12,
                  color: location.occupied ? '#d1d5db' : '#6b7280',
                }}
              >
                Status
              </span>

              <span
                style={{
                  padding: '4px 10px',
                  borderRadius: 999,
                  fontSize: 11,
                  fontWeight: 600,
                  background: location.occupied
                    ? '#dc2626'
                    : '#16a34a',
                  color: '#fff',
                }}
              >
                {location.occupied ? 'Occupied' : 'Available'}
              </span>
            </div>

            {location.purchase_order_id && (
            <div
                style={{
                marginTop: 16,
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
                    fontSize: 12,
                    fontFamily: 'monospace',
                    wordBreak: 'break-all',
                    marginBottom: 10,
                }}
                >
                {location.purchase_order_id}
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