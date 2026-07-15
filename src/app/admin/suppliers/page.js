'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { createRecord, fetchOrderManagementData, deleteRecord, importSuppliers, fetchSuppliers } from '@/lib/orderManagement'
import Papa from "papaparse";


export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [showViewModal, setShowViewModal] = useState(false)
  const [selectedSupplier, setSelectedSupplier] = useState(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [supplierToDelete, setSupplierToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [editingSupplier, setEditingSupplier] = useState(null)
  const [csvRows, setCsvRows] = useState([])
  const [importing, setImporting] = useState(false)

  const [form, setForm] = useState({
    supplier_name: '',
    supplier_type: 'manufacturer',
    contact_person: '',
    email: '',
    phone: '',
    address: '',
  })

  useEffect(() => {
    let active = true
    async function load() {
      const { data } = await supabase
        .from('suppliers')
        .select('*, supplier_performance(average_lead_time_days, late_delivery_count, total_purchase_orders, reliability_score), purchase_orders(id, status)')
        .order('supplier_name')
      if (active) setSuppliers(data || [])
    }
    load()
    return () => {
      active = false
    }
  }, [])


  async function handleSave(e) {
    e.preventDefault()

    try {
      if (editingSupplier) {
        const { error } = await supabase
          .from('suppliers')
          .update({
            supplier_name: form.supplier_name,
            supplier_type: form.supplier_type,
            contact_person: form.contact_person,
            email: form.email,
            phone: form.phone,
            address: form.address,
          })
          .eq('id', editingSupplier.id)

        if (error) throw error
      } else {
        await createRecord('suppliers', {
          supplier_name: form.supplier_name,
          supplier_type: form.supplier_type,
          contact_person: form.contact_person,
          email: form.email,
          phone: form.phone,
          address: form.address,
        })
      }

      const data = await fetchOrderManagementData()
      setSuppliers(data.suppliers)

      setForm({
        supplier_name: '',
        supplier_type: 'manufacturer',
        contact_person: '',
        email: '',
        phone: '',
        address: '',
      })

      setEditingSupplier(null)
      setShowModal(false)
    } catch (err) {
      alert(err.message)
    }
  }

  function handleEdit(supplier) {
    setEditingSupplier(supplier)

    setForm({
      supplier_name: supplier.supplier_name || '',
      supplier_type: supplier.supplier_type || 'manufacturer',
      contact_person: supplier.contact_person || '',
      email: supplier.email || '',
      phone: supplier.phone || '',
      address: supplier.address || '',
    })

    setShowModal(true)
  }


  async function handleDelete() {
    if (!supplierToDelete) return

    setDeleting(true)
    setDeleteError('')

    try {
      await deleteRecord('suppliers', supplierToDelete.id)

      setSuppliers((prev) =>
        prev.filter((s) => s.id !== supplierToDelete.id)
      )

      setShowDeleteModal(false)
      setSupplierToDelete(null)
    } catch (err) {
      setDeleteError(err.message)
    } finally {
      setDeleting(false)
    }
  }


  function handleView(supplier) {
    setSelectedSupplier(supplier)
    setShowViewModal(true)
  }


  function handleCSV(e) {
    const file = e.target.files?.[0]

    if (!file) return

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,

      complete: ({ data }) => {
        const rows = data
          .filter(row => row.supplier_name?.trim())
          .map(row => ({
            supplier_name: row.supplier_name.trim(),
            supplier_type: row.supplier_type || "manufacturer",
            contact_person: row.contact_person || "",
            email: row.email || "",
            phone: row.phone || "",
            address: row.address || "",
          }))

        setCsvRows(rows)
      },
    })
  }


  async function handleImport() {
    if (csvRows.length === 0) return

    try {
      setImporting(true)

      await importSuppliers(csvRows)

      setSuppliers(await fetchSuppliers())

      setCsvRows([])
      setShowImportModal(false)

    } catch (err) {
      alert(err.message)
    } finally {
      setImporting(false)
    }
  }


  const reliabilityLabel = (score) => {
    if (!score) return { label: 'N/A', cls: 'badge-gray' }
    if (score >= 0.85) return { label: 'Good', cls: 'badge-green' }
    if (score >= 0.7) return { label: 'Fair', cls: 'badge-yellow' }
    return { label: 'At risk', cls: 'badge-red' }
  }


  return (
    <div className="w-full">
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-gray-900">
            Suppliers
          </h1>
        </div>

        <div className="flex gap-2">
          <button
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium hover:bg-gray-100"
            onClick={() => setShowImportModal(true)}
          >
            ⏏ Import CSV
          </button>

          <button
            className="btn btn-primary"
            onClick={() => setShowModal(true)}
          >
            + Add Supplier
          </button>
        </div>
      </div>

      <div className="card" style={{ width: '100%' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th className="table-th">Supplier</th>
              <th className="table-th">Type</th>
              <th className="table-th" style={{ textAlign: 'right' }}>Avg lead days</th>
              <th className="table-th" style={{ textAlign: 'right' }}>On-time rate</th>
              <th className="table-th" style={{ textAlign: 'right' }}>Active POs</th>
              <th className="table-th">Reliability</th>
              <th className="table-th"></th>
            </tr>
          </thead>
          <tbody>
            {suppliers.map((supplier) => {
              const perf = supplier.supplier_performance?.[0]
              const activePOs = supplier.purchase_orders?.filter((po) => ['sent', 'partially_delivered'].includes(po.status)).length || 0
              const onTimeRate = perf
                ? Math.round(((perf.total_purchase_orders - perf.late_delivery_count) / Math.max(perf.total_purchase_orders, 1)) * 100)
                : null
              const rel = reliabilityLabel(perf?.reliability_score)
              return (
                <tr key={supplier.id}>
                  <td className="table-td">
                    <div className="td-primary">{supplier.supplier_name}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{supplier.email}</div>
                  </td>
                  <td className="table-td" style={{ textTransform: 'capitalize' }}>{supplier.supplier_type || '-'}</td>
                  <td className="table-td" style={{ textAlign: 'right' }}>{perf?.average_lead_time_days ? `${Math.round(perf.average_lead_time_days)} days` : '-'}</td>
                  <td className="table-td" style={{ textAlign: 'right' }}>{onTimeRate != null ? `${onTimeRate}%` : '-'}</td>
                  <td className="table-td" style={{ textAlign: 'right' }}>{activePOs}</td>
                  <td className="table-td"><span className={`badge ${rel.cls}`}>{rel.label}</span></td>
                  <td className="table-td">
                    <div className="flex justify-end gap-2">
                      <button className="rounded border px-3 py-1 text-sm hover:bg-gray-100" onClick={() => handleView(supplier)}>
                        View
                      </button>

                      <button
                        className="rounded border border-blue-200 px-3 py-1 text-sm text-blue-600 hover:bg-blue-50"
                        onClick={() => handleEdit(supplier)}
                      >
                        Edit
                      </button>

                      <button className="rounded border border-red-200 px-3 py-1 text-sm text-red-600 hover:bg-red-50"
                        onClick={() => {
                          setSupplierToDelete(supplier)
                          setShowDeleteModal(true)
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
            {suppliers.length === 0 && <tr><td colSpan={7} className="table-td" style={{ textAlign: 'center', padding: 32 }}>No suppliers</td></tr>}
          </tbody>
        </table>


        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl">
              <h2 className="mb-6 text-xl font-semibold">
                {editingSupplier ? "Edit Supplier" : "Add Supplier"}
              </h2>

              <form onSubmit={handleSave}>
                <div className="grid grid-cols-2 gap-4">

                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      Supplier Name *
                    </label>
                    <input
                      type="text"
                      required
                      className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-black focus:outline-none"
                      value={form.supplier_name}
                      onChange={(e) =>
                        setForm({ ...form, supplier_name: e.target.value })
                      }
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      Supplier Type
                    </label>
                    <select
                      className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-black focus:outline-none"
                      value={form.supplier_type}
                      onChange={(e) =>
                        setForm({ ...form, supplier_type: e.target.value })
                      }
                    >
                      <option value="manufacturer">Manufacturer</option>
                      <option value="distributor">Distributor</option>
                      <option value="supermarket">Supermarket</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      Contact Person
                    </label>
                    <input
                      type="text"
                      className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-black focus:outline-none"
                      value={form.contact_person}
                      onChange={(e) =>
                        setForm({ ...form, contact_person: e.target.value })
                      }
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      Email
                    </label>
                    <input
                      type="email"
                      className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-black focus:outline-none"
                      value={form.email}
                      onChange={(e) =>
                        setForm({ ...form, email: e.target.value })
                      }
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      Phone
                    </label>
                    <input
                      type="text"
                      className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-black focus:outline-none"
                      value={form.phone}
                      onChange={(e) =>
                        setForm({ ...form, phone: e.target.value })
                      }
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="mb-1 block text-sm font-medium">
                      Address
                    </label>
                    <textarea
                      rows={3}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-black focus:outline-none"
                      value={form.address}
                      onChange={(e) =>
                        setForm({ ...form, address: e.target.value })
                      }
                    />
                  </div>

                </div>

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false)
                      setEditingSupplier(null)
                      setForm({
                        supplier_name: '',
                        supplier_type: 'manufacturer',
                        contact_person: '',
                        email: '',
                        phone: '',
                        address: '',
                      })
                    }}
                    className="rounded-md border border-gray-300 px-4 py-2 hover:bg-gray-100"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="rounded-md bg-black px-4 py-2 text-white hover:bg-gray-800"
                  >
                    {editingSupplier ? "Update Supplier" : "Save Supplier"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}


        {showImportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="w-full max-w-xl rounded-lg bg-white p-6 shadow-xl">

              <h2 className="mb-2 text-xl font-semibold">
                Import Suppliers
              </h2>

              <p className="mb-6 text-sm text-gray-600">
                Upload a CSV file containing supplier information.
              </p>

              <div className="space-y-4">

                <input
                  type="file"
                  accept=".csv"
                  onChange={handleCSV}
                  className="block w-full rounded-md border border-gray-300 p-2 text-sm
                            file:mr-4 file:rounded-md file:border-0
                            file:bg-gray-100 file:px-4 file:py-2
                            file:text-sm file:font-medium
                            hover:file:bg-gray-200"
                />

                <div className="rounded-md bg-gray-50 p-4 text-sm">
                  <p className="mb-2 font-medium">Expected columns</p>

                  <ul className="list-disc space-y-1 pl-5 text-gray-600">
                    <li>supplier_name <span className="text-red-500">*</span></li>
                    <li>supplier_type</li>
                    <li>contact_person</li>
                    <li>email</li>
                    <li>phone</li>
                    <li>address</li>
                  </ul>
                </div>

              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setShowImportModal(false)}
                  className="rounded-md border border-gray-300 px-4 py-2 hover:bg-gray-100"
                >
                  Cancel
                </button>

                <button
                  onClick={handleImport}
                  disabled={importing || csvRows.length === 0}
                  className="rounded-md bg-black px-4 py-2 text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
                >
                  {importing
                    ? "Importing..."
                    : `Import ${csvRows.length || ""} Supplier${csvRows.length === 1 ? "" : "s"}`}
                </button>
              </div>

            </div>
          </div>
        )}


        {showViewModal && selectedSupplier && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl">

              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-xl font-semibold">
                  Supplier Details
                </h2>

                <button
                  onClick={() => setShowViewModal(false)}
                  className="text-xl text-gray-500 hover:text-black"
                >
                  ×
                </button>
              </div>

              <div className="grid grid-cols-2 gap-5">

                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">
                    Supplier Name
                  </p>
                  <p className="font-medium">
                    {selectedSupplier.supplier_name}
                  </p>
                </div>

                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">
                    Type
                  </p>
                  <p className="capitalize">
                    {selectedSupplier.supplier_type || "-"}
                  </p>
                </div>

                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">
                    Contact Person
                  </p>
                  <p>
                    {selectedSupplier.contact_person || "-"}
                  </p>
                </div>

                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">
                    Email
                  </p>
                  <p>
                    {selectedSupplier.email || "-"}
                  </p>
                </div>

                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">
                    Phone
                  </p>
                  <p>
                    {selectedSupplier.phone || "-"}
                  </p>
                </div>

                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">
                    Open Purchase Orders
                  </p>
                  <p>
                    {selectedSupplier.purchase_orders?.length || 0}
                  </p>
                </div>

                <div className="col-span-2">
                  <p className="text-xs uppercase tracking-wide text-gray-500">
                    Address
                  </p>
                  <p>
                    {selectedSupplier.address || "-"}
                  </p>
                </div>

              </div>

              {selectedSupplier.supplier_performance?.[0] && (
                <>
                  <hr className="my-6" />

                  <h3 className="mb-4 font-semibold">
                    Performance
                  </h3>

                  <div className="grid grid-cols-3 gap-4">

                    <div className="rounded border p-4">
                      <p className="text-xs text-gray-500">
                        Avg Lead Time
                      </p>
                      <p className="text-lg font-semibold">
                        {Math.round(
                          selectedSupplier.supplier_performance[0]
                            .average_lead_time_days
                        )}{" "}
                        days
                      </p>
                    </div>

                    <div className="rounded border p-4">
                      <p className="text-xs text-gray-500">
                        Late Deliveries
                      </p>
                      <p className="text-lg font-semibold">
                        {
                          selectedSupplier.supplier_performance[0]
                            .late_delivery_count
                        }
                      </p>
                    </div>

                    <div className="rounded border p-4">
                      <p className="text-xs text-gray-500">
                        Reliability
                      </p>
                      <p className="text-lg font-semibold">
                        {Math.round(
                          selectedSupplier.supplier_performance[0]
                            .reliability_score * 100
                        )}
                        %
                      </p>
                    </div>

                  </div>
                </>
              )}

              <div className="mt-8 flex justify-end">
                <button
                  onClick={() => setShowViewModal(false)}
                  className="rounded bg-black px-5 py-2 text-white hover:bg-gray-800"
                >
                  Close
                </button>
              </div>

            </div>
          </div>
        )}


        {showDeleteModal && supplierToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">

              <h2 className="text-xl font-semibold text-gray-900">
                Delete Supplier
              </h2>

              <p className="mt-3 text-sm text-gray-600">
                Are you sure you want to delete{" "}
                <span className="font-semibold">
                  {supplierToDelete.supplier_name}
                </span>
                ?
              </p>

              <p className="mt-1 text-sm text-gray-600">
                This action cannot be undone.
              </p>

              {deleteError && (
                <div className="mb-4 mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {deleteError}
                </div>
              )}

              <div className="mt-8 flex justify-end gap-3">

                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => {
                    setShowDeleteModal(false)
                    setSupplierToDelete(null)
                    setDeleteError('')
                  }}
                  className="rounded-md border border-gray-300 px-4 py-2 hover:bg-gray-100 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={deleting}
                  onClick={handleDelete}
                  className="rounded-md bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-400"
                >
                  {deleting ? "Deleting..." : "Confirm Delete"}
                </button>

              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
