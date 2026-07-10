import Sidebar from '@/components/nav/Sidebar'

export default function SupplierLayout({ children }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f3f4f6' }}>
      <Sidebar role="supplier" userName="Supplier" />
      <main style={{ flex: 1, overflowY: 'auto', padding: '32px' }}>{children}</main>
    </div>
  )
}
