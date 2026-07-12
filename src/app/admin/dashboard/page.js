'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function AdminDashboard() {
  const [metrics, setMetrics] = useState([
    { label: 'Active Orders', value: 0, href: '/order-management/customer-orders' },
    { label: 'Purchase Orders', value: 0, href: '/admin/purchase-orders' },
    { label: 'Pending Deliveries', value: 0, href: '/warehouse/dashboard' },
    { label: 'Ready Shipments', value: 0, href: '/warehouse/staging' },
  ])
  const [recentOrders, setRecentOrders] = useState([])
  const [recentPurchaseOrders, setRecentPurchaseOrders] = useState([])

  useEffect(() => {
    let active = true
    async function countRows(table, filter) {
      let query = supabase.from(table).select('*', { count: 'exact', head: true })
      if (filter) query = filter(query)
      const { count } = await query
      return count || 0
    }

    async function load() {
      const [
        activeOrders,
        purchaseOrders,
        pendingDeliveries,
        readyShipments,
        recentOrdersResult,
        recentPurchaseOrdersResult,
      ] = await Promise.all([
        countRows('customer_orders', (query) => query.not('status', 'in', '(completed,cancelled)')),
        countRows('purchase_orders', (query) => query.not('status', 'eq', 'cancelled')),
        countRows('supplier_deliveries', (query) => query.eq('delivery_status', 'pending_confirmation')),
        countRows('shipments', (query) => query.eq('status', 'ready_for_loading')),
        supabase
          .from('customer_orders')
          .select('id, order_number, status, destination_country, created_at, customers(company_name)')
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('purchase_orders')
          .select('id, po_number, status, expected_delivery_date, suppliers(supplier_name), customer_orders(order_number)')
          .order('created_at', { ascending: false })
          .limit(5),
      ])
      if (!active) return
      setMetrics([
        { label: 'Active Orders', value: activeOrders, href: '/order-management/customer-orders' },
        { label: 'Purchase Orders', value: purchaseOrders, href: '/admin/purchase-orders' },
        { label: 'Pending Deliveries', value: pendingDeliveries, href: '/warehouse/dashboard' },
        { label: 'Ready Shipments', value: readyShipments, href: '/warehouse/staging' },
      ])
      setRecentOrders(recentOrdersResult.data || [])
      setRecentPurchaseOrders(recentPurchaseOrdersResult.data || [])
    }
    load()
    return () => {
      active = false
    }
  }, [])

  const workspaceGroups = [
    {
      title: 'Operations',
      items: [
        { title: 'Order Management', description: 'Customer orders, purchase orders, and supplier delivery readiness.', href: '/order-management' },
        { title: 'PFI Builder', description: 'Prepare pro forma invoices for submitted quotation requests.', href: '/order-management/customer-orders' },
        { title: 'Purchase Orders', description: 'Monitor supplier purchase orders and overdue delivery status.', href: '/admin/purchase-orders' },
        { title: 'Suppliers', description: 'Review supplier profiles, performance, and active purchase orders.', href: '/admin/suppliers' },
      ],
    },
    {
      title: 'Warehouse',
      items: [
        { title: 'Warehouse Dashboard', description: 'Expected deliveries, pending confirmations, and sticker tasks.', href: '/warehouse/dashboard' },
        { title: 'Compliance', description: 'Track sticker designs, label completion, and export readiness.', href: '/admin/compliance' },
        { title: 'Locations', description: 'Maintain active warehouse rack and staging locations.', href: '/admin/locations' },
      ],
    },
    {
      title: 'Catalog',
      items: [
        { title: 'Supplier Costs', description: 'Review supplier cost changes and product pricing prompts.', href: '/admin/supplier-costs' },
      ],
    },
  ]

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-gray-500">Export Consolidation System</p>
          <h1 className="mt-1 text-xl font-semibold text-gray-900">Admin Dashboard</h1>
        </div>
        <Link href="/order-management" className="btn btn-primary">Open Order Management</Link>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <Link key={metric.label} href={metric.href} className="stat-card block">
            <div className="text-xs font-semibold uppercase text-gray-500">{metric.label}</div>
            <div className="mt-3 text-3xl font-semibold text-gray-900">{metric.value}</div>
          </Link>
        ))}
      </section>

      <section className="card">
        <div className="flex items-center justify-between gap-4 border-b border-gray-200 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-900">Admin Workspaces</h2>
          <Link href="/order-management" className="text-sm font-medium text-gray-900 hover:underline">Open orders</Link>
        </div>
        <div className="grid gap-5 p-5 xl:grid-cols-3">
          {workspaceGroups.map((group) => (
            <div key={group.title} className="space-y-3">
              <div className="text-xs font-semibold uppercase text-gray-500">{group.title}</div>
              <div className="space-y-3">
                {group.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="block rounded-lg border border-gray-200 bg-white p-4 transition-colors hover:bg-gray-50"
                  >
                    <div className="text-sm font-semibold text-gray-900">{item.title}</div>
                    <p className="mt-1 text-sm leading-5 text-gray-500">{item.description}</p>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="card">
          <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">Recent Customer Orders</h2>
            <Link href="/order-management/customer-orders" className="text-sm font-medium text-gray-900 hover:underline">See all</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="table-th">Order</th>
                  <th className="table-th">Customer</th>
                  <th className="table-th">Destination</th>
                  <th className="table-th">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order) => (
                  <tr key={order.id}>
                    <td className="table-td">
                      <Link href={`/order-management/customer-orders/${order.id}`} className="td-primary hover:underline">{order.order_number}</Link>
                    </td>
                    <td className="table-td">{order.customers?.company_name || 'Customer'}</td>
                    <td className="table-td">{order.destination_country || '-'}</td>
                    <td className="table-td">{order.status}</td>
                  </tr>
                ))}
                {recentOrders.length === 0 && <tr><td colSpan={4} className="table-td py-8 text-center text-gray-500">No customer orders yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card">
          <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">Recent Purchase Orders</h2>
            <Link href="/admin/purchase-orders" className="text-sm font-medium text-gray-900 hover:underline">See all</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="table-th">PO Number</th>
                  <th className="table-th">Supplier</th>
                  <th className="table-th">Expected</th>
                  <th className="table-th">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentPurchaseOrders.map((po) => (
                  <tr key={po.id}>
                    <td className="table-td">
                      <Link href="/admin/purchase-orders" className="td-primary hover:underline">{po.po_number}</Link>
                    </td>
                    <td className="table-td">{po.suppliers?.supplier_name || 'Supplier'}</td>
                    <td className="table-td">{po.expected_delivery_date || '-'}</td>
                    <td className="table-td">{po.status}</td>
                  </tr>
                ))}
                {recentPurchaseOrders.length === 0 && <tr><td colSpan={4} className="table-td py-8 text-center text-gray-500">No purchase orders yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  )
}
