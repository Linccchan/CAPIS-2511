'use client'

import { useState } from 'react'
import Papa from 'papaparse'
import { supabase } from '@/lib/supabaseClient'

// Imports DMC's supplier list from an Odoo contacts export. Parsed in the
// browser; nothing is uploaded. Existing suppliers are matched by name and
// skipped, so the import can be re-run safely.

const pick = (row, names) => {
  const keys = Object.keys(row)
  for (const name of names) {
    const key = keys.find((k) => k.trim().toLowerCase() === name.toLowerCase())
    if (key && String(row[key]).trim() !== '') return String(row[key]).trim()
  }
  return ''
}

const joinAddress = (row) => {
  const parts = [
    pick(row, ['Street', 'Address', 'Street 1']),
    pick(row, ['Street2', 'Street 2']),
    pick(row, ['City']),
    pick(row, ['State', 'Province', 'State/Province']),
    pick(row, ['Zip', 'Postal Code', 'ZIP']),
    pick(row, ['Country', 'Country Name']),
  ].filter(Boolean)
  return parts.length ? parts.join(', ') : null
}

export default function SupplierImport() {
  const [rows, setRows] = useState([])
  const [preview, setPreview] = useState(null)
  const [defaultType, setDefaultType] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)

  const readCsv = (file) => {
    if (!file) return
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        setRows(result.data || [])
        setPreview(null)
        setMessage(null)
      },
      error: (err) => setMessage({ type: 'error', text: `Could not read the file: ${err.message}` }),
    })
  }

  const analyse = async () => {
    if (rows.length === 0) {
      setMessage({ type: 'error', text: 'Load the supplier export first.' })
      return
    }

    const { data: existing } = await supabase.from('suppliers').select('supplier_name')
    const known = new Set((existing || []).map((s) => s.supplier_name.trim().toLowerCase()))

    const seen = new Set()
    const toAdd = []
    const duplicates = []
    let unnamed = 0

    for (const row of rows) {
      const name = pick(row, ['Name', 'Display Name', 'Vendor', 'Supplier', 'Partner', 'Company Name'])
      if (!name) { unnamed++; continue }

      const key = name.trim().toLowerCase()
      if (known.has(key) || seen.has(key)) { duplicates.push(name); continue }
      seen.add(key)

      toAdd.push({
        supplier_name: name,
        contact_person: pick(row, ['Contact Name', 'Contact', 'Contact Person']) || null,
        email: pick(row, ['Email', 'Email Address', 'Work Email']) || null,
        phone: pick(row, ['Phone', 'Mobile', 'Work Phone', 'Telephone']) || null,
        address: joinAddress(row),
      })
    }

    setPreview({ toAdd, duplicates, unnamed, total: rows.length })
    setMessage(null)
  }

  const save = async () => {
    if (!preview?.toAdd.length) return
    setSaving(true)

    // supplier_type is CHECK-constrained, so only write a valid value or null.
    const payload = preview.toAdd.map((s) => ({
      ...s,
      supplier_type: defaultType || null,
    }))

    const { error, data } = await supabase.from('suppliers').insert(payload).select('id')
    setSaving(false)

    if (error) {
      setMessage({ type: 'error', text: `Could not save: ${error.message}` })
      return
    }

    setMessage({ type: 'success', text: `Imported ${data?.length ?? payload.length} supplier(s).` })
    setPreview(null)
    setRows([])
  }

  const fileInput = 'w-full text-sm text-gray-600 file:mr-3 file:border file:border-gray-300 file:rounded file:px-3 file:py-1.5 file:text-sm file:bg-white file:text-gray-700 hover:file:bg-gray-50'

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Import suppliers</h1>
        <p className="text-sm text-gray-500">
          Load DMC&apos;s supplier list from an Odoo contacts export.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded p-3 mb-6 text-sm text-gray-600">
        ● The file is read in your browser and never uploaded. Suppliers already in the system are
        matched by name and skipped, so this can be re-run safely.
      </div>

      {message && (
        <div className={`rounded p-3 mb-6 text-sm ${message.type === 'error' ? 'bg-red-50 text-red-600' : 'bg-white border border-gray-200 text-gray-900'}`}>
          {message.type === 'error' ? '' : '✓ '}{message.text}
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 p-5 mb-6">
        <h2 className="font-semibold text-gray-900 mb-4">1 · Load the export</h2>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Supplier CSV</label>
            <input type="file" accept=".csv" onChange={(e) => readCsv(e.target.files?.[0])} className={fileInput} />
            <p className="text-xs text-gray-400 mt-1">Needs a name column. {rows.length > 0 && `${rows.length} rows loaded.`}</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Default supplier type</label>
            <select value={defaultType} onChange={(e) => setDefaultType(e.target.value)} className="w-full border border-gray-300 rounded px-3 py-2 text-sm text-black bg-white">
              <option value="">Leave blank (classify later)</option>
              <option value="manufacturer">Manufacturer</option>
              <option value="distributor">Distributor</option>
              <option value="supermarket">Supermarket</option>
            </select>
            <p className="text-xs text-gray-400 mt-1">Odoo has no equivalent field; set it per supplier afterwards if needed.</p>
          </div>
        </div>
        <button onClick={analyse} className="mt-4 bg-black text-white text-sm px-4 py-2 rounded hover:bg-gray-800">
          Analyse
        </button>
      </div>

      {preview && (
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-1">2 · Review before saving</h2>
          <p className="text-xs text-gray-400 mb-4">
            {preview.total} rows read · {preview.toAdd.length} new · {preview.duplicates.length} already present
            {preview.unnamed > 0 && ` · ${preview.unnamed} skipped with no name`}
          </p>

          {preview.toAdd.length === 0 ? (
            <p className="text-sm text-gray-400 py-6 text-center">
              Nothing new to import — every supplier in the file already exists.
            </p>
          ) : (
            <>
              <table className="w-full text-sm mb-4">
                <thead>
                  <tr className="text-left text-xs text-gray-400 uppercase border-b border-gray-100">
                    <th className="pb-2">Supplier</th>
                    <th className="pb-2">Contact</th>
                    <th className="pb-2">Email</th>
                    <th className="pb-2">Phone</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.toAdd.map((s) => (
                    <tr key={s.supplier_name} className="border-b border-gray-50">
                      <td className="py-3 font-medium">{s.supplier_name}</td>
                      <td className="py-3 text-gray-600">{s.contact_person || '—'}</td>
                      <td className="py-3 text-gray-600">{s.email || '—'}</td>
                      <td className="py-3 text-gray-600">{s.phone || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <button onClick={save} disabled={saving} className="bg-black text-white text-sm px-4 py-2 rounded hover:bg-gray-800 disabled:opacity-50">
                {saving ? 'Importing...' : `Import ${preview.toAdd.length} supplier(s)`}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
