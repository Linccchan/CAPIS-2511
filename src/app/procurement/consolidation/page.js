'use client'

import { useEffect, useMemo, useState } from 'react'
import { formatDate } from '@/lib/orderManagement'
import { supabase } from '@/lib/supabaseClient'
import {
  Badge,
  Card,
  EmptyState,
  OrderShell,
  TableSkeleton,
  statusTone,
} from '@/components/order-management/ui'

const statuses = [
  { value: 'submitted', label: 'Submitted' },
]

export default function ConsolidationPage() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
    const [selectedOrderId, setSelectedOrderId] = useState('')
    const [purchaseOrders, setPurchaseOrders] = useState([])

  useEffect(() => {
    let active = true

    async function loadOrders() {
        const { data, error } = await supabase
            .from('customer_orders')
            .select(`
                id,
                order_number,
                status,
                order_date,
                preferred_ship_date,
                estimated_ready_date,
                destination_country,
                customers (
                    company_name
                )
            `)
            .order('created_at', { ascending: false })

      if (!active) return

      if (error) {
        console.error(error)
        setOrders([])
      } else {
        setOrders(data || [])
      }

      setLoading(false)
    }

    loadOrders()

    return () => {
      active = false
    }
  }, [])



useEffect(() => {
  if (!selectedOrderId) {
    setPurchaseOrders([])
    return
  }

  let active = true

  async function loadPurchaseOrders() {
    const { data, error } = await supabase
        .from('purchase_orders')
        .select(`
            id,
            po_number,
            status,
            issued_date,
            expected_delivery_date,
            actual_completed_date,
            suppliers (
            supplier_name
            ),
            purchase_order_items (
            id,
            quantity_ordered,
            quantity_received,
            status,
            products (
                product_name,
                sku
            )
            )
        `)
        .eq('order_id', selectedOrderId)
        .order('created_at', { ascending: true })

    if (!active) return

    if (error) {
      console.error(error)
      setPurchaseOrders([])
    } else {
      setPurchaseOrders(data || [])
    }
  }

  loadPurchaseOrders()

  return () => {
    active = false
  }
}, [selectedOrderId])


  const selectedOrder = useMemo(() => {
    return (
        orders.find(
        (order) => order.id === selectedOrderId
        ) ?? null
    )
    }, [orders, selectedOrderId])

  return (
    <OrderShell
      title="Consolidation"
      description="Select a customer order to monitor linked purchase orders and supplier delivery progress."
    >



    <Card>
    <div className="mb-2 flex items-center justify-between pb-2">
        <h2 className="text-lg font-semibold text-gray-900">
        Select a Customer
        </h2>

        <select
            value={selectedOrderId}
            onChange={(e) => setSelectedOrderId(e.target.value)}
            className="w-90 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
        >
            <option value="">
                Select a customer order
            </option>

            {orders.map((order) => (
                <option key={order.id} value={order.id}>
                {order.order_number} • {order.customers?.company_name}
                </option>
            ))}
        </select>
    </div>

        
{!selectedOrder ? (
  <EmptyState
    title="Select a customer order"
    description="Choose a customer order to view its procurement progress."
  />
) : (
  <Card title="Customer Order Information">

    <div className="grid grid-cols-3 gap-6">

      <div>
        <p className="text-xs uppercase text-gray-400">
          Customer
        </p>

        <p className="mt-1 font-medium">
          {selectedOrder.customers?.company_name}
        </p>
      </div>

      <div>
        <p className="text-xs uppercase text-gray-400">
          Destination
        </p>

        <p className="mt-1 font-medium">
          {selectedOrder.destination_country}
        </p>
      </div>

      <div>
        <p className="text-xs uppercase text-gray-400">
          Order Date
        </p>

        <p className="mt-1">
          {formatDate(selectedOrder.order_date)}
        </p>
      </div>

      <div>
        <p className="text-xs uppercase text-gray-400">
          Status
        </p>

        <Badge tone={statusTone(selectedOrder.status)}>
          {selectedOrder.status}
        </Badge>
      </div>

      <div>
        <p className="text-xs uppercase text-gray-400">
          Preferred Ship Date
        </p>

        <p className="mt-1">
          {formatDate(selectedOrder.preferred_ship_date)}
        </p>
      </div>

      <div>
        <p className="text-xs uppercase text-gray-400">
          Estimated Ready Date
        </p>

        <p className="mt-1">
          {formatDate(selectedOrder.estimated_ready_date)}
        </p>
      </div>

    </div>

  </Card>
)}

<div className='py-2'/>

{selectedOrder && (
  <Card title="Linked Purchase Orders">
    {purchaseOrders.length === 0 ? (
      <EmptyState
        title="No Purchase Orders"
        description="No purchase orders have been created for this customer order."
      />
    ) : (
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-100 text-xs uppercase text-gray-400">
            <tr>
              <th className="py-3 pr-4">PO Number</th>
              <th className="py-3 pr-4">Supplier</th>
              <th className="py-3 pr-4">Status</th>
              <th className="py-3 pr-4">Issued Date</th>
              <th className="py-3 pr-4">Expected Delivery</th>
              <th className="py-3 pr-4">Completed</th>
              <th className="py-3 pr-4">Items</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100">
            {purchaseOrders.map((po) => (
              <tr key={po.id}>
                <td className="py-3 pr-4 font-medium">
                  {po.po_number}
                </td>

                <td className="py-3 pr-4">
                  {po.suppliers?.supplier_name}
                </td>

                <td className="py-3 pr-4">
                  <Badge tone={statusTone(po.status)}>
                    {po.status}
                  </Badge>
                </td>

                <td className="py-3 pr-4">
                  {formatDate(po.issued_date)}
                </td>

                <td className="py-3 pr-4">
                  {formatDate(po.expected_delivery_date)}
                </td>

                <td className="py-3 pr-4">
                  {formatDate(po.actual_completed_date)}
                </td>

                <td className="py-3 pr-4">
  <div className="space-y-2">
    {po.purchase_order_items?.map((item) => (
      <div
        key={item.id}
        className="rounded border border-gray-200 bg-gray-50 p-2 text-xs"
      >
        <div className="font-medium">
          {item.products?.product_name}
        </div>

        <div className="text-gray-500">
          SKU: {item.products?.sku}
        </div>

        <div className="mt-1">
          {item.quantity_received} / {item.quantity_ordered} received
        </div>
      </div>
    ))}
  </div>
</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </Card>
)}



      </Card>


    </OrderShell>
  )
}