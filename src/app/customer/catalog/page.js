'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

export default function ProductCatalog() {
  const router = useRouter()
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [brandFilter, setBrandFilter] = useState('all')
  const [availableOnly, setAvailableOnly] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }

      const { data: productsData } = await supabase
        .from('products')
        .select('*')
        .order('category', { ascending: true })

      setProducts(productsData || [])
      setLoading(false)
    }

    fetchData()
  }, [])

  const categories = ['all', ...new Set(products.map(p => p.category).filter(Boolean))]
  const brands = ['all', ...new Set(products.map(p => p.brand).filter(Boolean))]

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.product_name?.toLowerCase().includes(search.toLowerCase()) ||
                           p.brand?.toLowerCase().includes(search.toLowerCase()) ||
                           p.category?.toLowerCase().includes(search.toLowerCase())
    const matchesCategory = categoryFilter === 'all' || p.category === categoryFilter
    const matchesBrand = brandFilter === 'all' || p.brand === brandFilter
    const matchesAvailable = !availableOnly || p.is_available

    return matchesSearch && matchesCategory && matchesBrand && matchesAvailable
  })

  const groupedProducts = filteredProducts.reduce((acc, product) => {
    const cat = product.category || 'Other'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(product)
    return acc
  }, {})

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
              className={`text-left text-sm px-3 py-2 rounded ${item.label === 'Product Catalog' ? 'font-semibold text-black bg-gray-50' : 'text-gray-600 hover:bg-gray-100'}`}
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
            <h1 className="text-xl font-bold text-gray-900">Product catalog</h1>
            <p className="text-sm text-gray-500 max-w-2xl">
              Browse all available Philippine FMCG products. No prices shown — submit a quotation request and DMC will prepare a pro forma invoice.
            </p>
          </div>
          <button
            onClick={() => router.push('/customer/quotation/new')}
            className="bg-black text-white text-sm px-4 py-2 rounded hover:bg-gray-800 whitespace-nowrap"
          >
            + Request quotation
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-6">
          <input
            type="text"
            placeholder="Search products, brands, categories..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm text-black bg-white focus:outline-none focus:ring-2 focus:ring-gray-400"
          />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="border border-gray-300 rounded px-3 py-2 text-sm text-black bg-white"
          >
            {categories.map(c => (
              <option key={c} value={c}>{c === 'all' ? 'All categories' : c}</option>
            ))}
          </select>
          <select
            value={brandFilter}
            onChange={(e) => setBrandFilter(e.target.value)}
            className="border border-gray-300 rounded px-3 py-2 text-sm text-black bg-white"
          >
            {brands.map(b => (
              <option key={b} value={b}>{b === 'all' ? 'All brands' : b}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm text-gray-600 whitespace-nowrap px-2">
            <input
              type="checkbox"
              checked={availableOnly}
              onChange={(e) => setAvailableOnly(e.target.checked)}
            />
            Available only
          </label>
        </div>

        {/* Product Groups */}
        {Object.keys(groupedProducts).length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-400">
            No products found
          </div>
        ) : (
          Object.entries(groupedProducts).map(([category, items]) => (
            <div key={category} className="mb-6">
              <h2 className="text-xs font-semibold text-gray-400 uppercase mb-3">{category}</h2>
              <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
                {items.map((product) => (
                  <div key={product.id} className="flex items-center gap-4 p-4">
                    <div className="w-16 h-16 bg-gray-100 rounded flex items-center justify-center text-xs text-gray-400 flex-shrink-0">
                      [Product image]
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm text-gray-900">{product.product_name}</p>
                      <p className="text-sm text-gray-500">{product.brand}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        Unit CBM: {product.unit_cbm ?? '—'} · {product.unit_weight_kg ?? '—'} kg
                      </p>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${product.is_available ? 'bg-black text-white' : 'bg-gray-200 text-gray-500'}`}>
                      {product.is_available ? 'Available' : 'Unavailable'}
                    </span>
                    <button
                      disabled={!product.is_available}
                      className={`text-sm px-4 py-2 rounded border ${product.is_available ? 'border-gray-300 text-gray-700 hover:bg-gray-50' : 'border-gray-200 text-gray-300 cursor-not-allowed'}`}
                    >
                      + Add to request
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}

      </div>
    </div>
  )
}