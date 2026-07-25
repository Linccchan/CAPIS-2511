'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";


export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState([])

  useEffect(() => {
    let active = true
    async function load() {
      const { data } = await supabase
        .from("suppliers")
        .select(`
          *,
          supplier_performance(
            id,
            average_lead_time_days,
            late_delivery_count,
            total_purchase_orders,
            reliability_score,
            calculated_at
          ),
          purchase_orders(id, status)
        `)
        .order("supplier_name")
      if (active) setSuppliers(data || [])
    }
    load()
    return () => {
      active = false
    }
  }, [])


  return (
    <div className="w-full">
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-gray-900">
            Suppliers Performance Report
          </h1>
        </div>
      </div>





        <div className="grid grid-cols-1 gap-6 md:grid-cols-4">

        <div className="rounded-lg border border-gray-300 bg-white p-5">
            <p className="text-xs font-bold uppercase text-gray-500">Suppliers</p>
            <h2 className="mt-2 text-3xl font-bold">
            {suppliers.length}
            </h2>
        </div>

        <div className="rounded-lg border border-gray-300 bg-white p-5">
            <p className="text-sm text-gray-500">Average Reliability</p>
            <h2 className="mt-2 text-3xl font-bold">
            {suppliers.length
                ? Math.round(
                    suppliers.reduce(
                    (sum, s) =>
                        sum +
                        ((s.supplier_performance?.[0]?.reliability_score ?? 0) * 100),
                    0
                    ) / suppliers.length
                )
                : 0}
            %
            </h2>
        </div>

        <div className="rounded-lg border border-gray-300 bg-white p-5">
            <p className="text-sm text-gray-500">Average Lead Time</p>
            <h2 className="mt-2 text-3xl font-bold">
            {suppliers.length
                ? (
                    suppliers.reduce(
                    (sum, s) =>
                        sum +
                        (s.supplier_performance?.[0]?.average_lead_time_days ?? 0),
                    0
                    ) / suppliers.length
                ).toFixed(1)
                : 0}
            <span className="text-lg font-normal"> days</span>
            </h2>
        </div>

        <div className="rounded-lg border border-gray-300 bg-white p-5">
            <p className="text-sm text-gray-500">Late Deliveries</p>
            <h2 className="mt-2 text-3xl font-bold">
            {suppliers.reduce(
                (sum, s) =>
                sum +
                (s.supplier_performance?.[0]?.late_delivery_count ?? 0),
                0
            )}
            </h2>
        </div>

        </div>

        <div className="mt-8 rounded-lg border border-gray-300 bg-white p-5">

        <h2 className="mb-6 text-lg font-semibold">
            Supplier Reliability
        </h2>

        <ResponsiveContainer width="100%" height={420}>
            <BarChart
            data={suppliers.map((supplier) => ({
                name: supplier.supplier_name,
                reliability:
                (supplier.supplier_performance?.[0]?.reliability_score ?? 0) *
                100,
            }))}
            >
            <CartesianGrid strokeDasharray="3 3" />

            <XAxis
                dataKey="name"
                angle={-20}
                textAnchor="end"
                interval={0}
                height={70}
            />

            <YAxis
                domain={[0, 100]}
                tickFormatter={(v) => `${v}%`}
            />

            <Tooltip
                formatter={(value) => [`${value}%`, "Reliability"]}
            />

            <Bar
                dataKey="reliability"
                radius={[6, 6, 0, 0]}
            />
            </BarChart>
        </ResponsiveContainer>

        </div>



    </div>
    
  )
}
