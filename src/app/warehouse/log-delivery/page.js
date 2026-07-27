'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { useRouter } from 'next/navigation'

export default function LogDeliveryPage() {
  const router = useRouter()

  const [purchaseOrders, setPurchaseOrders] = useState([])
  // Dispatches the supplier has logged that the warehouse has not confirmed
  // yet. These POs are still 'sent', so they never appeared in the list below.
  const [awaitingReceipt, setAwaitingReceipt] = useState([])
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [selectedPO, setSelectedPO] = useState(null)
  const [showReceiveModal, setShowReceiveModal] = useState(false)
  const [items, setItems] = useState([])
  const [loadingItems, setLoadingItems] = useState(false)

  useEffect(() => {
    let active = true

    async function load() {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select(`
          *,
          suppliers(supplier_name),
          customer_orders(order_number),
          purchase_order_items(
            id,
            sticker_progress,
            quantity_ordered
          )
        `)
        // Partial deliveries are normal at DMC (suppliers deliver in tranches),
        // so they must stay visible — otherwise the PO disappears from the
        // warehouse's view and the remainder can never be received.
        .in('status', ['delivered', 'partially_delivered', 'Partially Delivered', 'Pending Sticker / Label'])
        .order('actual_completed_date', { ascending: false })

      if (error) {
        console.error(error)
        return
      }

      const { data: pending } = await supabase
        .from('supplier_deliveries')
        .select(`
          id,
          delivery_date,
          purchase_orders(
            id,
            po_number,
            status,
            suppliers(supplier_name),
            customer_orders(order_number)
          )
        `)
        .eq('delivery_status', 'pending_confirmation')
        .order('delivery_date', { ascending: false })

      if (active) {
        setPurchaseOrders(data ?? [])
        setAwaitingReceipt((pending ?? []).filter((d) => d.purchase_orders))
      }
    }

    load()

    return () => {
      active = false
    }
  }, [])

  const displayed = useMemo(() => {
    const q = search.toLowerCase().trim()

    if (!q) return purchaseOrders

    return purchaseOrders.filter((po) =>
      po.po_number?.toLowerCase().includes(q) ||
      po.customer_orders?.order_number?.toLowerCase().includes(q) ||
      po.suppliers?.supplier_name?.toLowerCase().includes(q)
    )
  }, [purchaseOrders, search])

async function handleConfirmReceipt() {
  try {
    // Update all purchase order items
    for (const item of items) {
      const received = Number(item.received)

      const { error } = await supabase
        .from('purchase_order_items')
        .update({
          quantity_received: received,
          status: 'Pending Sticker / Label',
        })
        .eq('id', item.id)

      if (error) throw error
    }

    // Update purchase order
    const { error: poError } = await supabase
      .from('purchase_orders')
      .update({
        status: 'Pending Sticker / Label',
        actual_completed_date: new Date().toISOString().split('T')[0],
      })
      .eq('id', selectedPO.id)

    if (poError) throw poError

    // Close modal
    setShowReceiveModal(false)
    setSelectedPO(null)
    setItems([])

    // Remove it from the current table since it's no longer "delivered"
    setPurchaseOrders(prev =>
      prev.filter(po => po.id !== selectedPO.id)
    )

    alert('Delivery received successfully.')
  } catch (error) {
    console.error(error)
    alert(error.message)
  }
}

  async function openReceiveModal(po) {
    setSelectedPO(po)
    setShowReceiveModal(true)
    setLoadingItems(true)

    const { data, error } = await supabase
      .from('purchase_order_items')
      .select(`
        id,
        quantity_ordered,
        quantity_received,
        products(
          product_name,
          sku,
          unit
        )
      `)
      .eq('purchase_order_id', po.id)

    if (error) {
      console.error(error)
    } else {
      setItems(
        (data ?? []).map(item => ({
          ...item,
          received:
            item.quantity_received ??
            item.quantity_ordered
        }))
      )
    }

    setLoadingItems(false)
  }

  return (
    <div style={{ maxWidth: '100%' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 20,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 20,
              fontWeight: 700,
              letterSpacing: '-0.5px',
              color: 'var(--text-primary)',
            }}
          >
            Log Delivery
          </div>

          <div
            style={{
              fontSize: 13,
              color: 'var(--text-secondary)',
              marginTop: 4,
            }}
          >
            Confirm receipt of delivered purchase orders.
          </div>
        </div>

        <input
          type="text"
          className="input"
          placeholder="Search PO #, supplier, order..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: 260 }}
        />
      </div>

      {/* Supplier has dispatched, warehouse has not confirmed receipt yet.
          These POs are still 'sent', so they are not in the table below. */}
      {awaitingReceipt.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
            Awaiting your confirmation ({awaitingReceipt.length})
          </div>
          <div className="card">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th className="table-th">PO #</th>
                  <th className="table-th">Order</th>
                  <th className="table-th">Supplier</th>
                  <th className="table-th">Dispatched</th>
                  <th className="table-th">Action</th>
                </tr>
              </thead>
              <tbody>
                {awaitingReceipt.map((d) => (
                  <tr key={d.id}>
                    <td className="table-td"><span className="td-primary">{d.purchase_orders.po_number}</span></td>
                    <td className="table-td">{d.purchase_orders.customer_orders?.order_number || '—'}</td>
                    <td className="table-td">{d.purchase_orders.suppliers?.supplier_name || '—'}</td>
                    <td className="table-td">{d.delivery_date || '—'}</td>
                    <td className="table-td">
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => router.push(`/warehouse/log-delivery/${d.purchase_orders.id}`)}
                      >
                        Confirm receipt
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th className="table-th">PO #</th>
              <th className="table-th">Order</th>
              <th className="table-th">Supplier</th>
              <th className="table-th">Status</th>
              <th className="table-th">Action</th>
              <th className="table-th">Sticker / Label Progress</th>
            </tr>
          </thead>

          <tbody>
            {displayed.map((po) => {

            const totalItems =
              po.purchase_order_items?.reduce(
                (sum, item) => sum + (item.quantity_ordered ?? 0),
                0
              ) ?? 0

            const totalStickered =
              po.purchase_order_items?.reduce(
                (sum, item) => sum + (item.sticker_progress ?? 0),
                0
              ) ?? 0

            const progress = totalItems
              ? Math.round((totalStickered / totalItems) * 100)
              : 0

            return  <tr key={po.id}>
                <td className="table-td">
                  <span className="td-primary">{po.po_number}</span>
                </td>

                <td className="table-td">
                  {po.customer_orders?.order_number}
                </td>

                <td className="table-td">
                  {po.suppliers?.supplier_name}
                </td>

                <td className="table-td">
                  <StatusBadge status={po.status} />
                </td>

                <td className="table-td">
                  <div className="flex gap-2">
                    <button
                      className="rounded border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
                      onClick={() => {
                        setSelectedPO(po)
                        setShowModal(true)
                      }}
                    >
                      View
                    </button>

                    <button
                      className="rounded bg-green-600 px-3 py-2 text-xs font-medium text-white hover:bg-green-700"
                      onClick={() => openReceiveModal(po)}
                    >
                      Receive Delivery
                    </button>
                  </div>
                </td>

                <td className="table-td" style={{ minWidth: 180 }}>
                  {po.status === 'Pending Sticker / Label' ? (
                    
                    <>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                        <div
                          className="h-full rounded-full bg-black transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>

                      <div className="mt-1 flex justify-between text-xs">
                        <span className="text-gray-500">
                          {totalStickered} / {totalItems} Labeled Items
                        </span>

                        <span className="font-medium text-gray-700">
                          {progress}%
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                        <div
                          className="h-full rounded-full bg-gray-300"
                          style={{ width: '100%' }}
                        />
                      </div>

                      <p className="mt-1 text-right text-xs text-gray-400">
                        Not Available
                      </p>
                    </>
                  )}
                </td>
              </tr>
})}

            {displayed.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="table-td"
                  style={{ textAlign: 'center', padding: 32 }}
                >
                  No delivered purchase orders found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && selectedPO && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl">

            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-semibold">
                Purchase Order Details
              </h2>

              <button
                onClick={() => setShowModal(false)}
                className="text-xl"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">

              <div>
                <p className="text-sm text-gray-500">PO Number</p>
                <p className="font-medium">{selectedPO.po_number}</p>
              </div>

              <div>
                <p className="text-sm text-gray-500">Order Number</p>
                <p className="font-medium">
                  {selectedPO.customer_orders?.order_number}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-500">Supplier</p>
                <p className="font-medium">
                  {selectedPO.suppliers?.supplier_name}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-500">Status</p>
                <StatusBadge status={selectedPO.status} />
              </div>

              <div>
                <p className="text-sm text-gray-500">Issued Date</p>
                <p>{selectedPO.issued_date || '-'}</p>
              </div>

              <div>
                <p className="text-sm text-gray-500">Expected Delivery</p>
                <p>{selectedPO.expected_delivery_date || '-'}</p>
              </div>

              <div>
                <p className="text-sm text-gray-500">Actual Delivery</p>
                <p>{selectedPO.actual_completed_date || '-'}</p>
              </div>

            </div>

            <div className="mt-8 flex justify-end gap-2">
              <button
                className="rounded bg-gray-200 px-4 py-2"
                onClick={() => setShowModal(false)}
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

      {showReceiveModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="w-full max-w-4xl rounded-lg bg-white p-6 shadow-xl">

          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">
                Receive Delivery
              </h2>

              <p className="text-sm text-gray-500">
                {selectedPO?.po_number}
              </p>
            </div>

            <button
              onClick={() => setShowReceiveModal(false)}
              className="text-xl"
            >
              ✕
            </button>
          </div>

          {loadingItems ? (
            <p>Loading items...</p>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="table-th">Product</th>
                  <th className="table-th text-right">Ordered</th>
                  <th className="table-th text-right">Received</th>
                </tr>
              </thead>

              <tbody>
                {items.map((item, index) => (
                  <tr key={item.id}>
                    <td className="table-td">
                      <div className="font-medium">
                        {item.products?.product_name}
                      </div>

                      <div className="text-xs text-gray-500">
                        {item.products?.sku}
                      </div>
                    </td>

                    <td className="table-td text-right">
                      {item.quantity_ordered} {item.products?.unit}
                    </td>

                    <td className="table-td text-right">
                      <input
                        type="number"
                        min="0"
                        className="input w-24 text-right"
                        value={item.received}
                        onChange={(e) => {
                          const updated = [...items]
                          updated[index].received = e.target.value
                          setItems(updated)
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div className="mt-6 flex justify-end gap-2">
            <button
              className="rounded bg-gray-200 px-4 py-2"
              onClick={() => setShowReceiveModal(false)}
            >
              Cancel
            </button>

            <button
              className="rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700"
              onClick={handleConfirmReceipt}
            >
              Confirm Receipt
            </button>
          </div>

        </div>
      </div>
    )}
    </div>
  )
}
