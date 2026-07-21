'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function ProductsPage() {
  const supabase = useMemo(() => createClient(), []);

  const [products, setProducts] = useState([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [selectedId, setSelectedId] = useState(null);

  const blankProduct = {
    product_name: '',
    sku: '',
    category: '',
    brand: '',
    unit: '',
    unit_weight_kg: '',
    unit_cbm: '',
    is_available: true,
  };

  const [form, setForm] = useState(blankProduct);

  useEffect(() => {
    async function loadProducts() {
        setLoading(true);

        const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });

        if (error) {
        console.error(error);
        } else {
        setProducts(data ?? []);
        }

        setLoading(false);
    }

    loadProducts();
  }, [supabase]);

  const filteredProducts = products.filter(product => {
    const search = filter.toLowerCase();

    return (
        product.product_name?.toLowerCase().includes(search) ||
        product.sku?.toLowerCase().includes(search) ||
        product.category?.toLowerCase().includes(search) ||
        product.brand?.toLowerCase().includes(search)
    );
  });


  async function createProduct(e) {
    e.preventDefault();

    setSaving(true);

    let error;
    let data;

    if (editing) {
        ({ data, error } = await supabase
        .from('products')
        .update({
            product_name: form.product_name,
            sku: form.sku,
            category: form.category,
            brand: form.brand,
            unit: form.unit,
            unit_weight_kg: form.unit_weight_kg || null,
            unit_cbm: form.unit_cbm || null,
            is_available: form.is_available,
        })
        .eq('id', selectedId)
        .select()
        .single());
    } else {
        ({ data, error } = await supabase
        .from('products')
        .insert({
            ...form,
            unit_weight_kg: form.unit_weight_kg || null,
            unit_cbm: form.unit_cbm || null,
        })
        .select()
        .single());
    }

    setSaving(false);

    if (error) {
        alert(error.message);
        return;
    }

    if (editing) {
        setProducts(prev =>
        prev.map(p => (p.id === selectedId ? data : p))
        );
    } else {
        setProducts(prev => [data, ...prev]);
    }

    setEditing(false);
    setSelectedId(null);
    setForm(blankProduct);
    setShowModal(false);

    alert(editing ? 'Product updated!' : 'Product created!');
  }

  function editProduct(product) {
    setEditing(true);
    setSelectedId(product.id);

    setForm({
        product_name: product.product_name,
        sku: product.sku || '',
        category: product.category || '',
        brand: product.brand || '',
        unit: product.unit || '',
        unit_weight_kg: product.unit_weight_kg ?? '',
        unit_cbm: product.unit_cbm ?? '',
        is_available: product.is_available,
    });

    setShowModal(true);
  }

  async function deleteProduct(id) {
    const confirmed = window.confirm(
        'Delete this product?'
    );

    if (!confirmed) return;

    const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);

    if (error) {
        alert(error.message);
        return;
    }

    setProducts(prev =>
        prev.filter(product => product.id !== id)
    );}

  return (
    <div style={{ maxWidth: 1200 }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div
          style={{
            fontSize: 20,
            fontWeight: 700,
            letterSpacing: '-0.5px',
            color: 'var(--text-primary)',
          }}
        >
          Product Management
        </div>

        <div
          style={{
            fontSize: 13,
            color: 'var(--text-secondary)',
            marginTop: 4,
          }}
        >
          View and manage registered products.
        </div>
      </div>


      <div
        style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 20,
        }}
        >
      <div
        style={{
          display: 'flex',
          gap: 10,
          marginBottom: 16,
        }}
      >
        <input
          className="input"
          type="text"
          placeholder="Search company, contact, email..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{ width: 350 }}
        />
      </div>

        <button
            className="btn btn-primary"
            onClick={() => setShowModal(true)}
        >
            + Add Product
        </button>
        </div>

      {/* Table */}
      <div className="card">
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
          }}
        >
        <thead>
            <tr>
                <th className="table-th">Product</th>
                <th className="table-th">SKU</th>
                <th className="table-th">Category</th>
                <th className="table-th">Brand</th>
                <th className="table-th">Unit</th>
                <th className="table-th">Weight (kg)</th>
                <th className="table-th">CBM</th>
                <th className="table-th">Status</th>
                <th className="table-th">Created</th>
                <th className="table-th">Action</th>
            </tr>
        </thead>

<tbody>
  {loading ? (
    <tr>
      <td colSpan={10} className="table-td" style={{ textAlign: 'center', padding: 32 }}>
        Loading products...
      </td>
    </tr>
  ) : filteredProducts.length ? (
    filteredProducts.map(product => (
      <tr key={product.id}>
        <td className="table-td">
          <div className="td-primary">{product.product_name}</div>

          {product.odoo_product_id && (
            <div
              style={{
                fontSize: 10,
                color: 'var(--text-tertiary)',
                fontFamily: 'monospace',
              }}
            >
              Odoo: {product.odoo_product_id}
            </div>
          )}
        </td>

        <td className="table-td">{product.sku || '-'}</td>

        <td className="table-td">{product.category || '-'}</td>

        <td className="table-td">{product.brand || '-'}</td>

        <td className="table-td">{product.unit || '-'}</td>

        <td className="table-td">
          {product.unit_weight_kg ?? '-'}
        </td>

        <td className="table-td">
          {product.unit_cbm ?? '-'}
        </td>

        <td className="table-td">
          <span
            className={`badge ${
              product.is_available
                ? 'badge-success'
                : 'badge-gray'
            }`}
          >
            {product.is_available ? 'Available' : 'Unavailable'}
          </span>
        </td>

        <td className="table-td">
          {new Date(product.created_at).toLocaleDateString()}
        </td>

        <td className="table-td">
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ display: 'flex', gap: 8 }}>

                <button
                    className="rounded border border-blue-200 px-3 py-1 text-sm text-blue-600 hover:bg-blue-50"
                    onClick={() => editProduct(product)}
                >
                    Edit
                </button>

                <button
                    className="rounded border border-red-200 px-3 py-1 text-sm text-red-600 hover:bg-red-50"
                    onClick={() => deleteProduct(product.id)}
                >
                    Delete
                </button>
                
            </div>
          </div>
        </td>
      </tr>
    ))
  ) : (
    <tr>
      <td
        colSpan={10}
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

      {showModal && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
    <div
      className="bg-white rounded-lg p-6"
      style={{
        width: 550,
      }}
    >
      <h2
        style={{
          fontSize: 22,
          marginBottom: 20,
          fontWeight: 600,
        }}
      >
        {editing ? 'Edit Product' : 'Add Product'}
      </h2>

      <form onSubmit={createProduct}>
        <div
          style={{
            display: 'grid',
            gap: 14,
          }}
        >
          

<input
  className="input"
  placeholder="Product Name"
  required
  value={form.product_name}
  onChange={(e) =>
    setForm({ ...form, product_name: e.target.value })
  }
/>

<input
  className="input"
  placeholder="SKU"
  value={form.sku}
  onChange={(e) =>
    setForm({ ...form, sku: e.target.value })
  }
/>

<input
  className="input"
  placeholder="Category"
  value={form.category}
  onChange={(e) =>
    setForm({ ...form, category: e.target.value })
  }
/>

<input
  className="input"
  placeholder="Brand"
  value={form.brand}
  onChange={(e) =>
    setForm({ ...form, brand: e.target.value })
  }
/>

<input
  className="input"
  placeholder="Unit"
  value={form.unit}
  onChange={(e) =>
    setForm({ ...form, unit: e.target.value })
  }
/>

<input
  className="input"
  type="number"
  step="0.001"
  placeholder="Weight (kg)"
  value={form.unit_weight_kg}
  onChange={(e) =>
    setForm({ ...form, unit_weight_kg: e.target.value })
  }
/>

<input
  className="input"
  type="number"
  step="0.001"
  placeholder="CBM"
  value={form.unit_cbm}
  onChange={(e) =>
    setForm({ ...form, unit_cbm: e.target.value })
  }
/>

<label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
  <input
    type="checkbox"
    checked={form.is_available}
    onChange={(e) =>
      setForm({
        ...form,
        is_available: e.target.checked,
      })
    }
  />
  Available
</label>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 10,
            marginTop: 24,
          }}
        >
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
                setShowModal(false);
                setEditing(false);
                setSelectedId(null);
                setForm(blankProduct);
            }}
          >
            Cancel
          </button>

          <button
            className="btn btn-primary"
            disabled={saving}
          >
            {saving
                ? editing
                    ? 'Saving...'
                    : 'Creating...'
                : editing
                ? 'Save Changes'
                : 'Create Product'}
          </button>
        </div>
      </form>
    </div>
  </div>
)}
    </div>
    
  );
}



