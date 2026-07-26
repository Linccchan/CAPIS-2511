'use client'

import Sidebar from '@/components/nav/Sidebar'
import { ToastProvider } from '@/components/order-management/ui'

export default function OrderManagementLayout({ children }) {
  return (
    <ToastProvider>
      <div className="min-h-screen bg-gray-100 flex">
        <Sidebar role="admin" userName="Admin" />

        <main className="ml-56 flex-1 p-8">
          {children}
        </main>
      </div>
    </ToastProvider>
  )
}