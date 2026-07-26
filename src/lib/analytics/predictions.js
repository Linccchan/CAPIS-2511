// Predictive Analytics engine (Module 4) — statistical heuristic.
//
// Works entirely from DMC's own operational history (proposal §1.6.2): no
// external supplier/logistics feeds. Every prediction is explainable — it's
// derived from recorded lead times and reliability, not a black box. As more
// history accumulates, the inputs sharpen (proposal §1.7.3).

import { supabase } from '@/lib/supabaseClient'

// DMC operational baselines (proposal §1.3): suppliers deliver in 30–45 days,
// warehouse stickering/staging takes 1–2 weeks.
export const DEFAULT_LEAD_DAYS = 38
export const WAREHOUSE_PREP_DAYS = 14

const MS_DAY = 86_400_000
const today = () => new Date(new Date().toISOString().split('T')[0])
const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / MS_DAY)
const addDays = (date, n) => { const d = new Date(date); d.setDate(d.getDate() + n); return d }
export const isoDate = (d) => (d ? new Date(d).toISOString().split('T')[0] : null)

const ORDER_DONE = ['completed', 'cancelled']

export function reliabilityTier(score) {
  if (score == null) return { label: 'Unrated', tone: 'gray' }
  if (score >= 85) return { label: 'Good', tone: 'black' }
  if (score >= 70) return { label: 'Fair', tone: 'gray' }
  return { label: 'At risk', tone: 'gray' }
}

// On-time rate from a performance row (total POs minus late ones).
export function onTimeRate(perf) {
  if (!perf || !perf.total_purchase_orders) return null
  const late = perf.late_delivery_count || 0
  return Math.round(((perf.total_purchase_orders - late) / perf.total_purchase_orders) * 100)
}

// Predict when a single order will be ready to ship.
// ETA = slowest supplier's expected completion + warehouse prep. Confidence
// falls when we lean on defaults or on an unreliable supplier.
function predictOrder(order, perfBySupplier) {
  const pos = order.purchase_orders || []
  let slowestETA = null
  let slowestSupplier = null
  let usedDefault = false
  let reliabilitySum = 0
  let reliabilityCount = 0

  const basisPOs = pos.filter((po) => !['cancelled'].includes(po.status))

  for (const po of basisPOs) {
    // Already completed POs contribute their actual date.
    if (po.actual_completed_date) {
      const eta = new Date(po.actual_completed_date)
      if (!slowestETA || eta > slowestETA) { slowestETA = eta; slowestSupplier = po.suppliers?.supplier_name }
      continue
    }
    const perf = perfBySupplier[po.supplier_id]
    const leadDays = perf?.average_lead_time_days ?? DEFAULT_LEAD_DAYS
    if (perf?.average_lead_time_days == null) usedDefault = true
    if (perf?.reliability_score != null) { reliabilitySum += Number(perf.reliability_score); reliabilityCount++ }
    const start = po.issued_date ? new Date(po.issued_date) : (order.confirmed_at ? new Date(order.confirmed_at) : today())
    const eta = addDays(start, Number(leadDays))
    if (!slowestETA || eta > slowestETA) { slowestETA = eta; slowestSupplier = po.suppliers?.supplier_name }
  }

  // No POs issued yet — base off order confirmation (or today) + a full cycle.
  if (!slowestETA) {
    const start = order.confirmed_at ? new Date(order.confirmed_at) : today()
    slowestETA = addDays(start, DEFAULT_LEAD_DAYS)
    usedDefault = true
  }

  const predictedReadyDate = addDays(slowestETA, WAREHOUSE_PREP_DAYS)

  // Confidence: start from the slowest supplier's reliability (or a low prior
  // when we're guessing), and dock points for using defaults / no PO data.
  const avgReliability = reliabilityCount ? reliabilitySum / reliabilityCount : null
  let confidence = avgReliability != null ? avgReliability : 45
  if (usedDefault) confidence -= 15
  if (basisPOs.length === 0) confidence -= 15
  confidence = Math.max(20, Math.min(95, Math.round(confidence)))

  const slowestPerf = basisPOs
    .map((po) => perfBySupplier[po.supplier_id])
    .filter(Boolean)
    .sort((a, b) => (a.reliability_score ?? 100) - (b.reliability_score ?? 100))[0]
  const overdue = basisPOs.some((po) => po.expected_delivery_date && !po.actual_completed_date && new Date(po.expected_delivery_date) < today())

  let riskLabel = 'Low risk'
  if (overdue) riskLabel = `${slowestSupplier || 'Supplier'} overdue`
  else if (slowestPerf && (slowestPerf.reliability_score ?? 100) < 70) riskLabel = `${slowestSupplier || 'Supplier'} delay risk`

  return {
    orderId: order.id,
    orderNumber: order.order_number,
    customer: order.customers?.company_name || '—',
    currentStatus: order.status,
    predictedReadyDate: isoDate(predictedReadyDate),
    confidence,
    riskLabel,
    riskTone: riskLabel === 'Low risk' ? 'black' : 'gray',
    basedOn: slowestSupplier ? `${slowestSupplier} lead time` : 'default cycle estimate',
  }
}

export async function fetchAnalytics() {
  const [{ data: suppliers }, { data: perf }, { data: orders }] = await Promise.all([
    supabase.from('suppliers').select('id, supplier_name, supplier_type'),
    supabase.from('supplier_performance').select('*'),
    supabase
      .from('customer_orders')
      .select('*, customers(company_name), purchase_orders(*, suppliers(supplier_name))')
      .order('created_at', { ascending: false }),
  ])

  const perfBySupplier = {}
  for (const p of perf || []) perfBySupplier[p.supplier_id] = p

  // Supplier reliability scorecards (sorted worst-first — that's what needs attention).
  const supplierReliability = (suppliers || [])
    .map((s) => {
      const p = perfBySupplier[s.id]
      return {
        id: s.id,
        name: s.supplier_name,
        type: s.supplier_type,
        avgLeadDays: p?.average_lead_time_days ?? null,
        onTime: onTimeRate(p),
        lateCount: p?.late_delivery_count ?? null,
        totalPOs: p?.total_purchase_orders ?? null,
        score: p?.reliability_score ?? null,
        tier: reliabilityTier(p?.reliability_score),
      }
    })
    .sort((a, b) => (a.score ?? 999) - (b.score ?? 999))

  const activeOrders = (orders || []).filter((o) => !ORDER_DONE.includes(o.status))
  const predictions = activeOrders
    .map((o) => predictOrder(o, perfBySupplier))
    .sort((a, b) => new Date(a.predictedReadyDate) - new Date(b.predictedReadyDate))

  // Overview metrics.
  const completed = (orders || []).filter((o) => o.confirmed_at && o.actual_ready_date)
  const avgOrderToShip = completed.length
    ? Math.round(completed.reduce((s, o) => s + daysBetween(o.confirmed_at, o.actual_ready_date), 0) / completed.length)
    : null

  const totalPOs = (perf || []).reduce((s, p) => s + (p.total_purchase_orders || 0), 0)
  const totalLate = (perf || []).reduce((s, p) => s + (p.late_delivery_count || 0), 0)
  const onTimeSupplierRate = totalPOs ? Math.round(((totalPOs - totalLate) / totalPOs) * 100) : null

  const atRiskPredictions = predictions.filter((p) => p.riskLabel !== 'Low risk').length

  // Orders completed per month (last 6 months) for the trend bar.
  const monthly = {}
  for (const o of orders || []) {
    if (o.status !== 'completed' && o.status !== 'shipped') continue
    const key = (o.actual_ready_date || o.created_at || '').slice(0, 7)
    if (key) monthly[key] = (monthly[key] || 0) + 1
  }
  const completionsByMonth = Object.entries(monthly)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-6)
    .map(([month, count]) => ({ month, count }))

  return {
    overview: {
      activeOrders: activeOrders.length,
      avgOrderToShip,
      onTimeSupplierRate,
      atRiskPredictions,
      targetOrderToShip: DEFAULT_LEAD_DAYS + WAREHOUSE_PREP_DAYS,
    },
    supplierReliability,
    predictions,
    completionsByMonth,
  }
}
