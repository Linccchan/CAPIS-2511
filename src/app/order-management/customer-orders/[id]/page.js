'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { fetchOrderManagementData, formatDate, money } from '@/lib/orderManagement'
import { Badge, Card, EmptyState, OrderShell, ProgressBar, TableSkeleton, statusTone, useToast } from '@/components/order-management/ui'

export default function CustomerOrderDetailsPage() {
  const params = useParams()
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

  const order = useMemo(
    () => (data?.customerOrders || []).find((item) => String(item.id) === String(params.id)),
    [data, params.id],
  )

  return (
    <OrderShell title="Order Details" description="Customer information, ordered products, supplier progress, and shipment readiness.">
      <div className="mb-4">
        <Link href="/order-management/customer-orders" className="text-sm font-medium text-gray-700 hover:underline">Back to customer orders</Link>
      </div>

      {loading ? (
        <Card><TableSkeleton cols={4} rows={6} /></Card>
      ) : !order ? (
        <Card><EmptyState title="Order not found" description="The selected customer order could not be found." /></Card>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-4">
            <Card title="Overall Completion">
              <div className="space-y-4">
                <div>
                  <div className="text-2xl font-semibold text-gray-900">{order.orderNumber}</div>
                  <div className="mt-1 text-sm text-gray-500">{order.customerName}</div>
                </div>
                <ProgressBar value={order.progress} />
                <Badge tone={statusTone(order.completionStatus)}>{order.completionStatus}</Badge>
              </div>
            </Card>
            <Card title="Order Date"><div className="text-sm text-gray-700">{formatDate(order.orderDate)}</div></Card>
            <Card title="Expected Shipment"><div className="text-sm text-gray-700">{formatDate(order.expectedShipmentDate)}</div></Card>
            <Card title="Linked Purchase Orders"><div className="text-2xl font-semibold text-gray-900">{order.linkedPurchaseOrders.length}</div></Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card title="Customer Information">
              <dl className="grid gap-4 text-sm sm:grid-cols-2">
                <div>
                  <dt className="font-medium text-gray-500">Customer Name</dt>
                  <dd className="mt-1 text-gray-900">{order.customerName}</dd>
                </div>
                <div>
                  <dt className="font-medium text-gray-500">Contact Information</dt>
                  <dd className="mt-1 text-gray-900">{order.contactInfo}</dd>
                </div>
                <div>
                  <dt className="font-medium text-gray-500">Order Date</dt>
                  <dd className="mt-1 text-gray-900">{formatDate(order.orderDate)}</dd>
                </div>
                <div>
                  <dt className="font-medium text-gray-500">Current Status</dt>
                  <dd className="mt-1"><Badge tone={statusTone(order.status)}>{order.status}</Badge></dd>
                </div>
              </dl>
            </Card>

            <Card title="Shipment Information">
              {order.shipment ? (
                <dl className="grid gap-4 text-sm sm:grid-cols-2">
                  {Object.entries(order.shipment).slice(0, 6).map(([key, value]) => (
                    <div key={key}>
                      <dt className="font-medium capitalize text-gray-500">{key.replaceAll('_', ' ')}</dt>
                      <dd className="mt-1 text-gray-900">{String(value || 'Not set')}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <EmptyState title="No shipment linked" description="Shipment details will appear once the order is assigned to a shipment." />
              )}
            </Card>
          </div>

          <Card title="Ordered Products">
            {order.items.length === 0 ? (
              <EmptyState title="No ordered products" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-gray-200 text-xs uppercase text-gray-500">
                    <tr>
                      <th className="py-3 pr-4">Product</th>
                      <th className="py-3 pr-4">Quantity</th>
                      <th className="py-3 pr-4">Unit Price</th>
                      <th className="py-3">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {order.items.map((item) => (
                      <tr key={item.id}>
                        <td className="py-3 pr-4 font-medium">{item.productName}</td>
                        <td className="py-3 pr-4">{item.quantity}</td>
                        <td className="py-3 pr-4 text-gray-600">{money(item.unitPrice)}</td>
                        <td className="py-3 font-medium">{money(item.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card title="Linked Purchase Orders">
            {order.linkedPurchaseOrders.length === 0 ? (
              <EmptyState title="No linked purchase orders" description="Supplier delivery readiness will be calculated after purchase orders are linked." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-gray-200 text-xs uppercase text-gray-500">
                    <tr>
                      <th className="py-3 pr-4">Purchase Order</th>
                      <th className="py-3 pr-4">Supplier</th>
                      <th className="py-3 pr-4">Expected Delivery</th>
                      <th className="py-3 pr-4">Status</th>
                      <th className="py-3">Progress</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {order.linkedPurchaseOrders.map((po) => (
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

          <Card title="Supplier Delivery Progress">
            {order.linkedPurchaseOrders.flatMap((po) => po.items).length === 0 ? (
              <EmptyState title="No supplier delivery lines" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-gray-200 text-xs uppercase text-gray-500">
                    <tr>
                      <th className="py-3 pr-4">Supplier</th>
                      <th className="py-3 pr-4">Product</th>
                      <th className="py-3 pr-4">Ordered</th>
                      <th className="py-3 pr-4">Delivered</th>
                      <th className="py-3 pr-4">Remaining</th>
                      <th className="py-3">Delivery Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {order.linkedPurchaseOrders.flatMap((po) => po.items.map((item) => ({ ...item, supplier: po.supplier }))).map((item) => (
                      <tr key={`${item.purchaseOrderId}-${item.id}`}>
                        <td className="py-3 pr-4 font-medium">{item.supplier}</td>
                        <td className="py-3 pr-4 text-gray-600">{item.productName}</td>
                        <td className="py-3 pr-4">{item.orderedQuantity}</td>
                        <td className="py-3 pr-4">{item.deliveredQuantity}</td>
                        <td className="py-3 pr-4">{item.remainingQuantity}</td>
                        <td className="py-3"><Badge tone={statusTone(item.deliveryStatus)}>{item.deliveryStatus}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}
    </OrderShell>
  )
}
