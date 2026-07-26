'use client'

import Link from 'next/link'
import Image from 'next/image'
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
                ? 'border-red-200 bg-red-50 text-red-600'
                : 'border-gray-200 bg-white text-gray-900'
            }`}
          >
            {toast.type === 'error' ? '' : '✓ '}{toast.message}
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
    ['Billing & Payments', '/order-management/billing'],
  ]

  return (
    <div className="min-h-screen bg-gray-100 flex">

      {/* Sidebar — matches the customer module shell */}
      <div className="w-56 bg-white border-r border-gray-200 flex flex-col p-4 fixed h-full">
        <div className="flex items-center gap-2 mb-8">
          <Image src="/dmc-logo.png" alt="DMC" width={36} height={36} />
          <span className="font-semibold text-sm">DMC Export</span>
        </div>
        <p className="text-xs text-gray-400 uppercase mb-2">Order Management</p>
        <nav className="flex flex-col gap-1">
          {navItems.map(([label, href]) => {
            const active = pathname === href || (href !== '/order-management' && pathname.startsWith(href))
            return (
              <Link
                key={href}
                href={href}
                className={`text-left text-sm px-3 py-2 rounded ${active ? 'font-semibold text-black bg-gray-50' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                • {label}
              </Link>
            )
          })}
        </nav>
        <div className="mt-auto">
          <p className="text-xs text-gray-400 uppercase mb-2">Admin</p>
          <Link
            href="/admin/dashboard"
            className="block text-left text-sm px-3 py-2 rounded text-gray-600 hover:bg-gray-100"
          >
            • Admin Dashboard
          </Link>
        </div>
      </div>

      {/* Main Content */}
      <div className="ml-56 flex-1 p-8">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">{title}</h1>
          <p className="text-sm text-gray-500">{description}</p>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Card({ title, action, children }) {
  return (
    <section className="bg-white rounded-lg border border-gray-200 p-5">
      {(title || action) && (
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-semibold text-gray-900">{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

export function StatCard({ label, value }) {
  return (
    <div className="bg-white rounded-lg p-5 border border-gray-200">
      <p className="text-3xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-500 mt-1">{label}</p>
    </div>
  )
}

// Monochrome badges matching the customer module: the "highlight" state is
// black-filled, everything else is gray. Tone names kept for compatibility.
export function Badge({ children, tone = 'gray' }) {
  const tones = {
    green: 'bg-black text-white',
    black: 'bg-black text-white',
    yellow: 'bg-gray-200 text-gray-700',
    red: 'bg-gray-200 text-gray-700',
    gray: 'bg-gray-200 text-gray-700',
  }
  return <span className={`inline-flex px-2 py-1 rounded text-xs font-medium ${tones[tone] || tones.gray}`}>{children}</span>
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
    <div className="py-6 text-center">
      <p className="text-sm text-gray-400">{title}</p>
      <p className="text-xs text-gray-400 mt-1">{description}</p>
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
