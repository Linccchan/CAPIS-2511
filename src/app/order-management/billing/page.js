'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Badge, Button, Card, EmptyState, OrderShell, TableSkeleton, useToast } from '@/components/order-management/ui'

export default function BillingPayments() {
  const toast = useToast()
  const [billings, setBillings] = useState([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState('')

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('billings')
      .select('*, customer_orders(id, order_number, status, customers(company_name)), payments(*)')
      .order('created_at', { ascending: false })

    if (error) toast?.show(error.message, 'error')
    setBillings(data || [])
    setLoading(false)
  }, [toast])

  useEffect(() => { load() }, [load])

  const formatDate = (d) =>
    d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'

  const money = (n) => (n == null ? '—' : `$${Number(n).toFixed(2)}`)

  const dpStatus = (b) => {
    const p = (b.payments || []).filter((x) => x.payment_type === 'down_payment')
    if (p.some((x) => x.status === 'verified')) return ['Confirmed', 'green']
    if (p.some((x) => x.status === 'pending')) return ['Pending verification', 'yellow']
    return ['Unconfirmed', 'gray']
  }

  const balStatus = (b) => {
    const p = (b.payments || []).filter((x) => x.payment_type === 'balance')
    if (p.some((x) => x.status === 'verified')) return ['Paid', 'green']
    if (p.some((x) => x.status === 'pending')) return ['Pending verification', 'yellow']
    const orderStatus = b.customer_orders?.status
    if (orderStatus === 'shipped' || orderStatus === 'completed') return ['Due — awaiting payment', 'gray']
    if (dpStatus(b)[0] !== 'Confirmed') return ['Blocked', 'gray']
    return ['Awaiting BOL', 'gray']
  }

  const pendingPayments = billings.flatMap((b) =>
    (b.payments || [])
      .filter((p) => p.status === 'pending')
      .map((p) => ({ ...p, billing: b }))
  )

  const viewProof = async (p) => {
    if (!p.proof_file_path) { toast?.show('No proof file attached.', 'error'); return }
    const { data, error } = await supabase.storage
      .from('payment-proofs')
      .createSignedUrl(p.proof_file_path, 3600)
    if (error || !data?.signedUrl) toast?.show('Could not open proof: ' + (error?.message || 'unknown error'), 'error')
    else window.open(data.signedUrl, '_blank')
  }

  const decide = async (p, approve) => {
    setActing(p.id)
    const { data: { user } } = await supabase.auth.getUser()

    const { error } = await supabase
      .from('payments')
      .update({
        status: approve ? 'verified' : 'rejected',
        verified_by: user?.id || null,
        verified_at: new Date().toISOString(),
      })
      .eq('id', p.id)

    if (error) {
      toast?.show(error.message, 'error')
      setActing('')
      return
    }

    if (approve) {
      if (p.payment_type === 'down_payment') {
        // Payment verification is the workflow trigger: procurement may begin
        await supabase
          .from('customer_orders')
          .update({ status: 'payment_verified' })
          .eq('id', p.billing.customer_orders?.id)
          .eq('status', 'awaiting_down_payment')
        await supabase
          .from('billings')
          .update({ billing_status: 'partially_paid' })
          .eq('id', p.billing.id)
        toast?.show('Down payment verified — order moved to Payment Verified.')
      } else {
        await supabase
          .from('billings')
          .update({ billing_status: 'paid' })
          .eq('id', p.billing.id)
        toast?.show('Balance payment verified — billing fully paid.')
      }
    } else {
      toast?.show('Payment rejected. The customer can submit a corrected record.')
    }

    setActing('')
    await load()
  }

  return (
    <OrderShell
      title="Billing & Payments"
      description="Monitor billing records and verify telegraphic-transfer payments. Verified down payments release orders to procurement."
    >
      <div className="space-y-6">

        <Card title={`Payment verification queue (${pendingPayments.length})`}>
          {loading ? <TableSkeleton cols={7} /> : pendingPayments.length === 0 ? (
            <EmptyState title="No payments awaiting verification" description="Customer payment records appear here as soon as they are submitted." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-gray-100 text-xs uppercase text-gray-400">
                  <tr>
                    <th className="py-3 pr-4">Order</th>
                    <th className="py-3 pr-4">Customer</th>
                    <th className="py-3 pr-4">Type</th>
                    <th className="py-3 pr-4">Bank</th>
                    <th className="py-3 pr-4">Amount</th>
                    <th className="py-3 pr-4">Date</th>
                    <th className="py-3 pr-4">Proof</th>
                    <th className="py-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {pendingPayments.map((p) => (
                    <tr key={p.id}>
                      <td className="py-3 pr-4 font-medium">{p.billing.customer_orders?.order_number}</td>
                      <td className="py-3 pr-4 text-gray-600">{p.billing.customer_orders?.customers?.company_name || '—'}</td>
                      <td className="py-3 pr-4"><Badge tone="gray">{p.payment_type === 'down_payment' ? 'Down payment' : 'Balance'}</Badge></td>
                      <td className="py-3 pr-4 text-gray-600">{p.bank_name}</td>
                      <td className="py-3 pr-4 font-medium">{money(p.amount)}</td>
                      <td className="py-3 pr-4 text-gray-600">{formatDate(p.payment_date)}</td>
                      <td className="py-3 pr-4">
                        <button onClick={() => viewProof(p)} className="text-sm font-medium text-gray-900 hover:underline">
                          View slip
                        </button>
                      </td>
                      <td className="py-3">
                        <div className="flex gap-2">
                          <Button onClick={() => decide(p, true)} disabled={acting === p.id}>
                            {acting === p.id ? '...' : 'Verify'}
                          </Button>
                          <Button variant="secondary" onClick={() => decide(p, false)} disabled={acting === p.id}>
                            Reject
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title="Billing records">
          {loading ? <TableSkeleton cols={7} /> : billings.length === 0 ? (
            <EmptyState title="No billings yet" description="Billings are created by the PFI builder when a quotation is priced." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-gray-100 text-xs uppercase text-gray-400">
                  <tr>
                    <th className="py-3 pr-4">PFI #</th>
                    <th className="py-3 pr-4">Order</th>
                    <th className="py-3 pr-4">Customer</th>
                    <th className="py-3 pr-4">Total (USD)</th>
                    <th className="py-3 pr-4">Down payment (50%)</th>
                    <th className="py-3 pr-4">DP status</th>
                    <th className="py-3 pr-4">Balance (50%)</th>
                    <th className="py-3">Balance status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {billings.map((b) => {
                    const [dpLabel, dpTone] = dpStatus(b)
                    const [balLabel, balTone] = balStatus(b)
                    return (
                      <tr key={b.id}>
                        <td className="py-3 pr-4 font-medium">{b.billing_number}</td>
                        <td className="py-3 pr-4 text-gray-600">{b.customer_orders?.order_number}</td>
                        <td className="py-3 pr-4 text-gray-600">{b.customer_orders?.customers?.company_name || '—'}</td>
                        <td className="py-3 pr-4 font-medium">{money(b.total_amount)}</td>
                        <td className="py-3 pr-4">{money(b.down_payment_required)}</td>
                        <td className="py-3 pr-4"><Badge tone={dpTone}>{dpLabel}</Badge></td>
                        <td className="py-3 pr-4">{money(b.balance_amount)}</td>
                        <td className="py-3"><Badge tone={balTone}>{balLabel}</Badge></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

      </div>
    </OrderShell>
  )
}
