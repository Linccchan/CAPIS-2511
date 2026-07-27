'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useParams, useRouter } from 'next/navigation'

// Printable pro forma invoice. Uses the browser's own print dialog, which can
// save as PDF — no PDF library needed. Layout follows DMC's PFI: the logistics
// block (CBM / weights) and the 50/50 telegraphic-transfer terms matter as much
// as the prices, and the conforme line is what confirms the order.
export default function PrintablePfi() {
  const router = useRouter()
  const { id } = useParams()
  const [order, setOrder] = useState(null)
  const [items, setItems] = useState([])
  const [billing, setBilling] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }

      const { data: orderData } = await supabase
        .from('customer_orders')
        .select('*, customers(company_name, contact_person, address, country), customer_locations(label, address, country)')
        .eq('id', id)
        .maybeSingle()

      setOrder(orderData)

      if (orderData) {
        const { data: itemsData } = await supabase
          .from('customer_order_items')
          .select('*, products(product_name, sku, unit, unit_cbm, unit_weight_kg)')
          .eq('order_id', orderData.id)
        setItems(itemsData || [])

        const { data: billingData } = await supabase
          .from('billings')
          .select('*, profiles(full_name)')
          .eq('order_id', orderData.id)
          .maybeSingle()
        setBilling(billingData)
      }
      setLoading(false)
    }
    load()
  }, [id])

  const money = (n) => `$${Number(n || 0).toFixed(2)}`
  const date = (d) => (d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—')

  const totalCases = items.reduce((s, i) => s + Number(i.quantity_ordered || 0), 0)
  const totalCbm = items.reduce((s, i) => s + Number(i.quantity_ordered || 0) * Number(i.products?.unit_cbm || 0), 0)
  const netWeight = items.reduce((s, i) => s + Number(i.quantity_ordered || 0) * Number(i.products?.unit_weight_kg || 0), 0)
  const productsSubtotal = items.reduce((s, i) => s + Number(i.quantity_ordered || 0) * Number(i.unit_price || 0), 0)

  if (loading) return <div className="p-8 text-gray-500">Loading...</div>
  if (!order) return <div className="p-8 text-gray-500">Order not found.</div>

  const consignee = order.customers
  const shipTo = order.customer_locations

  return (
    <div className="min-h-screen bg-gray-100 p-8 print:bg-white print:p-0">
      <style>{`@media print { .no-print { display: none !important } }`}</style>

      <div className="mx-auto max-w-3xl">
        <div className="no-print mb-4 flex gap-2">
          <button onClick={() => window.print()} className="bg-black text-white px-4 py-2 rounded text-sm hover:bg-gray-800">
            Print / Save as PDF
          </button>
          <button onClick={() => router.back()} className="border border-gray-300 px-4 py-2 rounded text-sm hover:bg-gray-50">
            Back
          </button>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-8 print:border-0">
          {/* Header */}
          <div className="flex justify-between items-start border-b border-gray-200 pb-4 mb-4">
            <div>
              <p className="text-lg font-bold text-gray-900">DMC ENTERPRISE</p>
              <p className="text-xs text-gray-500">Export Consolidation · Manila, Philippines</p>
            </div>
            <div className="text-right text-sm">
              <p className="font-bold text-gray-900">PRO FORMA INVOICE</p>
              <p className="text-gray-600">{billing?.billing_number || 'Pending'}</p>
              <p className="text-gray-500 text-xs">Issued {date(billing?.created_at)}</p>
              {billing?.valid_until && <p className="text-gray-500 text-xs">Valid until {date(billing.valid_until)}</p>}
            </div>
          </div>

          {/* Parties */}
          <div className="grid grid-cols-2 gap-6 mb-4 text-sm">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Consignee</p>
              <p className="font-medium text-gray-900">{consignee?.company_name || '—'}</p>
              {consignee?.contact_person && <p className="text-gray-600">{consignee.contact_person}</p>}
              {consignee?.address && <p className="text-gray-600">{consignee.address}</p>}
              <p className="text-gray-600">{consignee?.country || ''}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Ship to</p>
              <p className="font-medium text-gray-900">{shipTo?.label || order.destination_country || '—'}</p>
              {shipTo?.address && <p className="text-gray-600">{shipTo.address}</p>}
              <p className="text-gray-600">{shipTo?.country || order.destination_country}</p>
              <p className="text-gray-500 text-xs mt-1">Order {order.order_number}</p>
            </div>
          </div>

          {/* Terms */}
          <div className="bg-gray-50 rounded p-3 mb-4 text-xs text-gray-600">
            <span className="font-medium text-gray-900">Payment terms:</span> 50% down payment via telegraphic transfer (BDO / Chinabank), balance upon issuance of the bill of lading.
            <span className="ml-2 font-medium text-gray-900">Currency:</span> {billing?.currency || 'USD'}
          </div>

          {/* Line items */}
          <table className="w-full text-sm mb-4">
            <thead>
              <tr className="text-left text-xs text-gray-400 uppercase border-b border-gray-200">
                <th className="pb-2">Description</th>
                <th className="pb-2">SKU</th>
                <th className="pb-2 text-right">Qty</th>
                <th className="pb-2 text-right">Unit Price</th>
                <th className="pb-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id} className="border-b border-gray-100">
                  <td className="py-2">{i.products?.product_name || '—'}</td>
                  <td className="py-2 text-gray-500 text-xs">{i.products?.sku || '—'}</td>
                  <td className="py-2 text-right">{i.quantity_ordered} {i.products?.unit || 'cs'}</td>
                  <td className="py-2 text-right">{i.unit_price ? money(i.unit_price) : '—'}</td>
                  <td className="py-2 text-right">{i.unit_price ? money(i.unit_price * i.quantity_ordered) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Logistics + totals */}
          <div className="grid grid-cols-2 gap-6 text-sm">
            <div className="space-y-1 text-gray-600">
              <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Shipment details</p>
              <div className="flex justify-between"><span>Total cases</span><span>{totalCases}</span></div>
              <div className="flex justify-between"><span>Total CBM</span><span>{totalCbm.toFixed(3)} m³</span></div>
              <div className="flex justify-between"><span>Net weight</span><span>{netWeight.toFixed(1)} kg</span></div>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-gray-600"><span>Products subtotal</span><span>{money(productsSubtotal)}</span></div>
              <div className="flex justify-between text-gray-600"><span>Shipping (est.)</span><span>{money(billing?.shipping_amount)}</span></div>
              <div className="flex justify-between font-bold text-gray-900 border-t border-gray-200 pt-1"><span>Total</span><span>{money(billing?.total_amount)}</span></div>
              <div className="flex justify-between text-gray-600"><span>Down payment (50%)</span><span>{money(billing?.down_payment_required)}</span></div>
              <div className="flex justify-between text-gray-600"><span>Balance</span><span>{money(billing?.balance_amount)}</span></div>
            </div>
          </div>

          {/* Signatures */}
          <div className="grid grid-cols-2 gap-6 mt-10 text-sm">
            <div>
              <p className="border-t border-gray-400 pt-1 text-gray-600">Prepared by</p>
              <p className="text-gray-900">{billing?.profiles?.full_name || 'DMC Enterprise'}</p>
            </div>
            <div>
              <p className="border-t border-gray-400 pt-1 text-gray-600">Conforme — customer signature over printed name</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
