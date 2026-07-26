'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function ProcurementDashboard() {
  const [suppliers, setSuppliers] = useState([])
  const [purchaseOrders, setPurchaseOrders] = useState([])

  const [totalSuppliers, setTotalSuppliers] = useState(0)
  const [totalPOs, setTotalPOs] = useState(0)
  const [deliveredPOs, setDeliveredPOs] = useState(0)

  useEffect(() => {
    let active = true

    async function load() {
      const [
        { count: supplierCount, data: suppliersData },
        { count: poCount, data: purchaseOrdersData },
        { count: deliveredCount },
      ] = await Promise.all([
        supabase
          .from('suppliers')
          .select('*', { count: 'exact' })
          .order('supplier_name'),

        supabase
          .from('purchase_orders')
          .select(
            `
              *,
              suppliers (
                supplier_name
              )
            `,
            { count: 'exact' }
          )
          .order('created_at', { ascending: false }),

        supabase
          .from('purchase_orders')
          .select('*', { count: 'exact', head: true })
          .in('status', [
            'sent',
            'Sent',
            'confirmed',
            'Confirmed',
          ]),

        supabase
          .from('purchase_orders')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'delivered'),
      ])

      if (!active) return

      setTotalSuppliers(supplierCount || 0)
      setTotalPOs(poCount || 0)
      setDeliveredPOs(deliveredCount || 0)

      setSuppliers(suppliersData || [])
      setPurchaseOrders(purchaseOrdersData || [])
    }

    load()

    return () => {
      active = false
    }
  }, [])

  return (
    <div>
      {/* Header */}
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
          Procurement Overview
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
            <div className="stat-val">{totalSuppliers}</div>
            <div className="stat-lbl">Suppliers</div>
            <div className="stat-sub">
              Registered supplier records
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-val">{totalPOs}</div>
            <div className="stat-lbl">Purchase Orders</div>
            <div className="stat-sub">
              Total purchase orders created
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-val">{deliveredPOs}</div>
            <div className="stat-lbl">Delivered Orders</div>
            <div className="stat-sub">
              Successfully completed purchase orders
            </div>
          </div>
        </div>
      </div>

      {/* Procurement Resources */}
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
          Procurement Resources
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 12,
          }}
        >
          {/* Suppliers */}
          <div className="stat-card">
            <div className="stat-val">{suppliers.length}</div>
            <div className="stat-lbl">Suppliers</div>

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
                        fontWeight: 700,
                        color: 'gray',
                        textTransform: 'uppercase',
                        borderBottom: '1px solid var(--border)',
                      }}
                    >
                      Supplier
                    </th>

                    <th
                      style={{
                        textAlign: 'left',
                        padding: '10px 12px',
                        fontSize: 12,
                        fontWeight: 700,
                        color: 'gray',
                        textTransform: 'uppercase',
                        borderBottom: '1px solid var(--border)',
                      }}
                    >
                      Contact
                    </th>

                    <th
                      style={{
                        textAlign: 'left',
                        padding: '10px 12px',
                        fontSize: 12,
                        fontWeight: 700,
                        color: 'gray',
                        textTransform: 'uppercase',
                        borderBottom: '1px solid var(--border)',
                      }}
                    >
                      Email
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {suppliers.slice(0, 5).map((supplier) => (
                    <tr key={supplier.id}>
                      <td
                        style={{
                          padding: '10px 12px',
                          borderBottom: '1px solid var(--border)',
                          fontSize: 13,
                          fontWeight: 'bold',
                        }}
                      >
                        {supplier.supplier_name}
                      </td>

                      <td
                        style={{
                          padding: '10px 12px',
                          borderBottom: '1px solid var(--border)',
                          fontSize: 13,
                        }}
                      >
                        {supplier.contact_person}
                      </td>

                      <td
                        style={{
                          padding: '10px 12px',
                          borderBottom: '1px solid var(--border)',
                          fontSize: 13,
                        }}
                      >
                        {supplier.email}
                      </td>
                    </tr>
                  ))}

                  {suppliers.length > 5 && (
                    <tr>
                      <td
                        style={{
                          padding: '10px 12px',
                          fontSize: 12,
                          color: 'var(--text-secondary)',
                        }}
                      >
                        +{suppliers.length - 5} more suppliers
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Purchase Orders */}
          <div className="stat-card">
            <div className="stat-val">{purchaseOrders.length}</div>
            <div className="stat-lbl">Recent Purchase Orders</div>

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
                        fontWeight: 700,
                        color: 'gray',
                        textTransform: 'uppercase',
                        borderBottom: '1px solid var(--border)',
                      }}
                    >
                      PO Number
                    </th>

                    <th
                      style={{
                        textAlign: 'left',
                        padding: '10px 12px',
                        fontSize: 12,
                        fontWeight: 700,
                        color: 'gray',
                        textTransform: 'uppercase',
                        borderBottom: '1px solid var(--border)',
                      }}
                    >
                      Supplier
                    </th>

                    <th
                      style={{
                        textAlign: 'left',
                        padding: '10px 12px',
                        fontSize: 12,
                        fontWeight: 700,
                        color: 'gray',
                        textTransform: 'uppercase',
                        borderBottom: '1px solid var(--border)',
                      }}
                    >
                      Status
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {purchaseOrders.slice(0, 5).map((po) => (
                    <tr key={po.id}>
                      <td
                        style={{
                          padding: '10px 12px',
                          borderBottom: '1px solid var(--border)',
                          fontSize: 13,
                          fontWeight: 'bold',
                        }}
                      >
                        {po.po_number}
                      </td>

                      <td
                        style={{
                          padding: '10px 12px',
                          borderBottom: '1px solid var(--border)',
                          fontSize: 13,
                        }}
                      >
                        {po.suppliers?.supplier_name ?? '-'}
                      </td>

                      <td
                        style={{
                          padding: '10px 12px',
                          borderBottom: '1px solid var(--border)',
                          fontSize: 13,
                          textTransform: 'capitalize',
                        }}
                      >
                        {po.status}
                      </td>
                    </tr>
                  ))}

                  {purchaseOrders.length > 5 && (
                    <tr>
                      <td
                        style={{
                          padding: '10px 12px',
                          fontSize: 12,
                          color: 'var(--text-secondary)',
                        }}
                      >
                        +{purchaseOrders.length - 5} more purchase orders
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