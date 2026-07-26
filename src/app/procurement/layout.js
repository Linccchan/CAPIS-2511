import Sidebar from '@/components/nav/Sidebar'

export default function ProcurementLayout({ children }) {
  return (
    <div className="min-h-screen bg-gray-100 flex">
      <Sidebar role="procurement" userName="Procurement" />
      <main className="ml-56 flex-1 p-8">{children}</main>
    </div>
  )
}
