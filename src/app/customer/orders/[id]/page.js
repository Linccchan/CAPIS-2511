'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter, useParams } from 'next/navigation'
import Image from 'next/image'

export default function OrderDetail() {
  const router = useRouter()
  const params = useParams()
  const orderId = params.id

  const [order, setOrder] = useState(null)
  const [orderItems, setOrderItems] = useState([])
  const [activity, setActivity] = useState([])
  const [billing, setBilling] = useState(null)
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)

  // Balance payment form
  const [payBank, setPayBank] = useState('BDO')
  const [payAmount, setPayAmount] = useState('')
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0])
  const [proofFile, setProofFile] = useState(null)
  const [submittingPayment, setSubmittingPayment] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }

      const { data: orderData } = await supabase
        .from('customer_orders')
        .select('*')
        .eq('id', orderId)
        .single()

      setOrder(orderData)

      const { data: itemsData } = await supabase
        .from('customer_order_items')
        .select('*, products(product_name, brand)')
        .eq('order_id', orderId)

      setOrderItems(itemsData || [])

      // activity_logs is RLS-locked for now, so this returns [] until a
      // customer-read policy is added — the panel degrades gracefully.
      const { data: activityData } = await supabase
        .from('activity_logs')
        .select('*')
        .eq('record_id', orderId)
        .order('created_at', { ascending: false })

      setActivity(activityData || [])

      const { data: billingData } = await supabase
        .from('billings')
        .select('*')
        .eq('order_id', orderId)
        .maybeSingle()

      setBilling(billingData)
      if (billingData) {
        setPayAmount(billingData.balance_amount ? String(billingData.balance_amount) : '')
        const { data: paymentsData } = await supabase
          .from('payments')
          .select('*')
          .eq('billing_id', billingData.id)
          .order('created_at', { ascending: false })
        setPayments(paymentsData || [])
      }

      setLoading(false)
    }

    fetchData()
  }, [orderId])

  // Statuses per customer_orders_status_check; cancelled falls back to 1
  // and is conveyed by the header badge rather than the stepper.
  const STEPS = ['Submitted', 'Payment verified', 'Procurement', 'Warehouse prep', 'Ready for shipment', 'Shipped']
  const stepForStatus = {
    draft: 1, submitted: 1, awaiting_down_payment: 1,
    payment_verified: 2,
    procurement_started: 3, partially_received: 3,
    warehouse_preparation: 4,
    ready_for_shipment: 5,
    shipped: 6, completed: 6,
  }

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

  const formatDateTime = (d) =>
    d ? new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'

  const handleSubmitBalance = async () => {
    if (!proofFile) { alert('Please attach your telegraphic transfer slip.'); return }
    if (proofFile.size > 10 * 1024 * 1024) { alert('File is too large — maximum 10 MB.'); return }
    const amount = parseFloat(payAmount)
    const required = Number(billing?.balance_amount || 0)
    if (!amount || Math.abs(amount - required) > 0.005) {
      alert(`The balance payment is fixed at $${required.toFixed(2)} as stated on the PFI.`)
      return
    }
    setSubmittingPayment(true)

    const { data: { user } } = await supabase.auth.getUser()
    const ext = proofFile.name.split('.').pop()
    const proofPath = `${user.id}/${order.id}-balance-${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('payment-proofs')
      .upload(proofPath, proofFile)

    if (uploadError) {
      alert('Upload error: ' + uploadError.message)
      setSubmittingPayment(false)
      return
    }

    const { error: paymentError } = await supabase
      .from('payments')
      .insert({
        billing_id: billing.id,
        payment_type: 'balance',
        bank_name: payBank,
        amount,
        payment_date: payDate,
        proof_file_path: proofPath,
        status: 'pending',
      })

    if (paymentError) {
      alert('Error: ' + paymentError.message)
      setSubmittingPayment(false)
      return
    }

    const { data: paymentsData } = await supabase
      .from('payments')
      .select('*')
      .eq('billing_id', billing.id)
      .order('created_at', { ascending: false })
    setPayments(paymentsData || [])
    setProofFile(null)
    setSubmittingPayment(false)
  }

  const balancePayment = payments.find((p) => p.payment_type === 'balance' && p.status !== 'rejected')
  const balanceDue = billing && (order?.status === 'shipped' || order?.status === 'completed')

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500">Loading...</p>
    </div>
  )

  if (!order) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500">Order not found.</p>
    </div>
  )

  const currentStep = stepForStatus[order.status] || 1
  const lastUpdated = activity[0]?.created_at || order.created_at

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

        {/* Back */}
        <button
          onClick={() => router.push('/customer/orders')}
          className="text-sm text-gray-500 hover:underline mb-4 block"
        >
          ← Back to orders
        </button>

        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Order {order.order_number}</h1>
            <p className="text-sm text-gray-500">
              Placed {formatDate(order.order_date)} · Destination: {order.destination_country || '—'} · Last updated {formatDateTime(lastUpdated)}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded text-xs font-medium ${getStatusStyle(order.status)}`}>
              {formatStatus(order.status)}
            </span>
            <button className="text-sm border border-gray-300 px-3 py-2 rounded hover:bg-gray-50">
              Download PFI
            </button>
          </div>
        </div>

        {/* Fulfillment progress */}
        <div className="bg-white rounded-lg border border-gray-200 p-5 mb-6">
          <h2 className="font-semibold text-gray-900 mb-4">Fulfillment progress</h2>
          <div className="flex items-center gap-2 mb-4 text-xs">
            {STEPS.map((step, i) => (
              <div key={step} className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold ${i + 1 < currentStep ? 'bg-black text-white' : i + 1 === currentStep ? 'border-2 border-black text-black' : 'border border-gray-300 text-gray-400'}`}>
                  {i + 1 < currentStep ? '✓' : i + 1}
                </div>
                <span className={i + 1 <= currentStep ? 'text-gray-900 font-medium' : 'text-gray-400'}>{step}</span>
                {i < STEPS.length - 1 && <div className="w-8 h-px bg-gray-200" />}
              </div>
            ))}
          </div>
          <div className="bg-gray-50 border border-gray-100 rounded p-3 text-sm">
            <span className="font-medium">Estimated ship date: {formatDate(order.estimated_ready_date)}</span>
            <span className="text-gray-500"> · Bill of lading will be sent upon dispatch</span>
          </div>
        </div>

        {/* Balance payment — due once shipped (after bill of lading) */}
        {balanceDue && (
          <div className="bg-white rounded-lg border border-gray-200 p-5 mb-6">
            {balancePayment ? (
              <>
                <h2 className="font-semibold text-gray-900 mb-3">Balance payment {balancePayment.status === 'verified' ? 'received' : 'submitted'}</h2>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Amount</span>
                    <span className="font-medium">${Number(balancePayment.amount).toFixed(2)} via {balancePayment.bank_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Status</span>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${balancePayment.status === 'verified' ? 'bg-black text-white' : 'bg-gray-200 text-gray-700'}`}>
                      {balancePayment.status === 'verified' ? 'Verified — fully paid' : 'Pending verification'}
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <>
                <h2 className="font-semibold text-gray-900 mb-3">Balance payment due</h2>
                <p className="text-sm text-gray-500 mb-4">
                  Your shipment is on its way and the bill of lading has been issued. Please send the remaining
                  balance of <span className="font-medium text-gray-900">${billing.balance_amount?.toFixed(2) || '—'}</span> via
                  telegraphic transfer and record it below.
                </p>
                <div className="grid grid-cols-4 gap-4 mb-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Bank</label>
                    <select value={payBank} onChange={(e) => setPayBank(e.target.value)} className="w-full border border-gray-300 rounded px-3 py-2 text-sm text-black bg-white">
                      <option value="BDO">BDO</option>
                      <option value="Chinabank">Chinabank</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Amount (USD)</label>
                    <input type="number" value={payAmount} readOnly className="w-full border border-gray-300 rounded px-3 py-2 text-sm text-gray-600 bg-gray-50 cursor-not-allowed" />
                    <p className="text-xs text-gray-400 mt-1">Remaining 50% per the PFI.</p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Payment Date</label>
                    <input type="date" max={new Date().toISOString().split('T')[0]} value={payDate} onChange={(e) => setPayDate(e.target.value)} className="w-full border border-gray-300 rounded px-3 py-2 text-sm text-black" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Transfer Slip</label>
                    <input type="file" accept="image/*,.pdf" onChange={(e) => setProofFile(e.target.files?.[0] || null)} className="w-full text-sm text-gray-600 file:mr-3 file:border file:border-gray-300 file:rounded file:px-3 file:py-1.5 file:text-sm file:bg-white file:text-gray-700 hover:file:bg-gray-50" />
                  </div>
                </div>
                <button
                  onClick={handleSubmitBalance}
                  disabled={submittingPayment}
                  className="bg-black text-white px-6 py-2 rounded text-sm hover:bg-gray-800 disabled:opacity-50"
                >
                  {submittingPayment ? 'Submitting...' : 'Submit balance payment →'}
                </button>
              </>
            )}
          </div>
        )}

        <div className="flex gap-6">

          {/* Left — Order items */}
          <div className="flex-1">
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <h2 className="font-semibold text-gray-900 mb-4">Order items ({orderItems.length} SKUs)</h2>
              {orderItems.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">No items on this order.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-400 uppercase border-b border-gray-100">
                      <th className="pb-2">Product</th>
                      <th className="pb-2">Qty</th>
                      <th className="pb-2">Supplier</th>
                      <th className="pb-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orderItems.map((item) => (
                      <tr key={item.id} className="border-b border-gray-50">
                        <td className="py-3">{item.products?.product_name || '—'}</td>
                        <td className="py-3 text-gray-600">{item.quantity_ordered} cs</td>
                        <td className="py-3 text-gray-600">{item.products?.brand || '—'}</td>
                        <td className="py-3 text-gray-400">—</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <p className="text-xs text-gray-400 mt-3">
                Per-item supplier and receiving status become available once warehouse processing begins.
              </p>
            </div>
          </div>

          {/* Right — Activity log */}
          <div className="w-72 flex-shrink-0">
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <h2 className="font-semibold text-gray-900 mb-4">Activity log</h2>
              {activity.length === 0 ? (
                <p className="text-sm text-gray-400">No activity recorded yet.</p>
              ) : (
                <div className="space-y-4">
                  {activity.map((entry) => (
                    <div key={entry.id} className="flex items-start gap-2">
                      <span className="text-black mt-1 text-xs">●</span>
                      <div>
                        <p className="text-sm font-medium">{entry.description || entry.action}</p>
                        <p className="text-xs text-gray-400">{formatDateTime(entry.created_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
