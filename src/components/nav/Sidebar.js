'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

const NAV = {
  supplier: {
    sections: [
      { title: 'My Portal', items: [
        { label: 'Dashboard', href: '/supplier/dashboard' },
        { label: 'Purchase Orders', href: '/supplier/purchase-orders' },
        { label: 'Delivery History', href: '/supplier/delivery-history' },
      ] },
    ],
  },
  warehouse: {
    sections: [
      { title: 'Operations', items: [
        { label: 'Dashboard', href: '/warehouse/dashboard' },
        { label: 'Log Delivery', href: '/warehouse/log-delivery' },
        { label: 'Stock & Locations', href: '/warehouse/stock' },
        { label: 'Staging Tracker', href: '/warehouse/staging' },
      ] },
    ],
  },
  admin: {
    sections: [
      { title: 'Dashboard', items: [
        { label: 'Overview', href: '/admin/dashboard' },
        { label: 'Order Management', href: '/order-management' },
      ] },
      { title: 'Operations', items: [
        { label: 'PFI Builder', href: '/order-management/customer-orders' },
        { label: 'Billing & Payments', href: '/order-management/billing' },
        { label: 'Purchase Orders', href: '/admin/purchase-orders' },
        { label: 'Suppliers', href: '/admin/suppliers' },
      ] },
      { title: 'Warehouse', items: [
        { label: 'Compliance', href: '/admin/compliance' },
        { label: 'Manage Locations', href: '/admin/locations' },
      ] },
      { title: 'Catalog', items: [
        { label: 'Supplier Costs', href: '/admin/supplier-costs' },
      ] },
    ],
  },
  customer: { sections: [] },
  management: {
    sections: [
      { title: 'Dashboard', items: [
        { label: 'Overview', href: '/admin/dashboard' },
        { label: 'Order Management', href: '/order-management' },
      ] },
      { title: 'Operations', items: [
        { label: 'PFI Builder', href: '/order-management/customer-orders' },
        { label: 'Billing & Payments', href: '/order-management/billing' },
        { label: 'Purchase Orders', href: '/admin/purchase-orders' },
        { label: 'Suppliers', href: '/admin/suppliers' },
      ] },
      { title: 'Warehouse', items: [
        { label: 'Compliance', href: '/admin/compliance' },
        { label: 'Manage Locations', href: '/admin/locations' },
      ] },
      { title: 'Catalog', items: [
        { label: 'Supplier Costs', href: '/admin/supplier-costs' },
      ] },
    ],
  },
}

// Shared staff sidebar, styled to match the customer module shell
// (w-56 fixed white sidebar, • bullet items, gray-50 active state).
export default function Sidebar({ role, userName }) {
  const pathname = usePathname()
  const router = useRouter()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const portal = NAV[role] || { sections: [] }

  return (
    <div className="w-56 bg-white border-r border-gray-200 flex flex-col p-4 fixed h-full">
      <div className="flex items-center gap-2 mb-8">
        <Image src="/dmc-logo.png" alt="DMC" width={36} height={36} />
        <span className="font-semibold text-sm">DMC Export</span>
      </div>

      {portal.sections.map((section, si) => (
        <div key={si} className="mb-4">
          {section.title && (
            <p className="text-xs text-gray-400 uppercase mb-2">{section.title}</p>
          )}
          <nav className="flex flex-col gap-1">
            {section.items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + '/')
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`text-left text-sm px-3 py-2 rounded ${active ? 'font-semibold text-black bg-gray-50' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                  • {item.label}
                </Link>
              )
            })}
          </nav>
        </div>
      ))}

      <div className="mt-auto">
        {userName && (
          <p className="text-xs text-gray-400 uppercase mb-2">Signed in — {userName}</p>
        )}
        <button
          onClick={handleLogout}
          className="w-full text-left text-sm px-3 py-2 rounded text-gray-600 hover:bg-gray-100"
        >
          • Sign out
        </button>
      </div>
    </div>
  )
}
