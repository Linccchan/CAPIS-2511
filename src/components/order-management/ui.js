'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createContext, useContext, useMemo, useState } from 'react'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const api = useMemo(() => ({
    show(message, type = 'success') {
      const id = Date.now()
      setToasts((current) => [...current, { id, message, type }])
      setTimeout(() => {
        setToasts((current) => current.filter((toast) => toast.id !== id))
      }, 3500)
    },
  }), [])

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="fixed right-4 top-4 z-50 space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`rounded border px-4 py-3 text-sm shadow-md ${
              toast.type === 'error'
                ? 'border-red-200 bg-red-50 text-red-700'
                : 'border-green-200 bg-green-50 text-green-700'
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)

export function OrderShell({ children, title, description }) {
  const pathname = usePathname()
  const navItems = [
    ['Dashboard', '/order-management'],
    ['Customer Orders', '/order-management/customer-orders'],
    ['Purchase Orders', '/order-management/purchase-orders'],
    ['Supplier Deliveries', '/order-management/supplier-deliveries'],
  ]

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900">
      <div className="flex min-h-screen">
        <aside className="hidden w-64 border-r border-gray-200 bg-white lg:block">
          <div className="border-b border-gray-200 px-6 py-5">
            <div className="text-lg font-semibold">CAPIS</div>
            <div className="text-xs text-gray-500">Export Consolidation System</div>
          </div>
          <nav className="space-y-1 p-4">
            {navItems.map(([label, href]) => {
              const active = pathname === href
              return (
                <Link
                  key={href}
                  href={href}
                  className={`block rounded px-3 py-2 text-sm font-medium ${
                    active ? 'bg-black text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  {label}
                </Link>
              )
            })}
          </nav>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          <header className="border-b border-gray-200 bg-white px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
                <p className="mt-1 text-sm text-gray-500">{description}</p>
              </div>
              <div className="flex flex-wrap gap-2 lg:hidden">
                {navItems.map(([label, href]) => (
                  <Link
                    key={href}
                    href={href}
                    className={`rounded border px-3 py-2 text-xs font-medium ${
                      pathname === href ? 'border-black bg-black text-white' : 'border-gray-200 bg-white text-gray-600'
                    }`}
                  >
                    {label}
                  </Link>
                ))}
              </div>
            </div>
          </header>
          <div className="flex-1 p-4 sm:p-6 lg:p-8">{children}</div>
        </main>
      </div>
    </div>
  )
}

export function Card({ title, action, children }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white shadow-sm">
      {(title || action) && (
        <div className="flex items-center justify-between gap-4 border-b border-gray-200 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
          {action}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  )
}

export function StatCard({ label, value }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <div className="text-xs font-semibold uppercase text-gray-500">{label}</div>
      <div className="mt-3 text-2xl font-semibold text-gray-900">{value}</div>
    </div>
  )
}

export function Badge({ children, tone = 'gray' }) {
  const tones = {
    green: 'bg-green-50 text-green-700 border-green-200',
    yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    black: 'bg-gray-900 text-white border-gray-900',
    gray: 'bg-gray-50 text-gray-700 border-gray-200',
  }
  return <span className={`inline-flex rounded border px-2 py-1 text-xs font-medium ${tones[tone]}`}>{children}</span>
}

export function statusTone(status) {
  const value = String(status || '').toLowerCase()
  if (['complete', 'completed', 'delivered', 'ready for shipment'].includes(value)) return 'green'
  if (['partial', 'partially delivered', 'processing', 'in progress', 'awaiting supplier deliveries'].includes(value)) return 'yellow'
  if (['pending', 'cancelled', 'rejected'].includes(value)) return value === 'pending' ? 'red' : 'gray'
  return 'gray'
}

export function ProgressBar({ value }) {
  const percent = Math.max(0, Math.min(Number(value || 0), 100))
  return (
    <div className="min-w-32">
      <div className="mb-1 text-xs font-medium text-gray-600">{percent}%</div>
      <div className="h-2 rounded bg-gray-100">
        <div className="h-2 rounded bg-black" style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}

export function EmptyState({ title = 'No records found', description = 'New records will appear here once they are available.' }) {
  return (
    <div className="rounded border border-dashed border-gray-300 p-8 text-center">
      <div className="text-sm font-semibold text-gray-900">{title}</div>
      <p className="mt-1 text-sm text-gray-500">{description}</p>
    </div>
  )
}

export function TableSkeleton({ rows = 5, cols = 6 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, row) => (
        <div key={row} className="grid gap-3" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {Array.from({ length: cols }).map((__, col) => (
            <div key={col} className="h-8 animate-pulse rounded bg-gray-100" />
          ))}
        </div>
      ))}
    </div>
  )
}

export function Button({ children, variant = 'primary', className = '', ...props }) {
  const variants = {
    primary: 'bg-black text-white hover:bg-gray-800',
    secondary: 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50',
    danger: 'bg-red-600 text-white hover:bg-red-700',
  }
  return (
    <button
      className={`rounded px-3 py-2 text-sm font-medium disabled:opacity-50 ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

export function ConfirmDialog({ open, title, message, onCancel, onConfirm, loading }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        <p className="mt-2 text-sm text-gray-600">{message}</p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel} disabled={loading}>Cancel</Button>
          <Button variant="danger" onClick={onConfirm} disabled={loading}>{loading ? 'Deleting...' : 'Delete'}</Button>
        </div>
      </div>
    </div>
  )
}
