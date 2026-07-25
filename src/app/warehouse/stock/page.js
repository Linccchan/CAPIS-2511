'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function StockPage() {
  const [products, setProducts] = useState([])
  const [search, setSearch] = useState('')

  useEffect(() => {
    let active = true

    async function load() {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('product_name')

      if (error) {
        console.error(error)
        return
      }

      if (active) setProducts(data ?? [])
    }

    load()

    return () => {
      active = false
    }
  }, [])

  const displayed = useMemo(() => {
    const q = search.toLowerCase().trim()

    if (!q) return products

    return products.filter(product =>
      product.product_name?.toLowerCase().includes(q) ||
      product.sku?.toLowerCase().includes(q)
    )
  }, [products, search])

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
            Warehouse Stocks
          </div>

          <div
            style={{
              fontSize: 13,
              color: 'var(--text-secondary)',
              marginTop: 4,
            }}
          >
            View all products stock in the warehouse.
          </div>
        </div>

        <input
          type="text"
          className="input"
          placeholder="Search product..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: 260 }}
        />
      </div>

      <div className="card">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th className="table-th">SKU</th>
              <th className="table-th">Product</th>
              <th className="table-th">Category</th>
              <th className="table-th">Unit</th>
            </tr>
          </thead>

          <tbody>
            {displayed.map((product) => (
              <tr key={product.id}>
                <td className="table-td">
                  <span className="td-primary">
                    {product.sku}
                  </span>
                </td>

                <td className="table-td">
                  {product.product_name}
                </td>

                <td className="table-td">
                  {product.category || '-'}
                </td>

                <td className="table-td">
                  {product.unit}
                </td>
              </tr>
            ))}

            {displayed.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="table-td"
                  style={{
                    textAlign: 'center',
                    padding: 32,
                  }}
                >
                  No products found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}