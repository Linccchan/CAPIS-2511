'use client';
// src/components/nav/Sidebar.tsx
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Role } from '@/types/database';

interface NavItem { label: string; href: string; section?: string; }

const NAV: Record<Role, { sections: { title?: string; items: NavItem[] }[] }> = {
  supplier: {
    sections: [
      { title: 'My Portal', items: [
        { label: 'Dashboard',        href: '/supplier/dashboard' },
        { label: 'Purchase Orders',  href: '/supplier/purchase-orders' },
        { label: 'Delivery History', href: '/supplier/delivery-history' },
      ]},
    ],
  },
  warehouse: {
    sections: [
      { title: 'Operations', items: [
        { label: 'Dashboard',        href: '/warehouse/dashboard' },
        { label: 'Log Delivery',     href: '/warehouse/log-delivery' },
        { label: 'Stock & Locations',href: '/warehouse/stock' },
        { label: 'Staging Tracker',  href: '/warehouse/staging' },
      ]},
    ],
  },
  admin: {
    sections: [
      { title: 'Operations', items: [
        { label: 'Purchase Orders',  href: '/admin/purchase-orders' },
        { label: 'Suppliers',        href: '/admin/suppliers' },
      ]},
      { title: 'Warehouse', items: [
        { label: 'Compliance',       href: '/admin/compliance' },
        { label: 'Manage Locations', href: '/admin/locations' },
      ]},
      { title: 'Catalog', items: [
        { label: 'Supplier Costs',   href: '/admin/supplier-costs' },
      ]},
    ],
  },
  customer:   { sections: [] },
  management: { sections: [] },
};

export default function Sidebar({ role, userName }: { role: Role; userName: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/auth/login');
    router.refresh();
  }

  const portal = NAV[role];

  return (
    <aside style={{ width: 220, background: 'var(--surface)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
      {/* Logo */}
      <div style={{ padding: '16px 12px 12px', borderBottom: '1px solid var(--border)', marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '-0.3px', color: 'var(--text-primary)' }}>
          ECS
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {role === 'supplier' ? 'Supplier Portal' : role === 'warehouse' ? 'Warehouse Portal' : 'Admin Portal'}
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '0 8px', overflowY: 'auto' }}>
        {portal.sections.map((section, si) => (
          <div key={si} style={{ marginBottom: 16 }}>
            {section.title && (
              <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-tertiary)', padding: '4px 8px', marginBottom: 4 }}>
                {section.title}
              </div>
            )}
            {section.items.map(item => {
              const active = pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <Link key={item.href} href={item.href}
                  className={`sidebar-item${active ? ' active' : ''}`}>
                  <span className={`sidebar-dot${active ? ' active' : ''}`} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* User */}
      <div style={{ padding: '12px 8px', borderTop: '1px solid var(--border)' }}>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', padding: '4px 8px' }}>{userName}</div>
        <button onClick={handleLogout} className="sidebar-item" style={{ width: '100%' }}>
          <span className="sidebar-dot" />Sign out
        </button>
      </div>
    </aside>
  );
}
