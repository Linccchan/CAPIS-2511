'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import { fetchAnalytics } from '@/lib/analytics/predictions'

export default function ManagementAnalytics() {
  const router = useRouter()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      try {
        setData(await fetchAnalytics())
      } catch (e) {
        console.error('Analytics error:', e)
      }
      setLoading(false)
    }
    load()
  }, [])

  const formatDate = (d) =>
    d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'

  const formatMonth = (m) =>
    m ? new Date(m + '-01').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }) : '—'

  if (loading) return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <p className="text-gray-500">Loading analytics...</p>
    </div>
  )

  const o = data?.overview || {}
  const suppliers = data?.supplierReliability || []
  const predictions = data?.predictions || []
  const trend = data?.completionsByMonth || []
  const maxTrend = Math.max(1, ...trend.map((t) => t.count))

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Executive dashboard</h1>
        <p className="text-sm text-gray-500">
          Shipment-readiness predictions and supplier reliability, computed from DMC&apos;s operational history.
        </p>
      </div>

      {/* Data-source note */}
      <div className="bg-white border border-gray-200 rounded p-3 mb-6 text-sm text-gray-600">
        ● Predictions are derived from recorded supplier lead times, warehouse-prep durations, and payment delays.
        Accuracy improves as more historical transactions are imported.
      </div>

      {/* Overview cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-lg p-5 border border-gray-200">
          <p className="text-3xl font-bold text-gray-900">{o.activeOrders ?? '—'}</p>
          <p className="text-sm text-gray-500 mt-1">Active orders</p>
        </div>
        <div className="bg-white rounded-lg p-5 border border-gray-200">
          <p className="text-3xl font-bold text-gray-900">{o.avgOrderToShip != null ? `${o.avgOrderToShip}d` : '—'}</p>
          <p className="text-sm text-gray-500 mt-1">Avg order-to-ship</p>
          <p className="text-xs text-gray-400 mt-1">Target: {o.targetOrderToShip}d</p>
        </div>
        <div className="bg-white rounded-lg p-5 border border-gray-200">
          <p className="text-3xl font-bold text-gray-900">{o.onTimeSupplierRate != null ? `${o.onTimeSupplierRate}%` : '—'}</p>
          <p className="text-sm text-gray-500 mt-1">On-time supplier rate</p>
        </div>
        <div className="bg-white rounded-lg p-5 border border-gray-200">
          <p className="text-3xl font-bold text-gray-900">{o.atRiskPredictions ?? 0}</p>
          <p className="text-sm text-gray-500 mt-1">Orders flagged at risk</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Orders completed per month */}
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Orders completed per month</h2>
          {trend.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">No completed orders yet.</p>
          ) : (
            <div className="flex items-end gap-3 h-40">
              {trend.map((t) => (
                <div key={t.month} className="flex-1 flex flex-col items-center justify-end">
                  <span className="text-xs text-gray-500 mb-1">{t.count}</span>
                  <div className="w-full bg-black rounded-t" style={{ height: `${(t.count / maxTrend) * 100}%` }} />
                  <span className="text-xs text-gray-400 mt-2">{formatMonth(t.month)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Supplier reliability */}
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Supplier reliability</h2>
          {suppliers.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">No suppliers yet.</p>
          ) : (
            <div className="space-y-3">
              {suppliers.map((s) => (
                <div key={s.id}>
                  <div className="flex justify-between items-center text-sm mb-1">
                    <span className="font-medium text-gray-900">{s.name}</span>
                    <span className="text-gray-500">{s.onTime != null ? `${s.onTime}%` : '—'}</span>
                  </div>
                  <div className="h-2 rounded bg-gray-100">
                    <div className="h-2 rounded bg-black" style={{ width: `${s.onTime ?? 0}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Predictive shipment timelines */}
      <div className="bg-white rounded-lg border border-gray-200 p-5 mb-6">
        <h2 className="font-semibold text-gray-900 mb-1">Predictive shipment timelines</h2>
        <p className="text-xs text-gray-400 mb-4">Estimated ready dates for active orders — slowest supplier lead time + warehouse prep.</p>
        {predictions.length === 0 ? (
          <p className="text-sm text-gray-400 py-6 text-center">No active orders to predict.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 uppercase border-b border-gray-100">
                <th className="pb-2">Order</th>
                <th className="pb-2">Customer</th>
                <th className="pb-2">Current Status</th>
                <th className="pb-2">Predicted Ready</th>
                <th className="pb-2">Confidence</th>
                <th className="pb-2">Risk Flag</th>
              </tr>
            </thead>
            <tbody>
              {predictions.map((p) => (
                <tr key={p.orderId} className="border-b border-gray-50">
                  <td className="py-3 font-medium">{p.orderNumber}</td>
                  <td className="py-3 text-gray-600">{p.customer}</td>
                  <td className="py-3 text-gray-600">{p.currentStatus?.replace(/_/g, ' ')}</td>
                  <td className="py-3 text-gray-600">{formatDate(p.predictedReadyDate)}</td>
                  <td className="py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-2 rounded bg-gray-100">
                        <div className="h-2 rounded bg-black" style={{ width: `${p.confidence}%` }} />
                      </div>
                      <span className="text-gray-600">{p.confidence}%</span>
                    </div>
                  </td>
                  <td className="py-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${p.riskLabel === 'Low risk' ? 'bg-black text-white' : 'bg-gray-200 text-gray-700'}`}>
                      {p.riskLabel}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Supplier scorecard detail */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-900 mb-4">Supplier performance detail</h2>
        {suppliers.length === 0 ? (
          <p className="text-sm text-gray-400 py-6 text-center">No supplier data yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 uppercase border-b border-gray-100">
                <th className="pb-2">Supplier</th>
                <th className="pb-2">Type</th>
                <th className="pb-2">Avg Lead Days</th>
                <th className="pb-2">On-time Rate</th>
                <th className="pb-2">Late Deliveries</th>
                <th className="pb-2">Reliability</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map((s) => (
                <tr key={s.id} className="border-b border-gray-50">
                  <td className="py-3 font-medium">{s.name}</td>
                  <td className="py-3 text-gray-600">{s.type || '—'}</td>
                  <td className="py-3 text-gray-600">{s.avgLeadDays != null ? `${s.avgLeadDays} days` : '—'}</td>
                  <td className="py-3 text-gray-600">{s.onTime != null ? `${s.onTime}%` : '—'}</td>
                  <td className="py-3 text-gray-600">{s.lateCount != null ? `${s.lateCount} of ${s.totalPOs}` : '—'}</td>
                  <td className="py-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${s.tier.tone === 'black' ? 'bg-black text-white' : 'bg-gray-200 text-gray-700'}`}>
                      {s.tier.label}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
