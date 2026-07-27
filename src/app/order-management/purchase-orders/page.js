'use client'

import { useEffect, useMemo, useState } from 'react'
import { advanceCustomerOrderStatus, createRecord, deleteRecord, fetchOrderManagementData, formatDate, updateRecord } from '@/lib/orderManagement'
import { Badge, Button, Card, ConfirmDialog, EmptyState, OrderShell, ProgressBar, TableSkeleton, statusTone, useToast } from '@/components/order-management/ui'
import { supabase } from '@/lib/supabaseClient'

const blankForm = {
  order_id: '',
  supplier_id: '',
  po_number: '',
  expected_delivery_date: '',
  // 'sent' is the status the supplier portal acts on — a PO is emailed to the
  // supplier on creation, so it is sent by definition.
  status: 'sent',
}

export default function PurchaseOrdersPage() {
  const toast = useToast()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [query, setQuery] = useState('')
  const [form, setForm] = useState(blankForm)
  const [editing, setEditing] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  // Line items available on the selected customer order, and which of them
  // (with what quantity) go on THIS supplier's purchase order.
  const [availableItems, setAvailableItems] = useState([])
  const [itemsLoading, setItemsLoading] = useState(false)
  const [lineItems, setLineItems] = useState({})

  const progressMap = (status) => {
  switch (status) {
    case 'Pending':
    case 'pending':
      return 0

    case 'Sent':
    case 'sent':
      return 10

    case 'Confirmed':
    case 'confirmed':
      return 20

    case 'Partially Delivered':
    case 'partially_delivered':
      return 30

    case 'Delivered':
    case 'delivered':
      return 40

    case 'Pending Sticker / Label':
      return 60

    case 'Staging':
    case 'staging':
      return 80

    case 'Ready for Shipment':
    case 'Ready For Shipment':
    case 'ready_for_shipment':
      return 90

    case 'Completed':
    case 'completed':
      return 100

    default:
      return 0
  }
}

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

  const purchaseOrders = useMemo(() => {
    const term = query.toLowerCase()
    return (data?.purchaseOrders || []).filter((po) =>
      [po.poNumber, po.supplier, po.status, po.customerOrderNumber].join(' ').toLowerCase().includes(term),
    )
  }, [data, query])

  const customerOrders = data?.customerOrders || []
  const suppliers = data?.suppliers || []

  // Load the chosen customer order's products so the user can pick which ones
  // this supplier is being ordered from (DMC splits an order across 3–5 suppliers).
  useEffect(() => {
    let active = true
    const loadItems = async () => {
      if (!form.order_id) { setAvailableItems([]); setLineItems({}); return }
      setItemsLoading(true)
      const { data: items, error } = await supabase
        .from('customer_order_items')
        .select('id, product_id, quantity_ordered, products(product_name, sku)')
        .eq('order_id', form.order_id)
      if (!active) return
      if (error) toast?.show(error.message, 'error')
      const rows = items || []
      setAvailableItems(rows)
      // Default: every product selected at the ordered quantity.
      setLineItems(Object.fromEntries(
        rows.map((i) => [i.product_id, { checked: true, qty: String(i.quantity_ordered) }]),
      ))
      setItemsLoading(false)
    }
    loadItems()
    return () => { active = false }
  }, [form.order_id, toast])

  const selectedLineItems = availableItems
    .filter((i) => lineItems[i.product_id]?.checked)
    .map((i) => ({ product_id: i.product_id, quantity_ordered: Number(lineItems[i.product_id]?.qty) }))
    .filter((i) => Number.isFinite(i.quantity_ordered) && i.quantity_ordered > 0)

  const openEdit = (po) => {
    setEditing(po)
    setForm({
      order_id: po.customerOrderId || '',
      supplier_id: po.supplierId || '',
      expected_delivery_date: po.expectedDelivery ? String(po.expectedDelivery).slice(0, 10) : '',
      status: po.status,
    })
    // The form sits below the table — bring it into view so Edit visibly responds
    requestAnimationFrame(() => {
      document.getElementById('po-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  const resetForm = () => {
    setEditing(null)
    setForm(blankForm)
  }


const save = async (event) => {
  event.preventDefault()
  setSaving(true)

  try {
    if (!form.order_id) {
      throw new Error('Select a customer order before creating a purchase order.')
    }

    if (!form.supplier_id) {
      throw new Error('Select a supplier before creating a purchase order.')
    }

    // A purchase order with no products cannot be dispatched or received —
    // never create an empty one.
    if (!editing) {
      if (availableItems.length === 0) {
        throw new Error('That customer order has no products yet, so there is nothing to purchase.')
      }
      if (selectedLineItems.length === 0) {
        throw new Error('Select at least one product (with a quantity above zero) for this supplier.')
      }
    }

    const payload = Object.fromEntries(
      Object.entries(form).filter(([, value]) => value !== '')
    )

    let result

    if (editing) {
      result = await updateRecord('purchase_orders', editing.id, payload)

      toast?.show(
        result.skippedColumns.length
          ? `Purchase order updated. Skipped unsupported fields: ${result.skippedColumns.join(', ')}.`
          : 'Purchase order updated.'
      )
    } else {
      // Stamp the issue date — supplier lead time (Module 4) is measured from
      // issued_date to actual_completed_date, so it must never be blank.
      result = await createRecord('purchase_orders', {
        ...payload,
        issued_date: payload.issued_date || new Date().toISOString().split('T')[0],
      })

      // Only the products chosen for THIS supplier — an order is split across
      // several suppliers, so a PO must not carry the whole order's items.
      const { error: poItemsError } = await supabase
        .from('purchase_order_items')
        .insert(
          selectedLineItems.map((item) => ({
            purchase_order_id: result.data.id,
            product_id: item.product_id,
            quantity_ordered: item.quantity_ordered,
            quantity_received: 0,
          }))
        )

      if (poItemsError) {
        // Don't leave an empty PO behind if the items failed to save.
        await deleteRecord('purchase_orders', result.data.id).catch(() => {})
        throw poItemsError
      }

      // Issuing a PO means procurement has started — move the customer tracker.
      await advanceCustomerOrderStatus(form.order_id, 'procurement_started', ['payment_verified'])

      // Send email
      fetch('/api/send-po-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          purchaseOrderId: result.data.id,
        }),
      })

      toast?.show(
        result.skippedColumns.length
          ? `Purchase order created. Skipped unsupported fields: ${result.skippedColumns.join(', ')}.`
          : 'Purchase order created.'
      )
    }

    resetForm()
    await refresh()
  } catch (error) {
    toast?.show(error.message, 'error')
  } finally {
    setSaving(false)
  }
}

  const remove = async () => {
    setDeleting(true)
    try {
      await deleteRecord('purchase_orders', deleteTarget.id)
      toast?.show('Purchase order deleted.')
      setDeleteTarget(null)
      await refresh()
    } catch (error) {
      toast?.show(error.message, 'error')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <OrderShell title="Purchase Orders" description="Track supplier purchase orders and delivery fulfillment.">
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <Card title="Issued Purchase Orders">
          <div className="mb-4">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search purchase orders or suppliers" className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-gray-400 sm:max-w-xs" />
          </div>

          {loading ? <TableSkeleton cols={8} /> : purchaseOrders.length === 0 ? (
            <EmptyState title="No purchase orders" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-gray-100 text-xs uppercase text-gray-400">
                  <tr>
                    <th className="py-3 pr-4">Purchase Order Number</th>
                    <th className="py-3 pr-4">Customer Order</th>
                    <th className="py-3 pr-4">Supplier</th>
                    <th className="py-3 pr-4">Created</th>
                    <th className="py-3 pr-4">Expected Delivery</th>
                    <th className="py-3 pr-4">Status</th>
                    <th className="py-3 pr-4">Progress</th>
                    <th className="py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {purchaseOrders.map((po) => (
                    <tr key={po.id}>
                      <td className="py-3 pr-4 font-medium">{po.poNumber}</td>
                      <td className="py-3 pr-4 text-gray-600">{po.customerOrderNumber || 'Not linked'}</td>
                      <td className="py-3 pr-4 text-gray-600">{po.supplier}</td>
                      <td className="py-3 pr-4 text-gray-600">{formatDate(po.dateIssued)}</td>
                      <td className="py-3 pr-4 text-gray-600">{formatDate(po.expectedDelivery)}</td>
                      <td className="py-3 pr-4"><Badge tone={statusTone(po.status)}>{po.status}</Badge></td>

                      <td className="py-3 pr-4">
                        <ProgressBar value={progressMap(po.status)} />
                      </td>         
                        <td className="py-3">
                          <div className="flex gap-2">
                            {po.status === 'Ready For Shipment' || po.status === 'Completed' ? (
                              <button
                                disabled={po.status === 'Completed'}
                                onClick={async () => {
                                  if (po.status === 'Completed') return

                                  const { error } = await supabase
                                    .from('purchase_orders')
                                    .update({ status: 'Completed' })
                                    .eq('id', po.id)

                                  if (error) {
                                    toast?.show(error.message, 'error')
                                    return
                                  }

                                  toast?.show('Purchase order completed.')
                                  await refresh()
                                }}
                                className={`rounded px-3 py-2 text-xs font-medium text-white ${
                                  po.status === 'Completed'
                                    ? 'cursor-not-allowed bg-gray-400'
                                    : 'bg-green-600 hover:bg-green-700'
                                }`}
                              >
                                Mark Completed
                              </button>
                            ) : (
                              <>
                                <button
                                  onClick={() => openEdit(po)}
                                  className="rounded border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
                                >
                                  Edit
                                </button>

                                <button
                                  onClick={() => setDeleteTarget(po)}
                                  className="rounded bg-red-600 px-3 py-2 text-xs font-medium text-white hover:bg-red-700"
                                >
                                  Delete
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <div id="po-form" className="scroll-mt-6">
        <Card title={editing ? `Edit Purchase Order — ${editing.poNumber || ''}` : 'New Purchase Order'}>
          <form onSubmit={save} className="space-y-4">
            <label className="block text-sm font-medium text-gray-700">Customer Order
              <select value={form.order_id} onChange={(event) => setForm({ ...form, order_id: event.target.value })} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-gray-400">
                <option value="">Select customer order</option>
                {customerOrders.map((order) => (
                  <option key={order.id} value={order.id}>
                    {order.orderNumber} - {order.customerName}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-medium text-gray-700">Supplier
              <select value={form.supplier_id} onChange={(event) => setForm({ ...form, supplier_id: event.target.value })} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-gray-400">
                <option value="">Select supplier</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name || supplier.supplier_name || supplier.company_name || `Supplier ${supplier.id}`}
                  </option>
                ))}
              </select>
            </label>
            {!editing && (
              <div>
                <p className="text-sm font-medium text-gray-700">Products for this supplier</p>
                <p className="text-xs text-gray-400 mb-2">
                  Tick only the products this supplier is providing — an order is usually split across several suppliers.
                </p>
                {!form.order_id ? (
                  <p className="text-sm text-gray-400 border border-gray-200 rounded px-3 py-2 bg-gray-50">Select a customer order first.</p>
                ) : itemsLoading ? (
                  <p className="text-sm text-gray-400 border border-gray-200 rounded px-3 py-2 bg-gray-50">Loading products...</p>
                ) : availableItems.length === 0 ? (
                  <p className="text-sm text-gray-500 border border-gray-200 rounded px-3 py-2 bg-gray-50">
                    This customer order has no products, so no purchase order can be created for it.
                  </p>
                ) : (
                  <div className="border border-gray-200 rounded divide-y divide-gray-100">
                    {availableItems.map((item) => {
                      const row = lineItems[item.product_id] || { checked: false, qty: '0' }
                      return (
                        <div key={item.id} className="flex items-center gap-3 px-3 py-2">
                          <input
                            type="checkbox"
                            checked={row.checked}
                            onChange={(e) => setLineItems({ ...lineItems, [item.product_id]: { ...row, checked: e.target.checked } })}
                          />
                          <div className="flex-1">
                            <p className="text-sm text-gray-900">{item.products?.product_name || 'Product'}</p>
                            <p className="text-xs text-gray-400">Ordered by customer: {item.quantity_ordered}</p>
                          </div>
                          <input
                            type="number"
                            min="1"
                            value={row.qty}
                            disabled={!row.checked}
                            onChange={(e) => setLineItems({ ...lineItems, [item.product_id]: { ...row, qty: e.target.value } })}
                            className="w-24 rounded border border-gray-300 px-2 py-1 text-sm text-black disabled:bg-gray-50 disabled:text-gray-400"
                          />
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            <label className="block text-sm font-medium text-gray-700">Expected Delivery
              <input type="date" value={form.expected_delivery_date} onChange={(event) => setForm({ ...form, expected_delivery_date: event.target.value })} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-gray-400" />
            </label>
            <label className="block text-sm font-medium text-gray-700">Status
              <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-gray-400">
                <option value="draft">Draft</option>
                <option value="sent">Sent</option>
                <option value="partially_delivered">Partially Delivered</option>
                <option value="delivered">Delivered</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </label>
            <div className="flex gap-2">
              <Button
                disabled={saving || deleting}
                className={
                  saving || deleting
                    ? "bg-gray-400 hover:bg-gray-400 text-white cursor-not-allowed"
                    : "bg-black hover:bg-gray-800 text-white"
                }
              >
                {deleting ? 'Deleting...' : saving ? 'Saving...' : editing ? 'Update PO' : 'Create PO'}
              </Button>

              {editing && (
                <Button type="button" variant="secondary" onClick={resetForm} className="bg-gray-200 hover:bg-gray-300 text-gray-800">
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </Card>
        </div>
      </div>
      <ConfirmDialog open={Boolean(deleteTarget)} title="Delete purchase order?" message="This removes the selected purchase order record. This action cannot be undone." loading={deleting} onCancel={() => setDeleteTarget(null)} onConfirm={remove} />
    </OrderShell>
  )
}
