'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { fetchOrderManagementData, formatDate } from '@/lib/orderManagement'
import { Badge, Card, EmptyState, OrderShell, ProgressBar, StatCard, TableSkeleton, statusTone, useToast } from '@/components/order-management/ui'

export default function OrderManagementDashboard() {
  const toast = useToast()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

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

  const summary = data?.summary || {}

  const quickLinks = [
    {
      title: 'Customer Orders',
      description: 'Review export orders, fulfillment status, and customer shipment needs.',
      href: '/order-management/customer-orders',
      action: 'Open orders',
    },
    {
      title: 'Purchase Orders',
      description: 'Track supplier purchase orders, expected dates, and delivery progress.',
      href: '/order-management/purchase-orders',
      action: 'View purchase orders',
    },
    {
      title: 'Supplier Deliveries',
      description: 'Monitor received quantities and exceptions before shipment readiness.',
      href: '/order-management/supplier-deliveries',
      action: 'Check deliveries',
    },
  ]

  return (
    <OrderShell
      title="Order Management"
      description="Monitor customer export orders, supplier purchase orders, and delivery readiness."
    >
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <StatCard label="Total Customer Orders" value={loading ? '-' : summary.totalCustomerOrders} />
          <StatCard label="Pending Orders" value={loading ? '-' : summary.pendingOrders} />
          <StatCard label="Orders in Progress" value={loading ? '-' : summary.ordersInProgress} />
          <StatCard label="Completed Orders" value={loading ? '-' : summary.completedOrders} />
          <StatCard label="Total Purchase Orders" value={loading ? '-' : summary.totalPurchaseOrders} />
          <StatCard label="Supplier Deliveries Pending" value={loading ? '-' : summary.supplierDeliveriesPending} />
        </div>

        <Card title="Order Management Workspaces">
          <div className="divide-y divide-gray-100">
            {quickLinks.map((item) => (
              <div key={item.title} className="flex flex-col gap-4 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">{item.title}</h3>
                  <p className="mt-1 max-w-2xl text-sm text-gray-500">{item.description}</p>
                </div>
                <Link href={item.href} className="text-sm font-medium text-gray-900 hover:underline">
                  {item.action}
                </Link>
              </div>
            ))}
          </div>
        </Card>

        <div className="grid gap-6 xl:grid-cols-2">
          <Card
            title="Recent Customer Orders"
            action={<Link href="/order-management/customer-orders" className="text-sm font-medium text-gray-900 hover:underline">See all</Link>}
          >
            {loading ? <TableSkeleton cols={5} /> : data.customerOrders.length === 0 ? (
              <EmptyState title="No customer orders" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-gray-200 text-xs uppercase text-gray-500">
                    <tr>
                      <th className="py-3 pr-4">Order</th>
                      <th className="py-3 pr-4">Customer</th>
                      <th className="py-3 pr-4">Status</th>
                      <th className="py-3 pr-4">Progress</th>
                      <th className="py-3">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.customerOrders.slice(0, 5).map((order) => (
                      <tr key={order.id}>
                        <td className="py-3 pr-4 font-medium">{order.orderNumber}</td>
                        <td className="py-3 pr-4 text-gray-600">{order.customerName}</td>
                        <td className="py-3 pr-4"><Badge tone={statusTone(order.completionStatus)}>{order.completionStatus}</Badge></td>
                        <td className="py-3 pr-4"><ProgressBar value={order.progress} /></td>
                        <td className="py-3"><Link className="text-sm font-medium text-gray-900 hover:underline" href={`/order-management/customer-orders/${order.id}`}>View</Link></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card
            title="Recent Purchase Orders"
            action={<Link href="/order-management/purchase-orders" className="text-sm font-medium text-gray-900 hover:underline">See all</Link>}
          >
            {loading ? <TableSkeleton cols={5} /> : data.purchaseOrders.length === 0 ? (
              <EmptyState title="No purchase orders" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-gray-200 text-xs uppercase text-gray-500">
                    <tr>
                      <th className="py-3 pr-4">PO Number</th>
                      <th className="py-3 pr-4">Supplier</th>
                      <th className="py-3 pr-4">Expected</th>
                      <th className="py-3 pr-4">Status</th>
                      <th className="py-3">Progress</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.purchaseOrders.slice(0, 5).map((po) => (
                      <tr key={po.id}>
                        <td className="py-3 pr-4 font-medium">{po.poNumber}</td>
                        <td className="py-3 pr-4 text-gray-600">{po.supplier}</td>
                        <td className="py-3 pr-4 text-gray-600">{formatDate(po.expectedDelivery)}</td>
                        <td className="py-3 pr-4"><Badge tone={statusTone(po.status)}>{po.status}</Badge></td>
                        <td className="py-3"><ProgressBar value={po.progress} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <Card
          title="Supplier Delivery Progress"
          action={<Link href="/order-management/supplier-deliveries" className="text-sm font-medium text-gray-900 hover:underline">See all</Link>}
        >
          {loading ? <TableSkeleton cols={6} /> : data.supplierDeliveries.length === 0 ? (
            <EmptyState title="No supplier deliveries" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-gray-200 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="py-3 pr-4">Purchase Order</th>
                    <th className="py-3 pr-4">Supplier</th>
                    <th className="py-3 pr-4">Product</th>
                    <th className="py-3 pr-4">Ordered</th>
                    <th className="py-3 pr-4">Delivered</th>
                    <th className="py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.supplierDeliveries.slice(0, 8).map((item) => (
                    <tr key={`${item.purchaseOrderId}-${item.id}`}>
                      <td className="py-3 pr-4 font-medium">{item.poNumber}</td>
                      <td className="py-3 pr-4 text-gray-600">{item.supplier}</td>
                      <td className="py-3 pr-4 text-gray-600">{item.productName}</td>
                      <td className="py-3 pr-4">{item.orderedQuantity}</td>
                      <td className="py-3 pr-4">{item.deliveredQuantity}</td>
                      <td className="py-3"><Badge tone={statusTone(item.deliveryStatus)}>{item.deliveryStatus}</Badge></td>
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
