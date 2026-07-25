'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function WarehouseDashboard() {
  const [deliveredPOs, setDeliveredPOs] = useState(0)
  const [stagingPOs, setStagingPOs] = useState(0)
  const [readyForShipmentPOs, setReadyForShipmentPOs] = useState(0)

  const [products, setProducts] = useState([])
  const [warehouseLocations, setWarehouseLocations] = useState([])

  useEffect(() => {
    let active = true

    async function load() {
      const [
        { count: deliveredCount },
        { count: stagingCount },
        { count: readyCount },
        { data: productsData },
        { data: warehouseLocationsData },
      ] = await Promise.all([
        supabase
          .from('purchase_orders')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'delivered'),

        supabase
          .from('purchase_orders')
          .select('*', { count: 'exact', head: true })
          .in('status', ['staging', 'Staging']),

        supabase
          .from('purchase_orders')
          .select('*', { count: 'exact', head: true })
          .in('status', ['ready_for_shipment', 'Ready for Shipment', 'Ready For Shipment']),

        supabase
          .from('products')
          .select('id, product_name, sku, brand, category')
          .order('product_name'),

        supabase
          .from('warehouse_locations')
          .select('id, location_code, description, occupied')
          .order('location_code'),
      ])

      if (!active) return

      setDeliveredPOs(deliveredCount || 0)
      setStagingPOs(stagingCount || 0)
      setReadyForShipmentPOs(readyCount || 0)

      setProducts(productsData || [])
      setWarehouseLocations(warehouseLocationsData || [])
    }

    load()

    return () => {
      active = false
    }
  }, [])

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
        }}
      >
        <div
          style={{
            fontSize: 20,
            fontWeight: 700,
            letterSpacing: '-0.5px',
            color: 'var(--text-primary)',
          }}
        >
          Warehouse Overview
        </div>

        <div
          style={{
            fontSize: 16,
            color: 'var(--text-secondary)',
          }}
        >
          {new Date().toLocaleDateString('en-PH', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </div>
      </div>

      {/* Operational Summary */}
      <div style={{ marginBottom: 24 }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--text-secondary)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            marginBottom: 10,
          }}
        >
          Operational Summary
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 12,
          }}
        >
          <div className="stat-card">
            <div className="stat-val">{deliveredPOs}</div>
            <div className="stat-lbl">Delivered Orders</div>
            <div className="stat-sub">
              Purchase orders successfully received
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-val">{stagingPOs}</div>
            <div className="stat-lbl">Staging Orders</div>
            <div className="stat-sub">
              Awaiting container loading
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-val">{readyForShipmentPOs}</div>
            <div className="stat-lbl">Ready for Shipment</div>
            <div className="stat-sub">
              Ready to be loaded for export
            </div>
          </div>
        </div>
      </div>



      {/* Warehouse Resources */}
      <div>
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--text-secondary)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            marginBottom: 10,
          }}
        >
          Warehouse Resources
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 12,
          }}
        >
<div className="stat-card">
  <div className="stat-val">{warehouseLocations.length}</div>
  <div className="stat-lbl">Warehouse Locations</div>

  <div
    style={{
      marginTop: 16,
      border: '1px solid var(--border)',
      borderRadius: 8,
      overflow: 'hidden',
    }}
  >
    <table
      style={{
        width: '100%',
        borderCollapse: 'collapse',
      }}
    >
      <thead>
        <tr>
          <th
            style={{
              textAlign: 'left',
              padding: '10px 12px',
              fontSize: 12,
              fontWeight: '700',
              color: 'gray',
              textTransform: 'uppercase',
              borderBottom: '1px solid var(--border)',
            }}
          >
            Location Code
          </th>

          <th
            style={{
              textAlign: 'left',
              padding: '10px 12px',
              fontSize: 12,
              fontWeight: '700',
              color: 'gray',
              textTransform: 'uppercase',
              borderBottom: '1px solid var(--border)',
            }}
          >
            Description
          </th>

                    <th
            style={{
              textAlign: 'left',
              padding: '10px 12px',
              fontSize: 12,
              fontWeight: '700',
              color: 'gray',
              textTransform: 'uppercase',
              borderBottom: '1px solid var(--border)',
            }}
          >
            Occupied
          </th>
        </tr>
      </thead>

      <tbody>
        {warehouseLocations.slice(0, 5).map((location) => (
          <tr key={location.id}>
            <td
              style={{
                padding: '10px 12px',
                borderBottom: '1px solid var(--border)',
                fontSize: 13,
                fontWeight: 'bold',
                color: 'var(--text-primary)',
              }}
            >
              {location.location_code}
            </td>

            <td
              style={{
                padding: '10px 12px',
                borderBottom: '1px solid var(--border)',
                fontSize: 13,
                color: 'var(--text-primary)',
              }}
            >
              {location.description}
            </td>

            <td
              style={{
                padding: '10px 12px',
                borderBottom: '1px solid var(--border)',
                fontSize: 13,
                color: 'var(--text-primary)',
              }}
            >
              {location.occupied == true ? 'Occupied' : 'Vacant'}
            </td>
          </tr>
        ))}

        {warehouseLocations.length > 5 && (
          <tr>
            <td
              style={{
                padding: '10px 12px',
                fontSize: 12,
                color: 'var(--text-secondary)',
              }}
            >
              +{warehouseLocations.length - 5} more locations
            </td>
          </tr>
        )}
      </tbody>
    </table>
  </div>
</div>

<div className="stat-card">
  <div className="stat-val">{products.length}</div>
  <div className="stat-lbl">Products</div>

  <div
    style={{
      marginTop: 16,
      border: '1px solid var(--border)',
      borderRadius: 8,
      overflow: 'hidden',
    }}
  >
    <table
      style={{
        width: '100%',
        borderCollapse: 'collapse',
      }}
    >
      <thead>
        <tr>
          <th
            style={{
              textAlign: 'left',
              padding: '10px 12px',
              fontSize: 12,
              fontWeight: '700',
              color: 'gray',
              textTransform: 'uppercase',
              borderBottom: '1px solid var(--border)',
            }}
          >
            Product Name
          </th>

          <th
            style={{
              textAlign: 'left',
              padding: '10px 12px',
              fontSize: 12,
              fontWeight: '700',
              color: 'gray',
              textTransform: 'uppercase',
              borderBottom: '1px solid var(--border)',
            }}
          >
            Brand
          </th>

          <th
            style={{
              textAlign: 'left',
              padding: '10px 12px',
              fontSize: 12,
              fontWeight: '700',
              color: 'gray',
              textTransform: 'uppercase',
              borderBottom: '1px solid var(--border)',
            }}
          >
            SKU
          </th>

          <th
            style={{
              textAlign: 'left',
              padding: '10px 12px',
              fontSize: 12,
              fontWeight: '700',
              color: 'gray',
              textTransform: 'uppercase',
              borderBottom: '1px solid var(--border)',
            }}
          >
            Category
          </th>
        </tr>
      </thead>

      <tbody>
        {products.slice(0, 5).map((product) => (
          <tr key={product.id}>
            <td
              style={{
                padding: '10px 12px',
                borderBottom: '1px solid var(--border)',
                fontSize: 13,
                fontWeight: 'bold',
                color: 'var(--text-primary)',
              }}
            >
              {product.product_name}
            </td>

            <td
              style={{
                padding: '10px 12px',
                borderBottom: '1px solid var(--border)',
                fontSize: 13,
                color: 'var(--text-primary)',
              }}
            >
              {product.brand}
            </td>

            <td
              style={{
                padding: '10px 12px',
                borderBottom: '1px solid var(--border)',
                fontSize: 13,
                color: 'var(--text-primary)',
              }}
            >
              {product.sku}
            </td>

            <td
              style={{
                padding: '10px 12px',
                borderBottom: '1px solid var(--border)',
                fontSize: 13,
                color: 'var(--text-primary)',
              }}
            >
              {product.category}
            </td>
          </tr>
        ))}

        {products.length > 5 && (
          <tr>
            <td
              style={{
                padding: '10px 12px',
                fontSize: 12,
                color: 'var(--text-secondary)',
              }}
            >
              +{products.length - 5} more products
            </td>
          </tr>
        )}
      </tbody>
    </table>
  </div>
</div>
        </div>
      </div>
    </div>




  )
}