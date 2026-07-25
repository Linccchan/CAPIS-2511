'use client'

import { useEffect, useMemo, useState } from 'react'
import { fetchOrderManagementData } from '@/lib/orderManagement'
import { Badge, Card, EmptyState, OrderShell, TableSkeleton, statusTone, useToast } from '@/components/order-management/ui'

export default function SupplierDeliveriesPage() {
  const toast = useToast()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        setData(await fetchOrderManagementData())
      } catch (error) {
        toast?.show(error.message, 'error')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [toast])

  const deliveries = useMemo(() => {
    const term = query.toLowerCase()
    return (data?.supplierDeliveries || []).filter((item) =>
      [item.poNumber, item.supplier, item.productName, item.deliveryStatus].join(' ').toLowerCase().includes(term),
    )
  }, [data, query])

  return (
    <OrderShell title="Supplier Delivery Tracking" description="Review delivery completion grouped by purchase order lines.">
      <Card title="Supplier Deliveries">
        <div className="mb-4">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search supplier, product, or PO" className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-gray-400 sm:max-w-xs" />
        </div>
        {loading ? <TableSkeleton cols={6} /> : deliveries.length === 0 ? (
          <EmptyState title="No supplier delivery records" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-100 text-xs uppercase text-gray-400">
                <tr>
                  <th className="py-3 pr-4">Purchase Order</th>
                  <th className="py-3 pr-4">Supplier</th>
                  <th className="py-3 pr-4">Product</th>
                  <th className="py-3 pr-4">Ordered Quantity</th>
                  <th className="py-3 pr-4">Delivered Quantity</th>
                  <th className="py-3 pr-4">Remaining Quantity</th>
                  <th className="py-3">Delivery Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {deliveries.map((item) => (
                  <tr key={`${item.purchaseOrderId}-${item.id}`}>
                    <td className="py-3 pr-4 font-medium">{item.poNumber}</td>
                    <td className="py-3 pr-4 text-gray-600">{item.supplier}</td>
                    <td className="py-3 pr-4 text-gray-600">{item.productName}</td>
                    <td className="py-3 pr-4">{item.quantity_ordered}</td>
                    <td className="py-3 pr-4">{item.quantity_received}</td>
                    <td className="py-3 pr-4">{(item.quantity_ordered - item.quantity_received)}</td>
                    <td className="py-3"><Badge tone={statusTone(item.status)}>{item.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </OrderShell>
  )
}
