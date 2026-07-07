'use client'

import { useEffect, useMemo, useState } from 'react'
import { createRecord, deleteRecord, fetchOrderManagementData, formatDate, updateRecord } from '@/lib/orderManagement'
import { Badge, Button, Card, ConfirmDialog, EmptyState, OrderShell, ProgressBar, TableSkeleton, statusTone, useToast } from '@/components/order-management/ui'

const blankForm = {
  po_number: '',
  supplier_name: '',
  date_issued: '',
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
      [po.poNumber, po.supplier, po.status].join(' ').toLowerCase().includes(term),
    )
  }, [data, query])

  const openEdit = (po) => {
    setEditing(po)
    setForm({
      po_number: po.poNumber,
      supplier_name: po.supplier,
      date_issued: po.dateIssued ? String(po.dateIssued).slice(0, 10) : '',
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

          {loading ? <TableSkeleton cols={7} /> : purchaseOrders.length === 0 ? (
            <EmptyState title="No purchase orders" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-gray-200 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="py-3 pr-4">Purchase Order Number</th>
                    <th className="py-3 pr-4">Supplier</th>
                    <th className="py-3 pr-4">Date Issued</th>
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
            <label className="block text-sm font-medium text-gray-700">Purchase Order Number
              <input value={form.po_number} onChange={(event) => setForm({ ...form, po_number: event.target.value })} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-gray-400" />
            </label>
            <label className="block text-sm font-medium text-gray-700">Supplier
              <input value={form.supplier_name} onChange={(event) => setForm({ ...form, supplier_name: event.target.value })} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-gray-400" />
            </label>
            <label className="block text-sm font-medium text-gray-700">Date Issued
              <input type="date" value={form.date_issued} onChange={(event) => setForm({ ...form, date_issued: event.target.value })} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-gray-400" />
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
