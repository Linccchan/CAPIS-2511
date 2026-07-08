'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

export default function MyOrders() {
  const router = useRouter()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }

      const { data: customerData } = await supabase
        .from('customers')
        .select('id')
        .eq('profile_id', user.id)
        .single()

      if (customerData) {
        const { data: ordersData } = await supabase
          .from('customer_orders')
          .select('*, customer_order_items(count)')
          .eq('customer_id', customerData.id)
          .order('created_at', { ascending: false })

        setOrders(ordersData || [])
      }

      setLoading(false)
    }

    fetchData()
  }, [])

  const itemCount = (order) => order.customer_order_items?.[0]?.count ?? 0

  const getStatusStyle = (status) => {
    const styles = {
      ready_for_shipment: 'bg-black text-white',
      warehouse_preparation: 'bg-gray-200 text-gray-700',
      partially_received: 'bg-gray-200 text-gray-700',
      awaiting_down_payment: 'bg-gray-200 text-gray-700',
      shipped: 'bg-gray-200 text-gray-700',
    }
    return styles[status] || 'bg-gray-200 text-gray-700'
  }

  const formatStatus = (status) =>
    status?.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()) || 'Unknown'

  const formatDate = (d) =>
    d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'

  // Orders whose fulfillment has started open the order tracker; earlier
  // quotation/PFI stages (and cancellations) open the quotation view
  // (same customer_orders row). Values per customer_orders_status_check.
  const ORDER_PHASE = [
    'payment_verified', 'procurement_started', 'partially_received',
    'warehouse_preparation', 'ready_for_shipment', 'shipped', 'completed',
  ]
  const detailPath = (order) =>
    ORDER_PHASE.includes(order.status)
      ? `/customer/orders/${order.id}`
      : `/customer/quotation/${order.id}`

  const statusCounts = orders.reduce((acc, o) => {
    acc[o.status] = (acc[o.status] || 0) + 1
    return acc
  }, {})
  const statusTabs = ['all', ...Object.keys(statusCounts)]

  const filteredOrders = orders.filter((o) => {
    const matchesStatus = statusFilter === 'all' || o.status === statusFilter
    const q = search.toLowerCase()
    const matchesSearch =
      o.order_number?.toLowerCase().includes(q) ||
      o.destination_country?.toLowerCase().includes(q)
    return matchesStatus && matchesSearch
  })

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500">Loading...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-100 flex">

      {/* Sidebar */}
      <div className="w-56 bg-white border-r border-gray-200 flex flex-col p-4 fixed h-full">
        <div className="flex items-center gap-2 mb-8">
          <Image src="/dmc-logo.png" alt="DMC" width={36} height={36} />
          <span className="font-semibold text-sm">DMC Export</span>
        </div>
        <p className="text-xs text-gray-400 uppercase mb-2">My Account</p>
        <nav className="flex flex-col gap-1">
          {[
            { label: 'Dashboard', path: '/customer/dashboard' },
            { label: 'My Orders', path: '/customer/orders' },
            { label: 'Product Catalog', path: '/customer/catalog' },
            { label: 'Request Quotation', path: '/customer/quotation/new' },
            { label: 'Documents', path: '/customer/documents' },
            { label: 'Profile & Settings', path: '/customer/profile' },
          ].map((item) => (
            <button
              key={item.label}
              onClick={() => router.push(item.path)}
              className={`text-left text-sm px-3 py-2 rounded ${item.label === 'My Orders' ? 'font-semibold text-black bg-gray-50' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              • {item.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Main Content */}
      <div className="ml-56 flex-1 p-8">

        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900">My orders</h1>
            <p className="text-sm text-gray-500">Track all your quotations and orders in one place.</p>
          </div>
          <button
            onClick={() => router.push('/customer/quotation/new')}
            className="bg-black text-white text-sm px-4 py-2 rounded hover:bg-gray-800 whitespace-nowrap"
          >
            + Request quotation
          </button>
        </div>

        {/* Status filter tabs */}
        <div className="flex flex-wrap gap-2 mb-4">
          {statusTabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`text-xs px-3 py-1.5 rounded-full border ${statusFilter === tab ? 'bg-black text-white border-black' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
            >
              {tab === 'all' ? `All (${orders.length})` : `${formatStatus(tab)} (${statusCounts[tab]})`}
            </button>
          ))}
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder="Search by order number or destination..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm text-black bg-white mb-4 focus:outline-none focus:ring-2 focus:ring-gray-400"
        />

        {/* Orders table */}
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 uppercase border-b border-gray-100">
                <th className="pb-2">Order #</th>
                <th className="pb-2">Date Placed</th>
                <th className="pb-2">Destination</th>
                <th className="pb-2">Items</th>
                <th className="pb-2">Est. Ship Date</th>
                <th className="pb-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-gray-400">
                    {orders.length === 0 ? 'No orders yet' : 'No orders match your filters'}
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => (
                  <tr
                    key={order.id}
                    onClick={() => router.push(detailPath(order))}
                    className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer"
                  >
                    <td className="py-3 font-medium">{order.order_number}</td>
                    <td className="py-3 text-gray-600">{formatDate(order.order_date)}</td>
                    <td className="py-3 text-gray-600">{order.destination_country || '—'}</td>
                    <td className="py-3 text-gray-600">{itemCount(order)} SKUs</td>
                    <td className="py-3 text-gray-600">{formatDate(order.estimated_ready_date)}</td>
                    <td className="py-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusStyle(order.status)}`}>
                        {formatStatus(order.status)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  )
}
