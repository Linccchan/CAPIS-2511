'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

export default function RequestQuotation() {
  const router = useRouter()
  const [customer, setCustomer] = useState(null)
  const [products, setProducts] = useState([])
  const [selectedItems, setSelectedItems] = useState([])
  const [destination, setDestination] = useState('')
  const [preferredDate, setPreferredDate] = useState('')
  const [specialInstructions, setSpecialInstructions] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [newOrderId, setNewOrderId] = useState(null)

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

      const { data: productsData } = await supabase
        .from('products')
        .select('*')
        .eq('is_available', true)
        .order('category', { ascending: true })

      setProducts(productsData || [])
      setLoading(false)
    }

    fetchData()
  }, [])

  const addProduct = (product) => {
    if (selectedItems.find(i => i.product_id === product.id)) return
    setSelectedItems([...selectedItems, {
      product_id: product.id,
      product_name: product.product_name,
      brand: product.brand,
      unit_cbm: product.unit_cbm,
      unit_weight_kg: product.unit_weight_kg,
      quantity_ordered: 1,
      notes: ''
    }])
  }

  const updateQuantity = (product_id, qty) => {
    setSelectedItems(selectedItems.map(i =>
      i.product_id === product_id ? { ...i, quantity_ordered: qty } : i
    ))
  }

  const updateNotes = (product_id, notes) => {
    setSelectedItems(selectedItems.map(i =>
      i.product_id === product_id ? { ...i, notes } : i
    ))
  }

  const removeItem = (product_id) => {
    setSelectedItems(selectedItems.filter(i => i.product_id !== product_id))
  }

  const totalCBM = selectedItems.reduce((sum, i) => sum + ((i.unit_cbm || 0) * i.quantity_ordered), 0)
  const totalWeight = selectedItems.reduce((sum, i) => sum + ((i.unit_weight_kg || 0) * i.quantity_ordered), 0)
  const totalQty = selectedItems.reduce((sum, i) => sum + i.quantity_ordered, 0)

  const handleSubmit = async () => {
    if (!customer || selectedItems.length === 0 || !destination) return
    setSubmitting(true)

    const orderNumber = `QT-${Date.now()}`

    const { data: order, error: orderError } = await supabase
      .from('customer_orders')
      .insert({
        customer_id: customer.id,
        order_number: orderNumber,
        destination_country: destination,
        status: 'submitted',
        order_date: new Date().toISOString().split('T')[0],
      })
      .select()
      .single()

    if (orderError) {
      console.error('Order error:', JSON.stringify(orderError))
      alert('Error: ' + JSON.stringify(orderError))
      setSubmitting(false)
      return
    }

    const orderItems = selectedItems.map(i => ({
      order_id: order.id,
      product_id: i.product_id,
      quantity_ordered: i.quantity_ordered,
      notes: i.notes || null,
      unit_price: null,
    }))

    const { error: itemsError } = await supabase
      .from('customer_order_items')
      .insert(orderItems)

    if (itemsError) {
      console.error('Items error:', JSON.stringify(itemsError))
      alert('Items error: ' + JSON.stringify(itemsError))
      setSubmitting(false)
      return
    }

    setNewOrderId(order.id)
    setSubmitted(true)
    setSubmitting(false)
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500">Loading...</p>
    </div>
  )

  if (submitted) return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white rounded-lg border border-gray-200 p-10 text-center max-w-md">
        <div className="text-4xl mb-4">✓</div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Quotation request submitted</h2>
        <p className="text-sm text-gray-500 mb-6">DMC will review your request and prepare a pro forma invoice. You will be notified once it is ready.</p>
        <button
          onClick={() => router.push('/customer/dashboard')}
          className="bg-black text-white px-6 py-2 rounded text-sm hover:bg-gray-800"
        >
          Back to dashboard
        </button>
      </div>
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
              className={`text-left text-sm px-3 py-2 rounded ${item.label === 'Request Quotation' ? 'font-semibold text-black bg-gray-50' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              • {item.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Main Content */}
      <div className="ml-56 flex-1 p-8">

        {/* Header */}
        <h1 className="text-xl font-bold text-gray-900 mb-1">Request a quotation</h1>
        <p className="text-sm text-gray-500 mb-6">Add products and quantities. DMC will review and send you a pro forma invoice with pricing.</p>

        {/* Steps */}
        <div className="flex items-center gap-2 mb-8 text-xs">
          {['Select products', 'Submit request', 'DMC prepares PFI', 'Review & approve PFI', 'Down payment'].map((step, i) => (
            <div key={step} className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold ${i < 2 ? 'bg-black text-white' : 'border border-gray-300 text-gray-400'}`}>
                {i < 1 ? '✓' : i + 1}
              </div>
              <span className={i < 2 ? 'text-gray-900 font-medium' : 'text-gray-400'}>{step}</span>
              {i < 4 && <div className="w-8 h-px bg-gray-200" />}
            </div>
          ))}
        </div>

        <div className="flex gap-6">

          {/* Left — Product Request */}
          <div className="flex-1">

            {/* Selected Items */}
            <div className="bg-white rounded-lg border border-gray-200 p-5 mb-4">
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-semibold text-gray-900">Your product request</h2>
                <button
                  onClick={() => router.push('/customer/catalog')}
                  className="text-sm border border-gray-300 px-3 py-1 rounded hover:bg-gray-50"
                >
                  + Add more products
                </button>
              </div>

              {selectedItems.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">No products added yet. Browse the catalog to add products.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-400 uppercase border-b border-gray-100">
                      <th className="pb-2">Product</th>
                      <th className="pb-2">Brand</th>
                      <th className="pb-2">Unit CBM</th>
                      <th className="pb-2">Unit Wt (kg)</th>
                      <th className="pb-2">Qty Requested</th>
                      <th className="pb-2">Notes</th>
                      <th className="pb-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedItems.map((item) => (
                      <tr key={item.product_id} className="border-b border-gray-50">
                        <td className="py-3 font-medium">{item.product_name}</td>
                        <td className="py-3 text-gray-500">{item.brand}</td>
                        <td className="py-3 text-gray-500">{item.unit_cbm ?? '—'}</td>
                        <td className="py-3 text-gray-500">{item.unit_weight_kg ?? '—'}</td>
                        <td className="py-3">
                          <input
                            type="number"
                            min="1"
                            value={item.quantity_ordered}
                            onChange={(e) => updateQuantity(item.product_id, parseInt(e.target.value) || 1)}
                            className="w-20 border border-gray-300 rounded px-2 py-1 text-sm text-black"
                          />
                        </td>
                        <td className="py-3">
                          <input
                            type="text"
                            placeholder="Optional..."
                            value={item.notes}
                            onChange={(e) => updateNotes(item.product_id, e.target.value)}
                            className="w-32 border border-gray-300 rounded px-2 py-1 text-sm text-black"
                          />
                        </td>
                        <td className="py-3">
                          <button
                            onClick={() => removeItem(item.product_id)}
                            className="text-red-400 hover:text-red-600 text-xs"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Shipment Details */}
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <h2 className="font-semibold text-gray-900 mb-4">Shipment details</h2>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Destination Country</label>
                  <input
                    type="text"
                    placeholder="e.g. Hong Kong"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm text-black"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Preferred Ship Date (Optional)</label>
                  <input
                    type="date"
                    value={preferredDate}
                    onChange={(e) => setPreferredDate(e.target.value)}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm text-black"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Special Instructions</label>
                <textarea
                  placeholder="Any packaging, labeling, or product notes..."
                  value={specialInstructions}
                  onChange={(e) => setSpecialInstructions(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm text-black h-20 resize-none"
                />
              </div>
            </div>

          </div>

          {/* Right — Summary */}
          <div className="w-64 flex-shrink-0">
            <div className="bg-white rounded-lg border border-gray-200 p-5 sticky top-8">
              <h2 className="font-semibold text-gray-900 mb-4">Request summary</h2>
              <div className="space-y-2 text-sm mb-4">
                <div className="flex justify-between">
                  <span className="text-gray-500">Products</span>
                  <span className="font-medium">{selectedItems.length} SKUs</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Total qty</span>
                  <span className="font-medium">{totalQty} cases</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Est. CBM</span>
                  <span className="font-medium">{totalCBM.toFixed(3)} m³</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Est. weight</span>
                  <span className="font-medium">{totalWeight.toFixed(1)} kg</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Destination</span>
                  <span className="font-medium">{destination || '—'}</span>
                </div>
              </div>
              <p className="text-xs text-gray-400 mb-4">Pricing will be included in the pro forma invoice prepared by DMC. You will be notified once it is ready for your review.</p>
              <button
                onClick={handleSubmit}
                disabled={submitting || selectedItems.length === 0 || !destination}
                className="w-full bg-black text-white py-2 rounded text-sm font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Submitting...' : 'Submit quotation request →'}
              </button>
            </div>
          </div>

        </div>

        {/* Product Picker */}
        <div className="mt-6 bg-white rounded-lg border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Available products</h2>
          <div className="divide-y divide-gray-100">
            {products.map((product) => (
              <div key={product.id} className="flex items-center gap-4 py-3">
                <div className="flex-1">
                  <p className="font-medium text-sm text-gray-900">{product.product_name}</p>
                  <p className="text-xs text-gray-500">{product.brand} · {product.category}</p>
                </div>
                <button
                  onClick={() => addProduct(product)}
                  disabled={!!selectedItems.find(i => i.product_id === product.id)}
                  className={`text-sm px-3 py-1 rounded border ${selectedItems.find(i => i.product_id === product.id) ? 'border-gray-200 text-gray-300 cursor-not-allowed' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                >
                  {selectedItems.find(i => i.product_id === product.id) ? 'Added' : '+ Add'}
                </button>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}