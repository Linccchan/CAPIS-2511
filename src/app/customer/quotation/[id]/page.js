'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter, useParams } from 'next/navigation'
import Image from 'next/image'

export default function QuotationDetail() {
  const router = useRouter()
  const params = useParams()
  const orderRef = params.id

  const [order, setOrder] = useState(null)
  const [orderItems, setOrderItems] = useState([])
  const [billing, setBilling] = useState(null)
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [approving, setApproving] = useState(false)

  // Payment form
  const [payBank, setPayBank] = useState('BDO')
  const [payAmount, setPayAmount] = useState('')
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0])
  const [proofFile, setProofFile] = useState(null)
  const [submittingPayment, setSubmittingPayment] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }

      let { data: orderData } = await supabase
        .from('customer_orders')
        .select('*')
        .eq('id', orderRef)
        .maybeSingle()

      if (!orderData) {
        const { data } = await supabase
          .from('customer_orders')
          .select('*')
          .eq('quotation_number', orderRef)
          .maybeSingle()
        orderData = data
      }

      if (!orderData) {
        const { data } = await supabase
          .from('customer_orders')
          .select('*')
          .eq('order_number', orderRef)
          .maybeSingle()
        orderData = data
      }

      setOrder(orderData)

      if (!orderData?.id) {
        setOrderItems([])
        setBilling(null)
        setLoading(false)
        return
      }

      const { data: itemsData } = await supabase
        .from('customer_order_items')
        .select('*, products(product_name)')
        .eq('order_id', orderData.id)

      setOrderItems(itemsData || [])

      const { data: billingData } = await supabase
        .from('billings')
        .select('*, profiles(full_name)')
        .eq('order_id', orderData.id)
        .maybeSingle()

      setBilling(billingData)

      if (billingData) {
        setPayAmount(billingData.down_payment_required ? String(billingData.down_payment_required) : '')
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
  }, [orderRef, router])

  const getStepNumber = (status) => {
    if (status === 'submitted') return billing ? 3 : 2
    const steps = {
      awaiting_down_payment: 4,
      payment_verified: 5,
      procurement_started: 5,
      partially_received: 5,
      warehouse_preparation: 5,
      ready_for_shipment: 5,
      shipped: 5,
      completed: 5,
    }
    return steps[status] || 1
  }

  const handleApprove = async () => {
    setApproving(true)
    const { error } = await supabase.rpc('approve_quotation', { p_order_id: order.id })
    if (error) {
      console.error('Approve error:', JSON.stringify(error))
      alert('Error: ' + error.message)
      setApproving(false)
      return
    }
    const { data: orderData } = await supabase
      .from('customer_orders')
      .select('*')
      .eq('id', order.id)
      .single()
    setOrder(orderData)
    setApproving(false)
  }

  const handleSubmitPayment = async () => {
    if (!proofFile) { alert('Please attach your telegraphic transfer slip.'); return }
    if (proofFile.size > 10 * 1024 * 1024) { alert('File is too large — maximum 10 MB.'); return }
    const amount = parseFloat(payAmount)
    const required = Number(billing?.down_payment_required || 0)
    if (!amount || Math.abs(amount - required) > 0.005) {
      alert(`The down payment is fixed at $${required.toFixed(2)} (50% of the PFI total).`)
      return
    }
    setSubmittingPayment(true)

    const { data: { user } } = await supabase.auth.getUser()
    const ext = proofFile.name.split('.').pop()
    const proofPath = `${user.id}/${order.id}-down_payment-${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('payment-proofs')
      .upload(proofPath, proofFile)

    if (uploadError) {
      console.error('Upload error:', JSON.stringify(uploadError))
      alert('Upload error: ' + uploadError.message)
      setSubmittingPayment(false)
      return
    }

    const { error: paymentError } = await supabase
      .from('payments')
      .insert({
        billing_id: billing.id,
        payment_type: 'down_payment',
        bank_name: payBank,
        amount,
        payment_date: payDate,
        proof_file_path: proofPath,
        status: 'pending',
      })

    if (paymentError) {
      console.error('Payment error:', JSON.stringify(paymentError))
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

  const dpPayment = payments.find((p) => p.payment_type === 'down_payment' && p.status !== 'rejected')
  const todayStr = new Date().toISOString().split('T')[0]
  const pfiExpired = Boolean(billing?.valid_until && billing.valid_until < todayStr)
  const hasUnpricedItems = orderItems.some((i) => i.unit_price == null)

  const steps = ['Submitted', 'DMC prepared PFI', 'Your approval', 'Down payment', 'Order confirmed']

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

  const currentStep = getStepNumber(order.status)

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
              className="text-left text-sm px-3 py-2 rounded text-gray-600 hover:bg-gray-100"
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
          ← My orders
        </button>

        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Quotation {order.quotation_number || order.order_number}</h1>
            <p className="text-sm text-gray-500">
              Submitted {order.order_date ? new Date(order.order_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'} · {order.destination_country} · {orderItems.length} products
            </p>
          </div>
          <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded">
            {order.status === 'submitted'
              ? (billing ? 'PFI ready — awaiting your approval' : 'DMC is preparing your PFI')
              : order.status === 'awaiting_down_payment'
                ? 'Approved — awaiting down payment'
                : order.status?.replace(/_/g, ' ')}
          </span>
        </div>

        {/* Steps */}
        <div className="flex items-center gap-2 mb-8 text-xs">
          {steps.map((step, i) => (
            <div key={step} className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold ${i + 1 < currentStep ? 'bg-black text-white' : i + 1 === currentStep ? 'border-2 border-black text-black' : 'border border-gray-300 text-gray-400'}`}>
                {i + 1 < currentStep ? '✓' : i + 1}
              </div>
              <span className={i + 1 <= currentStep ? 'text-gray-900 font-medium' : 'text-gray-400'}>{step}</span>
              {i < steps.length - 1 && <div className="w-8 h-px bg-gray-200" />}
            </div>
          ))}
        </div>

        <div className="flex gap-6">

          {/* Left — PFI Details */}
          <div className="flex-1">
            <div className="bg-white rounded-lg border border-gray-200 p-5 mb-4">
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-semibold text-gray-900">
                  Pro forma invoice — {billing ? billing.billing_number : 'Pending'}
                </h2>
                {billing && (
                  <button className="text-sm border border-gray-300 px-3 py-1 rounded hover:bg-gray-50">
                    Download PDF
                  </button>
                )}
              </div>

              {!billing ? (
                <div className="text-center py-8">
                  <p className="text-sm text-gray-400">DMC is preparing your pro forma invoice.</p>
                  <p className="text-xs text-gray-400 mt-1">You will be notified once it is ready for review.</p>
                </div>
              ) : (
                <>
                  <table className="w-full text-sm mb-4">
                    <thead>
                      <tr className="text-left text-xs text-gray-400 uppercase border-b border-gray-100">
                        <th className="pb-2">Product</th>
                        <th className="pb-2">Qty</th>
                        <th className="pb-2">Unit Price (USD)</th>
                        <th className="pb-2">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orderItems.map((item) => (
                        <tr key={item.id} className="border-b border-gray-50">
                          <td className="py-3">{item.products?.product_name || '—'}</td>
                          <td className="py-3">{item.quantity_ordered} cs</td>
                          <td className="py-3">{item.unit_price ? `$${item.unit_price}` : '—'}</td>
                          <td className="py-3">
                            {item.unit_price ? `$${(item.unit_price * item.quantity_ordered).toFixed(2)}` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="border-t border-gray-100 pt-4 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Subtotal</span>
                      <span>${((billing.total_amount || 0) - (billing.shipping_amount || 0)).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Shipping (est.)</span>
                      <span>${(billing.shipping_amount || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-base">
                      <span>Total</span>
                      <span>${billing.total_amount?.toFixed(2) || '—'}</span>
                    </div>
                    <div className="flex justify-between text-gray-500">
                      <span>Down payment required (50%)</span>
                      <span>${billing.down_payment_required?.toFixed(2) || '—'}</span>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Approve Section */}
            {billing && order.status === 'submitted' && (
              <div className="bg-white rounded-lg border border-gray-200 p-5">
                {pfiExpired ? (
                  <>
                    <h2 className="font-semibold text-gray-900 mb-3">This quotation has expired</h2>
                    <p className="text-sm text-gray-500">
                      The pro forma invoice was valid until {new Date(billing.valid_until).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}.
                      Supplier prices may have changed — please contact DMC for a refreshed quotation before approving.
                    </p>
                  </>
                ) : (
                  <>
                    <h2 className="font-semibold text-gray-900 mb-3">Approve this quotation</h2>
                    <p className="text-sm text-gray-500 mb-4">
                      By approving, you confirm the products and quantities listed above. DMC will proceed with procurement after receiving your down payment.
                    </p>
                    {hasUnpricedItems && (
                      <p className="text-sm text-gray-400 mb-4">Some items have not been priced yet — approval is disabled until DMC completes the PFI.</p>
                    )}
                    <button
                      onClick={handleApprove}
                      disabled={approving || hasUnpricedItems}
                      className="bg-black text-white px-6 py-2 rounded text-sm hover:bg-gray-800 disabled:opacity-50"
                    >
                      {approving ? 'Approving...' : 'Approve quotation →'}
                    </button>
                  </>
                )}
              </div>
            )}

            {billing && order.status === 'awaiting_down_payment' && (
              <div className="bg-white rounded-lg border border-gray-200 p-5">
                {dpPayment ? (
                  <>
                    <h2 className="font-semibold text-gray-900 mb-3">Down payment submitted</h2>
                    <p className="text-sm text-gray-500 mb-3">
                      {dpPayment.status === 'verified'
                        ? 'Your down payment has been verified. DMC is starting procurement.'
                        : 'DMC is verifying your payment. Procurement begins once it is confirmed.'}
                    </p>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Amount</span>
                        <span className="font-medium">${Number(dpPayment.amount).toFixed(2)} via {dpPayment.bank_name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Payment date</span>
                        <span className="font-medium">{dpPayment.payment_date ? new Date(dpPayment.payment_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Status</span>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${dpPayment.status === 'verified' ? 'bg-black text-white' : 'bg-gray-200 text-gray-700'}`}>
                          {dpPayment.status === 'verified' ? 'Verified' : 'Pending Verification'}
                        </span>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <h2 className="font-semibold text-gray-900 mb-3">Quotation approved — record your down payment</h2>
                    <p className="text-sm text-gray-500 mb-4">
                      Send the 50% down payment of <span className="font-medium text-gray-900">${billing.down_payment_required?.toFixed(2) || '—'}</span> via
                      telegraphic transfer (BDO or Chinabank), then record it below with your transfer slip. DMC will verify and begin procurement.
                    </p>
                    {payments.some((p) => p.status === 'rejected') && (
                      <div className="bg-red-50 text-red-600 text-sm p-3 rounded mb-4">
                        Your previous payment record was rejected. Please check the details and submit again, or contact DMC.
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Bank</label>
                        <select
                          value={payBank}
                          onChange={(e) => setPayBank(e.target.value)}
                          className="w-full border border-gray-300 rounded px-3 py-2 text-sm text-black bg-white"
                        >
                          <option value="BDO">BDO</option>
                          <option value="Chinabank">Chinabank</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Amount (USD)</label>
                        <input
                          type="number"
                          value={payAmount}
                          readOnly
                          className="w-full border border-gray-300 rounded px-3 py-2 text-sm text-gray-600 bg-gray-50 cursor-not-allowed"
                        />
                        <p className="text-xs text-gray-400 mt-1">Fixed at 50% of the PFI total.</p>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Payment Date</label>
                        <input
                          type="date"
                          max={new Date().toISOString().split('T')[0]}
                          value={payDate}
                          onChange={(e) => setPayDate(e.target.value)}
                          className="w-full border border-gray-300 rounded px-3 py-2 text-sm text-black"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Transfer Slip (Image or PDF)</label>
                        <input
                          type="file"
                          accept="image/*,.pdf"
                          onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                          className="w-full text-sm text-gray-600 file:mr-3 file:border file:border-gray-300 file:rounded file:px-3 file:py-1.5 file:text-sm file:bg-white file:text-gray-700 hover:file:bg-gray-50"
                        />
                      </div>
                    </div>
                    <button
                      onClick={handleSubmitPayment}
                      disabled={submittingPayment}
                      className="bg-black text-white px-6 py-2 rounded text-sm hover:bg-gray-800 disabled:opacity-50"
                    >
                      {submittingPayment ? 'Submitting...' : 'Submit payment record →'}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Right — Quotation Details */}
          <div className="w-64 flex-shrink-0">
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <h2 className="font-semibold text-gray-900 mb-4">Quotation details</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Quotation #</span>
                  <span className="font-medium">{order.quotation_number || order.order_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Submitted</span>
                  <span className="font-medium">
                    {order.order_date ? new Date(order.order_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Destination</span>
                  <span className="font-medium">{order.destination_country}</span>
                </div>
                {billing && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-gray-500">PFI sent</span>
                      <span className="font-medium">
                        {billing.created_at ? new Date(billing.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Expires</span>
                      <span className="font-medium">
                        {billing.valid_until ? new Date(billing.valid_until).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Prepared by</span>
                      <span className="font-medium">{billing.profiles?.full_name || 'DMC'}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
