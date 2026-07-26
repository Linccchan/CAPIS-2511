'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { fetchOrderManagementData } from '@/lib/orderManagement'
import { Badge, Card, EmptyState, OrderShell, TableSkeleton, statusTone, useToast } from '@/components/order-management/ui'
import { supabase } from '@/lib/supabaseClient'

export default function SupplierDeliveriesPage() {
  const toast = useToast()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const fileInputRef = useRef(null)
  const [selectedItem, setSelectedItem] = useState(null)
  const [progressModalOpen, setProgressModalOpen] = useState(false)
  const [progressValue, setProgressValue] = useState(0)

  useEffect(() => {
    const load = async () => {
      try {
        setData(await fetchOrderManagementData())
      } catch (error) {
        toast?.show(error.message, 'error')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [toast])

  const deliveries = useMemo(() => {
    const term = query.toLowerCase()
    return (data?.supplierDeliveries || []).filter((item) =>
      [item.poNumber, item.supplier, item.productName, item.deliveryStatus].join(' ').toLowerCase().includes(term),
    )
  }, [data, query])


  const handleAddImage = (item) => {
    setSelectedItem(item)
    fileInputRef.current?.click()
  }

  const handleImageSelected = (event) => {
    const file = event.target.files?.[0]

    if (!file) return

    alert(
      `Image sucessfully uploaded`
    )

    event.target.value = ''
  }

  const handleEditProgress = (item) => {
    setSelectedItem(item)
    setProgressValue(item.sticker_progress ?? 0)
    setProgressModalOpen(true)
  }

const handleSaveProgress = async () => {
  if (!selectedItem) return

  // Update the current item
  const { error } = await supabase
    .from('purchase_order_items')
    .update({
      sticker_progress: progressValue,
    })
    .eq('id', selectedItem.id)

  if (error) {
    toast?.show(error.message, 'error')
    return
  }

  // Get all items belonging to this PO
  const { data: items, error: itemsError } = await supabase
    .from('purchase_order_items')
    .select('id, quantity_received, quantity_ordered, sticker_progress')
    .eq('purchase_order_id', selectedItem.purchaseOrderId)

  if (itemsError) {
    toast?.show(itemsError.message, 'error')
    return
  }

  // Include the newly updated value since the select may still have the old one
  const updatedItems = items.map(item =>
    item.id === selectedItem.id
      ? { ...item, sticker_progress: progressValue }
      : item
  )

  // Change to quantity_ordered if that's your business rule
  const complete = updatedItems.every(
    item => (item.sticker_progress ?? 0) >= item.quantity_received
  )

  if (complete) {
    // Update all PO items
    await supabase
      .from('purchase_order_items')
      .update({ status: 'Staging' })
      .eq('purchase_order_id', selectedItem.purchaseOrderId)

    // Update the purchase order
    await supabase
      .from('purchase_orders')
      .update({ status: 'Staging' })
      .eq('id', selectedItem.purchaseOrderId)

    toast?.show('Stickering complete. Purchase Order moved to Staging.', 'success')
  } else {
    toast?.show('Sticker progress updated.', 'success')
  }

  setProgressModalOpen(false)

  // Reload data
  setData(await fetchOrderManagementData())
}

  return (
    <OrderShell title="Supplier Delivery Tracking" description="Review delivery completion grouped by purchase order lines.">

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageSelected}
      />

      <Card title="Supplier Deliveries">
        <div className="mb-4">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search supplier, product, or PO" className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-gray-400 sm:max-w-xs" />
        </div>
        {loading ? <TableSkeleton cols={6} /> : deliveries.length === 0 ? (
          <EmptyState title="No supplier delivery records" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-100 text-xs uppercase text-gray-400">
                <tr>
                  <th className="py-3 pr-4">Purchase Order</th>
                  <th className="py-3 pr-4">Supplier</th>
                  <th className="py-3 pr-4">Product</th>
                  <th className="py-3 pr-4">Ordered Quantity</th>
                  <th className="py-3 pr-4">Delivered Quantity</th>
                  <th className="py-3 pr-4">Remaining Quantity</th>
                  <th className="py-3">Delivery Status</th>
                  <th className="py-3">Sticker / Label</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {deliveries.map((item) => (
                  <tr key={`${item.purchaseOrderId}-${item.id}`}>
                    <td className="py-3 pr-4 font-medium">{item.poNumber}</td>
                    <td className="py-3 pr-4 text-gray-600">{item.supplier}</td>
                    <td className="py-3 pr-4 text-gray-600">{item.productName}</td>
                    <td className="py-3 pr-4">{item.quantity_ordered}</td>
                    <td className="py-3 pr-4">{item.quantity_received}</td>
                    <td className="py-3 pr-4">{(item.quantity_ordered - item.quantity_received)}</td>
                    <td className="py-3"><Badge tone={statusTone(item.status)}>{item.status}</Badge></td>
                    <td className="py-3">
                      <div className="flex gap-2">
                        <button
                          disabled={item.status !== 'Pending Sticker / Label'}
                          onClick={() => handleAddImage(item)}
                          className={`rounded px-3 py-1.5 text-xs font-medium transition ${
                            item.status === 'Pending Sticker / Label'
                              ? 'bg-black text-white hover:bg-gray-800'
                              : 'cursor-not-allowed bg-gray-200 text-gray-400'
                          }`}
                        >
                          Add Image
                        </button>

                        <button
                          disabled={item.status !== 'Pending Sticker / Label'}
                          onClick={() => handleEditProgress(item)}
                          className={`rounded border px-3 py-1.5 text-xs font-medium transition ${
                            item.status === 'Pending Sticker / Label'
                              ? 'border-gray-300 bg-white text-gray-800 hover:bg-gray-100'
                              : 'cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400'
                          }`}
                        >
                          Edit Progress
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>



      {progressModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">

            <h2 className="text-lg font-semibold">
              Edit Sticker Progress
            </h2>

            <p className="mt-2 text-sm text-gray-500">
              {selectedItem?.productName}
            </p>

            <div className="mt-6">

              <div className="mb-4 rounded bg-gray-50 p-3 text-center">
                  <p className="text-sm text-gray-500">
                    Sticker / Label Progress
                  </p>

                  <p className="mt-1 text-2xl font-bold">
                    {progressValue} / {selectedItem?.quantity_received ?? 0}
                  </p>
                </div>

                <input
                  type="range"
                  min={0}
                  max={selectedItem?.quantity_received ?? 0}
                  value={progressValue}
                  onChange={(e) =>
                    setProgressValue(Number(e.target.value))
                  }
                  className="w-full"
                />

<div className="mt-4 flex items-center justify-between">

  <div className="flex items-center gap-3">
    <input
      type="number"
      min={0}
      max={selectedItem?.quantity_received ?? 0}
      value={progressValue}
      onChange={(e) =>
        setProgressValue(
          Math.max(
            0,
            Math.min(
              selectedItem?.quantity_received ?? 0,
              Number(e.target.value)
            )
          )
        )
      }
      className="w-24 rounded border border-gray-300 px-3 py-2"
    />

    <span className="text-sm text-gray-600">
      / {selectedItem?.quantity_received ?? 0} received
    </span>
  </div>

  <span className="text-sm font-semibold text-gray-700">
    {selectedItem?.quantity_received
      ? Math.round(
          (progressValue / selectedItem.quantity_received) * 100
        )
      : 0}
    %
  </span>

</div>

            </div>

            <div className="mt-8 flex justify-end gap-3">

              <button
                onClick={() => setProgressModalOpen(false)}
                className="rounded border border-gray-300 px-4 py-2"
              >
                Cancel
              </button>

              <button
                onClick={handleSaveProgress}
                className="rounded bg-black px-4 py-2 text-white hover:bg-gray-800"
              >
                Save
              </button>

            </div>

          </div>
        </div>
      )}

    </OrderShell>
  )
}
