'use client'

import { ToastProvider } from '@/components/order-management/ui'

export default function OrderManagementLayout({ children }) {
  return <ToastProvider>{children}</ToastProvider>
}
