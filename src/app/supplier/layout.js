import Sidebar from '@/components/nav/Sidebar'

export default function SupplierLayout({ children }) {
  return (
    <div className="min-h-screen bg-gray-100 flex">
      <Sidebar role="supplier" userName="Supplier" />
      <main className="ml-56 flex-1 p-8">{children}</main>
    </div>
  )
}
