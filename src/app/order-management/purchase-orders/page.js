'use client'

import { useEffect, useMemo, useState } from 'react'
import { createRecord, deleteRecord, fetchOrderManagementData, formatDate, updateRecord } from '@/lib/orderManagement'
import { Badge, Button, Card, ConfirmDialog, EmptyState, OrderShell, ProgressBar, TableSkeleton, statusTone, useToast } from '@/components/order-management/ui'

const blankForm = {
  order_id: '',
  supplier_id: '',
  po_number: '',
  expected_delivery_date: '',
  status: 'Pending',
}

export default function PurchaseOrdersPage() {
  const toast = useToast()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [query, setQuery] = useState('')
  const [form, setForm] = useState(blankForm)
  const [editing, setEditing] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)

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

  const openEdit = (po) => {
    setEditing(po)
    setForm({
      order_id: po.customerOrderId || '',
      supplier_id: po.supplierId || '',
      po_number: po.poNumber,
      expected_delivery_date: po.expectedDelivery ? String(po.expectedDelivery).slice(0, 10) : '',
      status: po.status,
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
      const payload = Object.fromEntries(Object.entries(form).filter(([, value]) => value !== ''))
      let result
      if (editing) {
        result = await updateRecord('purchase_orders', editing.id, payload)
        toast?.show(result.skippedColumns.length ? `Purchase order updated. Skipped unsupported fields: ${result.skippedColumns.join(', ')}.` : 'Purchase order updated.')
      } else {
        result = await createRecord('purchase_orders', payload)
        toast?.show(result.skippedColumns.length ? `Purchase order created. Skipped unsupported fields: ${result.skippedColumns.join(', ')}.` : 'Purchase order created.')
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
    setSaving(true)
    try {
      await deleteRecord('purchase_orders', deleteTarget.id)
      toast?.show('Purchase order deleted.')
      setDeleteTarget(null)
      await refresh()
    } catch (error) {
      toast?.show(error.message, 'error')
    } finally {
      setSaving(false)
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
                <thead className="border-b border-gray-200 text-xs uppercase text-gray-500">
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
                      <td className="py-3 pr-4"><ProgressBar value={po.progress} /></td>
                      <td className="py-3">
                        <div className="flex gap-2">
                          <button onClick={() => openEdit(po)} className="rounded border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50">Edit</button>
                          <button onClick={() => setDeleteTarget(po)} className="rounded bg-red-600 px-3 py-2 text-xs font-medium text-white hover:bg-red-700">Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title={editing ? 'Edit Purchase Order' : 'New Purchase Order'}>
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
            <label className="block text-sm font-medium text-gray-700">Purchase Order Number
              <input value={form.po_number} onChange={(event) => setForm({ ...form, po_number: event.target.value })} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-gray-400" />
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
            <label className="block text-sm font-medium text-gray-700">Expected Delivery
              <input type="date" value={form.expected_delivery_date} onChange={(event) => setForm({ ...form, expected_delivery_date: event.target.value })} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-gray-400" />
            </label>
            <label className="block text-sm font-medium text-gray-700">Status
              <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-gray-400">
                <option>Pending</option>
                <option>Partially Delivered</option>
                <option>Delivered</option>
              </select>
            </label>
            <div className="flex gap-2">
              <Button disabled={saving}>{saving ? 'Saving...' : editing ? 'Update PO' : 'Create PO'}</Button>
              {editing && <Button type="button" variant="secondary" onClick={resetForm}>Cancel</Button>}
            </div>
          </form>
        </Card>
      </div>
      <ConfirmDialog open={Boolean(deleteTarget)} title="Delete purchase order?" message="This removes the selected purchase order record. This action cannot be undone." loading={saving} onCancel={() => setDeleteTarget(null)} onConfirm={remove} />
    </OrderShell>
  )
}
