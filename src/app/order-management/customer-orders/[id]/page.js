'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { createRecord, fetchOrderManagementData, formatDate, money } from '@/lib/orderManagement'
import { Badge, Button, Card, EmptyState, OrderShell, ProgressBar, TableSkeleton, statusTone, useToast } from '@/components/order-management/ui'

const blankItemForm = {
  product_id: '',
  quantity_ordered: '1',
  unit_price: '',
  notes: '',
}

export default function CustomerOrderDetailsPage() {
  const params = useParams()
  const toast = useToast()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [savingItem, setSavingItem] = useState(false)
  const [itemForm, setItemForm] = useState(blankItemForm)

  const refresh = async () => {
    try {
      setData(await fetchOrderManagementData())
    } catch (error) {
      toast?.show(error.message, 'error')
    }
  }

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

  const order = useMemo(
    () => (data?.customerOrders || []).find((item) => String(item.id) === String(params.id)),
    [data, params.id],
  )

  const addItem = async (event) => {
    event.preventDefault()
    if (!order) return

    if (!itemForm.product_id) {
      toast?.show('Select a product before adding an item.', 'error')
      return
    }

    const quantity = Number(itemForm.quantity_ordered)
    if (!Number.isFinite(quantity) || quantity <= 0) {
      toast?.show('Quantity must be greater than zero.', 'error')
      return
    }

    setSavingItem(true)
    try {
      const payload = {
        order_id: order.id,
        product_id: itemForm.product_id,
        quantity_ordered: quantity,
        unit_price: itemForm.unit_price === '' ? 0 : Number(itemForm.unit_price),
        notes: itemForm.notes,
      }
      const result = await createRecord('customer_order_items', Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== '')))
      setItemForm(blankItemForm)
      await refresh()
      toast?.show(result.skippedColumns.length ? `Item added. Skipped unsupported fields: ${result.skippedColumns.join(', ')}.` : 'Item added.')
    } catch (error) {
      toast?.show(error.message, 'error')
    } finally {
      setSavingItem(false)
    }
  }

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
            <form onSubmit={addItem} className="mb-5 grid gap-3 rounded border border-gray-200 bg-gray-50 p-4 lg:grid-cols-[1fr_120px_140px_1fr_auto]">
              <select value={itemForm.product_id} onChange={(event) => setItemForm({ ...itemForm, product_id: event.target.value })} className="rounded border border-gray-300 bg-white px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-gray-400">
                <option value="">Select product</option>
                {(data?.products || []).map((product) => (
                  <option key={product.id} value={product.id}>{product.product_name || product.name || product.sku || product.id}</option>
                ))}
              </select>
              <input type="number" min="1" value={itemForm.quantity_ordered} onChange={(event) => setItemForm({ ...itemForm, quantity_ordered: event.target.value })} placeholder="Qty" className="rounded border border-gray-300 bg-white px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-gray-400" />
              <input type="number" min="0" step="0.01" value={itemForm.unit_price} onChange={(event) => setItemForm({ ...itemForm, unit_price: event.target.value })} placeholder="Unit price" className="rounded border border-gray-300 bg-white px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-gray-400" />
              <input value={itemForm.notes} onChange={(event) => setItemForm({ ...itemForm, notes: event.target.value })} placeholder="Notes" className="rounded border border-gray-300 bg-white px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-gray-400" />
              <Button disabled={savingItem}>{savingItem ? 'Adding...' : 'Add Item'}</Button>
            </form>
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
