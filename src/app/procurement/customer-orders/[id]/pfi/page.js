'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { createRecord, fetchOrderManagementData, formatDate, money, updateRecord } from '@/lib/orderManagement'
import { supabase } from '@/lib/supabaseClient'
import { Badge, Button, Card, EmptyState, OrderShell, TableSkeleton, statusTone, useToast } from '@/components/order-management/ui'

const addDays = (date, days) => {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next.toISOString().slice(0, 10)
}

const numericInput = (value) => {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

export default function PfiBuilderPage() {
  const params = useParams()
  const toast = useToast()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [prices, setPrices] = useState({})
  const [shippingAmount, setShippingAmount] = useState('0')
  const [validUntil, setValidUntil] = useState(addDays(new Date(), 14))
  const [initializedOrderId, setInitializedOrderId] = useState(null)

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

  const order = useMemo(
    () => (data?.customerOrders || []).find((item) => String(item.id) === String(params.id)),
    [data, params.id],
  )

  useEffect(() => {
    if (!order || initializedOrderId === order.id) return
    setPrices(Object.fromEntries(order.items.map((item) => [item.id, item.unitPrice ? String(item.unitPrice) : ''])))
    setShippingAmount(String(order.billing?.shipping_amount ?? 0))
    setValidUntil(order.billing?.valid_until || addDays(new Date(), 14))
    setInitializedOrderId(order.id)
  }, [initializedOrderId, order])

  const subtotal = (order?.items || []).reduce((sum, item) => sum + item.quantity * numericInput(prices[item.id]), 0)
  const shipping = numericInput(shippingAmount)
  const total = subtotal + shipping
  const downPayment = total / 2

  const savePfi = async (event) => {
    event.preventDefault()
    if (!order) return

    if (String(order.status || '').toLowerCase() !== 'submitted') {
      toast?.show('PFIs can only be prepared while the quotation is submitted.', 'error')
      return
    }

    if (order.items.length === 0) {
      toast?.show('Add at least one ordered product before building a PFI.', 'error')
      return
    }

    const pricedItems = order.items.map((item) => ({ item, unitPrice: Number(prices[item.id]) }))
    const invalidItem = pricedItems.find(({ unitPrice }) => !Number.isFinite(unitPrice) || unitPrice < 0)
    if (invalidItem) {
      toast?.show('Enter a valid USD unit price for every line item.', 'error')
      return
    }

    if (!validUntil) {
      toast?.show('Select an expiry date for this PFI.', 'error')
      return
    }

    setSaving(true)
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError) throw new Error(userError.message)
      if (!userData?.user?.id) throw new Error('You must be logged in as admin or sales to prepare a PFI.')

      await Promise.all(pricedItems.map(({ item, unitPrice }) =>
        updateRecord('customer_order_items', item, { unit_price: unitPrice }),
      ))

      const billingPayload = {
        order_id: order.id,
        shipping_amount: shipping,
        total_amount: total,
        down_payment_required: downPayment,
        balance_amount: total - downPayment,
        valid_until: validUntil,
        prepared_by: userData.user.id,
        currency: 'USD',
      }

      if (order.billing) {
        await updateRecord('billings', order.billing, billingPayload)
        toast?.show('PFI updated and remains available to the customer.')
      } else {
        const { data: billingNumber, error: numberError } = await supabase.rpc('next_document_number', { p_prefix: 'PFI' })
        if (numberError) throw new Error(numberError.message)
        await createRecord('billings', { ...billingPayload, billing_number: billingNumber })
        toast?.show('PFI created and sent to the customer.')
      }

      await refresh()
    } catch (error) {
      toast?.show(error.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <OrderShell title="PFI Builder" description="Set quotation prices and prepare the customer pro forma invoice.">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Link href={`/order-management/customer-orders/${params.id}`} className="text-sm font-medium text-gray-700 hover:underline">Back to order details</Link>
        {order?.billing && <Badge tone="black">{order.billing.billing_number}</Badge>}
      </div>

      {loading ? (
        <Card><TableSkeleton cols={4} rows={6} /></Card>
      ) : !order ? (
        <Card><EmptyState title="Order not found" description="The selected customer order could not be found." /></Card>
      ) : (
        <form onSubmit={savePfi} className="grid gap-6 xl:grid-cols-[1fr_340px]">
          <div className="space-y-6">
            <Card title="Quotation">
              <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <dt className="font-medium text-gray-500">Quotation</dt>
                  <dd className="mt-1 text-gray-900">{order.quotation_number || order.orderNumber}</dd>
                </div>
                <div>
                  <dt className="font-medium text-gray-500">Customer</dt>
                  <dd className="mt-1 text-gray-900">{order.customerName}</dd>
                </div>
                <div>
                  <dt className="font-medium text-gray-500">Submitted</dt>
                  <dd className="mt-1 text-gray-900">{formatDate(order.orderDate)}</dd>
                </div>
                <div>
                  <dt className="font-medium text-gray-500">PFI State</dt>
                  <dd className="mt-1"><Badge tone={order.billing ? 'black' : statusTone(order.status)}>{order.pfiState}</Badge></dd>
                </div>
              </dl>
            </Card>

            <Card title="Line Item Pricing">
              {order.items.length === 0 ? (
                <EmptyState title="No ordered products" description="Add customer order items before preparing a PFI." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-gray-100 text-xs uppercase text-gray-400">
                      <tr>
                        <th className="py-3 pr-4">Product</th>
                        <th className="py-3 pr-4">Quantity</th>
                        <th className="py-3 pr-4">Unit Price (USD)</th>
                        <th className="py-3">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {order.items.map((item) => (
                        <tr key={item.id}>
                          <td className="py-3 pr-4 font-medium">{item.productName}</td>
                          <td className="py-3 pr-4 text-gray-600">{item.quantity}</td>
                          <td className="py-3 pr-4">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={prices[item.id] ?? ''}
                              onChange={(event) => setPrices({ ...prices, [item.id]: event.target.value })}
                              className="w-32 rounded border border-gray-300 bg-white px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-gray-400"
                              required
                            />
                          </td>
                          <td className="py-3 font-medium">{money(item.quantity * numericInput(prices[item.id]))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>

          <div className="space-y-6">
            <Card title="PFI Totals">
              <div className="space-y-4">
                <label className="block text-sm font-medium text-gray-700">Estimated shipping (USD)
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={shippingAmount}
                    onChange={(event) => setShippingAmount(event.target.value)}
                    className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-gray-400"
                    required
                  />
                </label>
                <label className="block text-sm font-medium text-gray-700">Expires
                  <input
                    type="date"
                    value={validUntil}
                    onChange={(event) => setValidUntil(event.target.value)}
                    className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-gray-400"
                    required
                  />
                </label>
                <div className="border-t border-gray-100 pt-4 text-sm">
                  <div className="flex justify-between py-1">
                    <span className="text-gray-500">Products subtotal</span>
                    <span>{money(subtotal)}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-gray-500">Shipping</span>
                    <span>{money(shipping)}</span>
                  </div>
                  <div className="flex justify-between py-2 text-base font-semibold">
                    <span>Total</span>
                    <span>{money(total)}</span>
                  </div>
                  <div className="flex justify-between py-1 text-gray-600">
                    <span>Down payment required</span>
                    <span>{money(downPayment)}</span>
                  </div>
                  <div className="flex justify-between py-1 text-gray-600">
                    <span>Balance amount</span>
                    <span>{money(total - downPayment)}</span>
                  </div>
                </div>
                <Button className="w-full" disabled={saving || order.items.length === 0}>
                  {saving ? 'Saving...' : order.billing ? 'Update PFI' : 'Create PFI'}
                </Button>
              </div>
            </Card>

            <Card title="Builder Rules">
              <div className="space-y-2 text-sm text-gray-600">
                <p>Customer order status remains {order.status}.</p>
                <p>{order.billing ? 'This order already has one billing row, so saving will update it.' : 'A new billing row will use the PFI document-number RPC.'}</p>
                <p>Currency is USD and payment split is 50% down payment, 50% balance.</p>
              </div>
            </Card>
          </div>
        </form>
      )}
    </OrderShell>
  )
}
