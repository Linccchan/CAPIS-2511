'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { createRecord, deleteRecord, fetchOrderManagementData, formatDate, updateRecord } from '@/lib/orderManagement'
import { supabase } from '@/lib/supabaseClient'
import { Badge, Button, Card, ConfirmDialog, EmptyState, OrderShell, TableSkeleton, statusTone, useToast } from '@/components/order-management/ui'

const blankForm = {
  order_number: '',
  customer_id: '',
  destination_country: '',
  order_date: '',
  estimated_ready_date: '',
  status: 'submitted',
}

const customerOrderStatuses = [
  { value: 'submitted', label: 'Submitted' },
]

export default function CustomerOrdersPage() {
  const toast = useToast()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
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

  const orders = useMemo(() => {
    const term = query.toLowerCase()
    return (data?.customerOrders || []).filter((order) => {
      const matchesText = [order.orderNumber, order.customerName, order.status].join(' ').toLowerCase().includes(term)
      const matchesStatus = status === 'all' || order.status.toLowerCase() === status
      return matchesText && matchesStatus
    })
  }, [data, query, status])

  const openEdit = (order) => {
    setEditing(order)
    setForm({
      order_number: order.orderNumber,
      customer_id: order.customer_id || '',
      destination_country: order.destination_country || '',
      order_date: order.orderDate ? String(order.orderDate).slice(0, 10) : '',
      estimated_ready_date: order.expectedShipmentDate ? String(order.expectedShipmentDate).slice(0, 10) : '',
      status: order.status?.toLowerCase() || 'submitted',
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
        result = await updateRecord('customer_orders', editing.id, payload)
        toast?.show(result.skippedColumns.length ? `Customer order updated. Skipped unsupported fields: ${result.skippedColumns.join(', ')}.` : 'Customer order updated.')
      } else {
        const { data: userData } = await supabase.auth.getUser()
        if (userData?.user?.id) payload.created_by = userData.user.id
        result = await createRecord('customer_orders', payload)
        toast?.show(result.skippedColumns.length ? `Customer order created. Skipped unsupported fields: ${result.skippedColumns.join(', ')}.` : 'Customer order created.')
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
      await deleteRecord('customer_orders', deleteTarget.id)
      toast?.show('Customer order deleted.')
      setDeleteTarget(null)
      await refresh()
    } catch (error) {
      toast?.show(error.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <OrderShell title="Customer Orders" description="Search, filter, create, and update export customer orders.">
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
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

          {loading ? <TableSkeleton cols={7} /> : orders.length === 0 ? (
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
                    <th className="py-3 pr-4">Total Items</th>
                    <th className="py-3 pr-4">Expected Shipment</th>
                    <th className="py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {orders.map((order) => (
                    <tr key={order.id}>
                      <td className="py-3 pr-4 font-medium">{order.orderNumber}</td>
                      <td className="py-3 pr-4 text-gray-600">{order.customerName}</td>
                      <td className="py-3 pr-4 text-gray-600">{formatDate(order.orderDate)}</td>
                      <td className="py-3 pr-4"><Badge tone={statusTone(order.status)}>{order.status}</Badge></td>
                      <td className="py-3 pr-4">{order.totalItems}</td>
                      <td className="py-3 pr-4 text-gray-600">{formatDate(order.expectedShipmentDate)}</td>
                      <td className="py-3">
                        <div className="flex gap-2">
                          <Link href={`/order-management/customer-orders/${order.id}`} className="rounded border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50">View</Link>
                          <button onClick={() => openEdit(order)} className="rounded border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50">Edit</button>
                          <button onClick={() => setDeleteTarget(order)} className="rounded bg-red-600 px-3 py-2 text-xs font-medium text-white hover:bg-red-700">Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title={editing ? 'Edit Customer Order' : 'New Customer Order'}>
          <form onSubmit={save} className="space-y-4">
            <label className="block text-sm font-medium text-gray-700">Order Number
              <input value={form.order_number} onChange={(event) => setForm({ ...form, order_number: event.target.value })} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-gray-400" />
            </label>
            <label className="block text-sm font-medium text-gray-700">Customer
              <select value={form.customer_id} onChange={(event) => setForm({ ...form, customer_id: event.target.value })} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-gray-400">
                <option value="">Select customer</option>
                {(data?.customers || []).map((customer) => (
                  <option key={customer.id} value={customer.id}>{customer.name || customer.customer_name || customer.company_name || customer.id}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium text-gray-700">Order Date
              <input type="date" value={form.order_date} onChange={(event) => setForm({ ...form, order_date: event.target.value })} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-gray-400" />
            </label>
            <label className="block text-sm font-medium text-gray-700">Destination Country
              <input value={form.destination_country} onChange={(event) => setForm({ ...form, destination_country: event.target.value })} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-gray-400" />
            </label>
            <label className="block text-sm font-medium text-gray-700">Estimated Ready Date
              <input type="date" value={form.estimated_ready_date} onChange={(event) => setForm({ ...form, estimated_ready_date: event.target.value })} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-gray-400" />
            </label>
            <label className="block text-sm font-medium text-gray-700">Status
              <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-gray-400">
                {customerOrderStatuses.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </label>
            <div className="flex gap-2">
              <Button disabled={saving}>{saving ? 'Saving...' : editing ? 'Update Order' : 'Create Order'}</Button>
              {editing && <Button type="button" variant="secondary" onClick={resetForm}>Cancel</Button>}
            </div>
          </form>
        </Card>
      </div>
      <ConfirmDialog open={Boolean(deleteTarget)} title="Delete customer order?" message="This removes the selected customer order record. This action cannot be undone." loading={saving} onCancel={() => setDeleteTarget(null)} onConfirm={remove} />
    </OrderShell>
  )
}
