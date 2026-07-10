import Sidebar from '@/components/nav/Sidebar'

export default function AdminLayout({ children }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f3f4f6' }}>
      <Sidebar role="admin" userName="Admin" />
      <main style={{ flex: 1, overflowY: 'auto', padding: '32px' }}>{children}</main>
    </div>
  )
}
