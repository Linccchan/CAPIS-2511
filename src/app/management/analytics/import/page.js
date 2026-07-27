'use client'

import { useState } from 'react'
import Papa from 'papaparse'
import { supabase } from '@/lib/supabaseClient'

// Imports DMC's historical Odoo purchase orders to compute real supplier lead
// times (proposal §1.6.2). The raw file is parsed in the browser and never
// uploaded — only the per-supplier aggregates are stored, so no transaction
// history, customer data, or costs enter the database.

const pick = (row, names) => {
  const keys = Object.keys(row)
  for (const name of names) {
    const key = keys.find((k) => k.trim().toLowerCase() === name.toLowerCase())
    if (key && String(row[key]).trim() !== '') return String(row[key]).trim()
  }
  return ''
}

// Odoo exports vary: 2026-07-27, 07/27/2026, 27/07/2026, any with a time part.
const parseDate = (value) => {
  if (!value) return null
  const text = String(value).trim().split(' ')[0]
  let m = text.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  m = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (m) {
    const a = Number(m[1]), b = Number(m[2])
    // Day-first only when the first number can't be a month.
    const [month, day] = a > 12 ? [b, a] : [a, b]
    return new Date(Number(m[3]), month - 1, day)
  }
  const parsed = new Date(text)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const daysBetween = (a, b) => Math.round((b - a) / 86400000)

export default function AnalyticsImport() {
  const [poRows, setPoRows] = useState([])
  const [receiptRows, setReceiptRows] = useState([])
  const [summary, setSummary] = useState(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)

  const readCsv = (file, setter) => {
    if (!file) return
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        setter(result.data || [])
        setMessage(null)
        setSummary(null)
      },
      error: (err) => setMessage({ type: 'error', text: `Could not read the file: ${err.message}` }),
    })
  }

  const analyse = () => {
    if (poRows.length === 0) {
      setMessage({ type: 'error', text: 'Load the purchase orders export first.' })
      return
    }

    // Receipt actual-arrival dates keyed by the PO reference they came from.
    const actualByRef = {}
    for (const r of receiptRows) {
      const ref = pick(r, ['Source Document', 'Source', 'Origin'])
      const effective = parseDate(pick(r, ['Effective Date', 'Date Done', 'Actual Date', 'Transfer Date']))
      if (ref && effective) actualByRef[ref] = effective
    }

    const bySupplier = {}
    let withActual = 0
    let skipped = 0

    for (const row of poRows) {
      const vendor = pick(row, ['Vendor', 'Supplier', 'Partner'])
      const reference = pick(row, ['Order Reference', 'Reference', 'Order'])
      const issued = parseDate(pick(row, ['Created on', 'Order Date', 'Confirmation Date', 'Date']))
      const deadline = parseDate(pick(row, ['Order Deadline', 'Expected Arrival', 'Scheduled Date', 'Receipt Date']))
      const actual = actualByRef[reference] || null

      if (!vendor || !issued) { skipped++; continue }

      const endDate = actual || deadline
      if (!endDate) { skipped++; continue }

      const lead = daysBetween(issued, endDate)
      if (lead < 0 || lead > 365) { skipped++; continue }

      if (!bySupplier[vendor]) bySupplier[vendor] = { vendor, leads: [], late: 0, actualCount: 0 }
      bySupplier[vendor].leads.push(lead)
      if (actual) {
        bySupplier[vendor].actualCount++
        withActual++
        if (deadline && actual > deadline) bySupplier[vendor].late++
      }
    }

    const suppliers = Object.values(bySupplier).map((s) => {
      const total = s.leads.length
      const avg = s.leads.reduce((a, b) => a + b, 0) / total
      // Reliability rewards on-time delivery; with no actual dates we can only
      // score against the planned schedule, so it is reported as provisional.
      const onTimeRate = s.actualCount ? (s.actualCount - s.late) / s.actualCount : null
      const score = onTimeRate != null ? Math.round(onTimeRate * 100) : null
      return {
        vendor: s.vendor,
        avgLead: Math.round(avg * 10) / 10,
        totalPOs: total,
        late: s.late,
        score,
        basis: s.actualCount ? 'actual receipts' : 'planned dates',
      }
    }).sort((a, b) => a.vendor.localeCompare(b.vendor))

    setSummary({ suppliers, skipped, withActual, totalRows: poRows.length })
    setMessage(null)
  }

  const save = async () => {
    if (!summary) return
    setSaving(true)

    const { data: dbSuppliers } = await supabase.from('suppliers').select('id, supplier_name')
    const byName = {}
    for (const s of dbSuppliers || []) byName[s.supplier_name.trim().toLowerCase()] = s.id

    let written = 0
    const unmatched = []

    for (const s of summary.suppliers) {
      const supplierId = byName[s.vendor.trim().toLowerCase()]
      if (!supplierId) { unmatched.push(s.vendor); continue }

      await supabase.from('supplier_performance').delete().eq('supplier_id', supplierId)
      const { error } = await supabase.from('supplier_performance').insert({
        supplier_id: supplierId,
        average_lead_time_days: s.avgLead,
        late_delivery_count: s.late,
        total_purchase_orders: s.totalPOs,
        reliability_score: s.score,
      })
      if (!error) written++
    }

    setSaving(false)
    setMessage({
      type: written ? 'success' : 'error',
      text: written
        ? `Saved performance for ${written} supplier${written > 1 ? 's' : ''}.` +
          (unmatched.length ? ` Not matched to a supplier record: ${unmatched.join(', ')}.` : '')
        : `No suppliers matched. Names in the file must match the Suppliers list: ${unmatched.join(', ')}.`,
    })
  }

  const fileInput = 'w-full text-sm text-gray-600 file:mr-3 file:border file:border-gray-300 file:rounded file:px-3 file:py-1.5 file:text-sm file:bg-white file:text-gray-700 hover:file:bg-gray-50'

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Import historical purchase orders</h1>
        <p className="text-sm text-gray-500">
          Computes each supplier&apos;s real lead time and reliability from DMC&apos;s Odoo history.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded p-3 mb-6 text-sm text-gray-600">
        ● Files are read in your browser and never uploaded. Only per-supplier averages are saved —
        no transactions, customers, or costs are stored.
      </div>

      {message && (
        <div className={`rounded p-3 mb-6 text-sm ${message.type === 'error' ? 'bg-red-50 text-red-600' : 'bg-white border border-gray-200 text-gray-900'}`}>
          {message.type === 'error' ? '' : '✓ '}{message.text}
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 p-5 mb-6">
        <h2 className="font-semibold text-gray-900 mb-4">1 · Load the exports</h2>

        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Purchase orders (required)</label>
            <input type="file" accept=".csv" onChange={(e) => readCsv(e.target.files?.[0], setPoRows)} className={fileInput} />
            <p className="text-xs text-gray-400 mt-1">Needs Vendor and Created on. {poRows.length > 0 && `${poRows.length} rows loaded.`}</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Receipts (optional)</label>
            <input type="file" accept=".csv" onChange={(e) => readCsv(e.target.files?.[0], setReceiptRows)} className={fileInput} />
            <p className="text-xs text-gray-400 mt-1">Adds real arrival dates via Effective Date. {receiptRows.length > 0 && `${receiptRows.length} rows loaded.`}</p>
          </div>
        </div>

        <button onClick={analyse} className="mt-4 bg-black text-white text-sm px-4 py-2 rounded hover:bg-gray-800">
          Analyse
        </button>
      </div>

      {summary && (
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-1">2 · Review before saving</h2>
          <p className="text-xs text-gray-400 mb-4">
            {summary.totalRows} rows read · {summary.withActual} with actual arrival dates · {summary.skipped} skipped (missing or implausible dates)
            {summary.withActual === 0 && ' · lead times are based on planned dates, so reliability cannot be scored yet'}
          </p>

          {summary.suppliers.length === 0 ? (
            <p className="text-sm text-gray-400 py-6 text-center">Nothing usable found — check that the file has Vendor and date columns.</p>
          ) : (
            <>
              <table className="w-full text-sm mb-4">
                <thead>
                  <tr className="text-left text-xs text-gray-400 uppercase border-b border-gray-100">
                    <th className="pb-2">Supplier</th>
                    <th className="pb-2">Avg Lead Days</th>
                    <th className="pb-2">Purchase Orders</th>
                    <th className="pb-2">Late</th>
                    <th className="pb-2">Reliability</th>
                    <th className="pb-2">Based On</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.suppliers.map((s) => (
                    <tr key={s.vendor} className="border-b border-gray-50">
                      <td className="py-3 font-medium">{s.vendor}</td>
                      <td className="py-3 text-gray-600">{s.avgLead} days</td>
                      <td className="py-3 text-gray-600">{s.totalPOs}</td>
                      <td className="py-3 text-gray-600">{s.score == null ? '—' : s.late}</td>
                      <td className="py-3 text-gray-600">{s.score == null ? '—' : `${s.score}%`}</td>
                      <td className="py-3 text-gray-400 text-xs">{s.basis}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <button onClick={save} disabled={saving} className="bg-black text-white text-sm px-4 py-2 rounded hover:bg-gray-800 disabled:opacity-50">
                {saving ? 'Saving...' : 'Save supplier performance'}
              </button>
              <p className="text-xs text-gray-400 mt-2">
                Supplier names must match the Suppliers list; unmatched ones are reported and skipped.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  )
}
