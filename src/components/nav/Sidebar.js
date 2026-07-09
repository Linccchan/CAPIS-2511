'use client';
// src/components/nav/Sidebar.js
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
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
};
export default function Sidebar({ role, userName }) {
    const pathname = usePathname();
    const router = useRouter();
    const supabase = createClient();
    async function handleLogout() {
        await supabase.auth.signOut();
        router.push('/');
        router.refresh();
    }
    const portal = NAV[role];
    return (<aside style={{ width: 256, background: '#fff', borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
      {/* Logo */}
      <div style={{ padding: '20px 24px', borderBottom: '1px solid #e5e7eb', marginBottom: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Image src="/dmc-logo.png" alt="DMC Enterprise Logo" width={42} height={42}/>
          <div>
            <div style={{ fontSize: 18, fontWeight: 600, lineHeight: 1.1, color: '#111827' }}>
              CAPIS
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
              {role === 'supplier' ? 'Supplier Portal' : role === 'warehouse' ? 'Warehouse Portal' : 'Admin Console'}
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: 16, overflowY: 'auto' }}>
        {portal.sections.map((section, si) => (<div key={si} style={{ marginBottom: 16 }}>
            {section.title && (<div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-tertiary)', padding: '4px 8px', marginBottom: 4 }}>
                {section.title}
              </div>)}
            {section.items.map(item => {
                const active = pathname === item.href || pathname.startsWith(item.href + '/');
                return (<Link key={item.href} href={item.href} className={`sidebar-item${active ? ' active' : ''}`}>
                  <span className={`sidebar-dot${active ? ' active' : ''}`}/>
                  {item.label}
                </Link>);
            })}
          </div>))}
      </nav>

      {/* User */}
      <div style={{ margin: 16, padding: 16, border: '1px solid #e5e7eb', borderRadius: 8, background: '#f9fafb' }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Signed in</div>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', padding: '4px 8px' }}>{userName}</div>
        <button onClick={handleLogout} className="sidebar-item" style={{ width: '100%' }}>
          <span className="sidebar-dot"/>Sign out
        </button>
      </div>
    </aside>);
}
