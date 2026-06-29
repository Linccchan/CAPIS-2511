'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

export default function CustomerDashboard() {
  const router = useRouter()
  const [customer, setCustomer] = useState(null)
  const [orders, setOrders] = useState([])
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }

      const { data: customerData } = await supabase
        .from('customers')
        .select('*')
        .eq('profile_id', user.id)
        .single()

      setCustomer(customerData)

      if (customerData) {
        const { data: ordersData } = await supabase
          .from('customer_orders')
          .select('*')
          .eq('customer_id', customerData.id)
          .order('created_at', { ascending: false })
          .limit(10)

        setOrders(ordersData || [])
      }

      setLoading(false)
    }

    fetchData()
  }, [])

  const activeOrders = orders.filter(o => o.status !== 'shipped')
  const readyOrders = orders.filter(o => o.status === 'ready_for_shipment')

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

  const formatStatus = (status) => {
    return status?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Unknown'
  }

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
          {['Dashboard', 'My Orders', 'Place New Order', 'Documents', 'Profile & Settings'].map((item) => (
            <button
              key={item}
              className={`text-left text-sm px-3 py-2 rounded ${item === 'Dashboard' ? 'font-semibold text-black' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              • {item}
            </button>
          ))}
        </nav>
      </div>

      {/* Main Content */}
      <div className="ml-56 flex-1 p-8">

        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              Good morning, {customer?.company_name || 'Customer'}
            </h1>
            <p className="text-sm text-gray-500">Here's the status of your current orders.</p>
          </div>
          <button className="bg-black text-white text-sm px-4 py-2 rounded hover:bg-gray-800">
            + Place new order
          </button>
        </div>

        {/* Notification Banner */}
        {orders.some(o => o.status === 'ready_for_shipment') && (
          <div className="bg-white border border-gray-200 rounded p-3 mb-6 flex justify-between items-center text-sm">
            <span>● {readyOrders.length} unread update{readyOrders.length > 1 ? 's' : ''} — order ready for shipment</span>
            <button className="text-gray-500 hover:underline text-xs">View all</button>
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-lg p-5 border border-gray-200">
            <p className="text-3xl font-bold text-gray-900">{activeOrders.length}</p>
            <p className="text-sm text-gray-500 mt-1">Active orders</p>
          </div>
          <div className="bg-white rounded-lg p-5 border border-gray-200">
            <p className="text-3xl font-bold text-gray-900">{readyOrders.length}</p>
            <p className="text-sm text-gray-500 mt-1">Ready for shipment</p>
          </div>
          <div className="bg-white rounded-lg p-5 border border-gray-200">
            <p className="text-3xl font-bold text-gray-900">{orders.length}</p>
            <p className="text-sm text-gray-500 mt-1">Orders this year</p>
          </div>
        </div>

        {/* Recent Orders */}
        <div className="bg-white rounded-lg border border-gray-200 p-5 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-semibold text-gray-900">Recent orders</h2>
            <button className="text-sm text-gray-500 hover:underline">View all</button>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 uppercase border-b border-gray-100">
                <th className="pb-2">Order #</th>
                <th className="pb-2">Date Placed</th>
                <th className="pb-2">Items</th>
                <th className="pb-2">Est. Ship Date</th>
                <th className="pb-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-gray-400">No orders yet</td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-3 font-medium">{order.order_number}</td>
                    <td className="py-3 text-gray-600">{order.order_date ? new Date(order.order_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</td>
                    <td className="py-3 text-gray-600">{order.destination_country}</td>
                    <td className="py-3 text-gray-600">{order.estimated_ready_date ? new Date(order.estimated_ready_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</td>
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

        {/* Notifications */}
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-semibold text-gray-900">Notifications</h2>
            <button className="text-sm text-gray-500 hover:underline">Mark all as read</button>
          </div>
          {orders.filter(o => o.status === 'ready_for_shipment').length === 0 ? (
            <p className="text-sm text-gray-400">No new notifications</p>
          ) : (
            orders.filter(o => o.status === 'ready_for_shipment').map((order) => (
              <div key={order.id} className="flex items-start gap-2 mb-3">
                <span className="text-black mt-1">●</span>
                <div>
                  <p className="text-sm font-medium">{order.order_number} is ready for shipment</p>
                  <p className="text-xs text-gray-400">Container booking confirmed</p>
                </div>
              </div>
            ))
          )}
        </div>

      </div>
    </div>
  )
}