'use client'

import { useEffect, useMemo, useState } from 'react'
import { fetchOrderManagementData, formatDate } from '@/lib/orderManagement'
import { Badge, Card, EmptyState, OrderShell, TableSkeleton, statusTone, useToast } from '@/components/order-management/ui'

const customerOrderStatuses = [
  { value: 'submitted', label: 'Submitted' },
]

export default function CustomerOrdersPage() {
  const toast = useToast()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')

  useEffect(() => {
    let active = true
    const loadInitialData = async () => {
      try {
        const nextData = await fetchOrderManagementData()
        if (active) setData(nextData)
      } catch (error) {
        if (active) toast?.show(error.message, 'error')
      } finally {
        if (active) setLoading(false)
      }
    }
    loadInitialData()
    return () => {
      active = false
    }
  }, [toast])

  const orders = useMemo(() => {
    const term = query.toLowerCase()
    return (data?.customerOrders || []).filter((order) => {
      const matchesText = [order.orderNumber, order.customerName, order.status].join(' ').toLowerCase().includes(term)
      const matchesStatus = status === 'all' || order.status.toLowerCase() === status
      return matchesText && matchesStatus
    })
  }, [data, query, status])


  return (
    <OrderShell title="Customer Orders" description="Search, filter, create, and update export customer orders.">
      <div className="">
        <Card title="Customer Order List">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search orders or customers" className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-gray-400 sm:max-w-xs" />
            <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded border border-gray-300 px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-gray-400">
              <option value="all">All statuses</option>
              {customerOrderStatuses.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </div>

          {loading ? <TableSkeleton cols={8} /> : orders.length === 0 ? (
            <EmptyState title="No matching customer orders" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-gray-100 text-xs uppercase text-gray-400">
                  <tr>
                    <th className="py-3 pr-4">Order Number</th>
                    <th className="py-3 pr-4">Customer Name</th>
                    <th className="py-3 pr-4">Order Date</th>
                    <th className="py-3 pr-4">Status</th>
                    <th className="py-3 pr-4">PFI</th>
                    <th className="py-3 pr-4">Total Items</th>
                    <th className="py-3 pr-4">Expected Shipment</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {orders.map((order) => (
                    <tr key={order.id}>
                      <td className="py-3 pr-4 font-medium">{order.orderNumber}</td>
                      <td className="py-3 pr-4 text-gray-600">{order.customerName}</td>
                      <td className="py-3 pr-4 text-gray-600">{formatDate(order.orderDate)}</td>
                      <td className="py-3 pr-4"><Badge tone={statusTone(order.status)}>{order.status}</Badge></td>
                      <td className="py-3 pr-4"><Badge tone={order.billing ? 'black' : 'gray'}>{order.pfiState}</Badge></td>
                      <td className="py-3 pr-4">{order.totalItems}</td>
                      <td className="py-3 pr-4 text-gray-600">{formatDate(order.expectedShipmentDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </OrderShell>
  )
}
