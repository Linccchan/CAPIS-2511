'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

const NAV = {
  supplier: {
    sections: [
      {
        title: 'My Portal',
        items: [
          { label: 'Dashboard', href: '/supplier/dashboard' },
          { label: 'Purchase Orders', href: '/supplier/purchase-orders' },
          { label: 'Delivery History', href: '/supplier/delivery-history' },
        ],
      },
    ],
  },

  warehouse: {
    sections: [
      {
        title: 'Operations',
        items: [
          { label: 'Dashboard', href: '/warehouse/dashboard' },
          { label: 'Log Delivery', href: '/warehouse/log-delivery' },
          { label: 'Staging Tracker', href: '/warehouse/staging' },
        ],
      },
      {
        title: 'Management',
        items: [
          { label: 'Warehouse Locations', href: '/warehouse/warehouse-locations' },
          { label: 'Stock', href: '/warehouse/stock' },
        ],
      },
      {
        title: 'Reports',
        items: [
          { label: 'Suppliers Performance', href: '/warehouse/suppliers-performance' },
        ],
      },
    ],
  },

  // Sales handles customer-facing order processing: quotations, the pro forma
  // invoice, and payment verification.
  sales: {
    sections: [
      {
        title: 'Sales',
        items: [
          { label: 'Customer Orders', href: '/order-management/customer-orders' },
          { label: 'Billing & Payments', href: '/order-management/billing' },
        ],
      },
      {
        title: 'Monitoring',
        items: [
          { label: 'Order Management', href: '/order-management' },
          { label: 'Supplier Deliveries', href: '/order-management/supplier-deliveries' },
        ],
      },
    ],
  },

  procurement: {
    sections: [
      {
        title: 'Operations',
        items: [
          { label: 'Dashboard', href: '/procurement/dashboard' },
          { label: 'Purchase Orders', href: '/procurement/purchase-orders' },
          { label: 'Suppliers', href: '/procurement/suppliers' },
        ],
      },
      {
        title: 'Monitoring',
        items: [
          { label: 'Suppliers Performance', href: '/procurement/suppliers-performance' },
          { label: 'Consolidation', href: '/procurement/consolidation' },
        ],
      },
      {
        title: 'Reference',
        items: [
          { label: 'Customer Orders', href: '/procurement/customer-orders' },
          { label: 'Warehouse Delivery', href: '/procurement/warehouse-delivery' },
        ],
      },
    ],
  },

  admin: {
    sections: [
      {
        title: 'Dashboard',
        items: [
          { label: 'Overview', href: '/admin/dashboard' },

          {
            label: 'Order Management',
            href: '/order-management',
            children: [
              //{ label: 'Dashboard', href: '/order-management' },
              { label: 'Customer Orders', href: '/order-management/customer-orders' },
              { label: 'Purchase Orders', href: '/order-management/purchase-orders' },
              { label: 'Supplier Deliveries', href: '/order-management/supplier-deliveries' },
              { label: 'Billing & Payments', href: '/order-management/billing' },
            ],
          },
        ],
      },

      {
        title: 'Suppliers',
        items: [
          //{ label: 'PFI Builder', href: '/order-management/customer-orders' },
          //{ label: 'Purchase Orders', href: '/admin/purchase-orders' },
          { label: 'Suppliers', href: '/admin/suppliers' },
          { label: 'Suppliers Performance', href: '/admin/suppliers-performance' },
        ],
      },

      {
        title: 'Warehouse',
        items: [
          { label: 'Compliance', href: '/admin/compliance' },
          { label: 'Manage Locations', href: '/admin/locations' },
        ],
      },

      {
        title: 'Miscellaneous',
        items: [
          { label: 'Products', href: '/admin/products' },
          { label: 'Customers', href: '/admin/customers' },
        ],
      },
    ],
  },

  customer: {
    sections: [],
  },

  management: {
    sections: [
      {
        title: 'Analytics',
        items: [
          { label: 'Executive Dashboard', href: '/management/analytics' },
          { label: 'Import History', href: '/management/analytics/import' },
        ],
      },
      {
        title: 'Dashboard',
        items: [
          { label: 'Overview', href: '/admin/dashboard' },

          {
            label: 'Order Management',
            href: '/order-management',
            children: [
              //{ label: 'Dashboard', href: '/order-management' },
              { label: 'Customer Orders', href: '/order-management/customer-orders' },
              { label: 'Purchase Orders', href: '/order-management/purchase-orders' },
              { label: 'Supplier Deliveries', href: '/order-management/supplier-deliveries' },
              { label: 'Billing & Payments', href: '/order-management/billing' },
            ],
          },
        ],
      },

      {
        title: 'Suppliers',
        items: [
          //{ label: 'PFI Builder', href: '/order-management/customer-orders' },
          //{ label: 'Purchase Orders', href: '/admin/purchase-orders' },
          { label: 'Suppliers', href: '/admin/suppliers' },
          { label: 'Suppliers Performance', href: '/admin/suppliers-performance' },
        ],
      },

      {
        title: 'Warehouse',
        items: [
          { label: 'Compliance', href: '/admin/compliance' },
          { label: 'Manage Locations', href: '/admin/locations' },
        ],
      },

      {
        title: 'Miscellaneous',
        items: [
          { label: 'Products', href: '/admin/products' },
          { label: 'Customers', href: '/admin/customers' },
        ],
      },
    ],
  },
}

export default function Sidebar({ role, userName }) {
  const pathname = usePathname()
  const router = useRouter()

  const [openMenus, setOpenMenus] = useState({
    orderManagement: true,
  })

  // The menu must follow WHO is signed in, not which folder the page lives in.
  // Otherwise a management user opening an /admin page gets the admin menu and
  // loses the way back to their own screens. The prop is only a fallback.
  const [account, setAccount] = useState(null)

  useEffect(() => {
    let active = true
    const loadAccount = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, full_name')
        .eq('id', user.id)
        .maybeSingle()
      if (active && profile) setAccount(profile)
    }
    loadAccount()
    return () => { active = false }
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const portal = NAV[account?.role || role] || { sections: [] }
  const displayName = account?.full_name || userName

  return (
    <div className="w-56 bg-white border-r border-gray-200 flex flex-col p-4 fixed h-full">
      <div className="flex items-center gap-2 mb-8">
        <Image src="/dmc-logo.png" alt="DMC" width={36} height={36} />
        <span className="font-semibold text-sm">DMC Export</span>
      </div>

      {portal.sections.map((section) => (
        <div key={section.title} className="mb-4">
          {section.title && (
            <p className="text-xs text-gray-400 uppercase mb-2">
              {section.title}
            </p>
          )}

          <nav className="flex flex-col gap-1">
            {section.items.map((item) => {
              if (item.children) {
                const open = openMenus.orderManagement
                const active = pathname.startsWith(item.href)

                return (
                  <div key={item.label}>
                    <button
                      onClick={() =>
                        setOpenMenus((prev) => ({
                          ...prev,
                          orderManagement: !prev.orderManagement,
                        }))
                      }
                      className={`w-full flex items-center justify-between rounded px-3 py-2 text-sm ${
                        active
                          ? 'bg-gray-50 font-semibold text-black'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      <span>• {item.label}</span>
                      <span>{open ? '⏶' : '⏷'}</span>
                    </button>

                    {open && (
                      <div className="ml-5 mt-1 flex flex-col gap-1">
                        {item.children.map((child) => {
                          const childActive =
                            pathname === child.href ||
                            pathname.startsWith(child.href + '/')

                          return (
                            <Link
                              key={child.href}
                              href={child.href}
                              className={`rounded px-3 py-2 text-sm ${
                                childActive
                                  ? 'bg-gray-50 font-semibold text-black'
                                  : 'text-gray-600 hover:bg-gray-100'
                              }`}
                            >
                              • {child.label}
                            </Link>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              }

              const active =
                pathname === item.href ||
                pathname.startsWith(item.href + '/')

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded px-3 py-2 text-sm ${
                    active
                      ? 'bg-gray-50 font-semibold text-black'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  • {item.label}
                </Link>
              )
            })}
          </nav>
        </div>
      ))}

      <div className="mt-auto">
        {displayName && (
          <p className="mb-2 text-xs uppercase text-gray-400">
            Signed in — {displayName}
          </p>
        )}

        <button
          onClick={handleLogout}
          className="w-full rounded px-3 py-2 text-left text-sm text-gray-600 hover:bg-gray-100"
        >
          • Sign out
        </button>
      </div>
    </div>
  )
}