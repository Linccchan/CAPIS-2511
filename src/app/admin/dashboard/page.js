import Image from 'next/image'
import Link from 'next/link'

const metrics = [
  { label: 'Active Orders', value: '128', change: '+12 this week' },
  { label: 'Pending Approvals', value: '18', change: '6 require review' },
  { label: 'Purchase Orders', value: '42', change: '9 due today' },
  { label: 'Ready Orders', value: '24', change: '+4 from yesterday' },
]

const modules = [
  {
    title: 'Order Management',
    description: 'Track customer orders, purchase orders, and supplier delivery readiness.',
    href: '/order-management',
    action: 'Open module',
  },
]

const activity = [
  { id: 'CO-1048', customer: 'Maritime Foods Co.', owner: 'Order Management', status: 'Awaiting Supplier', tone: 'amber' },
  { id: 'PO-2216', customer: 'Pacific Packaging', owner: 'Order Management', status: 'Partially Delivered', tone: 'gray' },
  { id: 'SH-0912', customer: 'Northline Export', owner: 'Order Management', status: 'Ready', tone: 'green' },
  { id: 'CO-1045', customer: 'Davao Specialty Goods', owner: 'Admin Review', status: 'Needs Approval', tone: 'black' },
]

const approvals = [
  { label: 'Customer account changes', value: 5 },
  { label: 'Purchase order edits', value: 8 },
  { label: 'Shipment date requests', value: 3 },
]

function StatusBadge({ children, tone = 'gray' }) {
  const tones = {
    amber: 'border-yellow-200 bg-yellow-50 text-yellow-800',
    green: 'border-green-200 bg-green-50 text-green-700',
    black: 'border-gray-900 bg-gray-900 text-white',
    gray: 'border-gray-200 bg-gray-50 text-gray-700',
  }

  return (
    <span className={`inline-flex rounded border px-2 py-1 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  )
}

export default function AdminDashboard() {
  return (
    <main className="min-h-screen bg-gray-100 text-gray-900">
      <div className="flex min-h-screen">
        <aside className="hidden w-64 border-r border-gray-200 bg-white lg:block">
          <div className="border-b border-gray-200 px-6 py-5">
            <div className="flex items-center gap-3">
              <Image src="/dmc-logo.png" alt="DMC Enterprise Logo" width={42} height={42} />
              <div>
                <div className="text-lg font-semibold leading-tight">CAPIS</div>
                <div className="text-xs text-gray-500">Admin Console</div>
              </div>
            </div>
          </div>

          <nav className="space-y-1 p-4">
            {['Dashboard', 'Users', 'Approvals', 'Reports', 'Settings'].map((item) => (
              <Link
                key={item}
                href={item === 'Dashboard' ? '/admin/dashboard' : '#'}
                className={`block rounded px-3 py-2 text-sm font-medium ${
                  item === 'Dashboard' ? 'bg-black text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                {item}
              </Link>
            ))}
          </nav>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          <header className="border-b border-gray-200 bg-white px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-gray-500">Export Consolidation System</p>
                <h1 className="mt-1 text-xl font-semibold text-gray-900">Admin Dashboard</h1>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href="/order-management"
                  className="rounded border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  View Orders
                </Link>
                <Link
                  href="#"
                  className="rounded bg-black px-3 py-2 text-sm font-medium text-white hover:bg-gray-800"
                >
                  New Report
                </Link>
              </div>
            </div>
          </header>

          <div className="flex-1 space-y-6 p-4 sm:p-6 lg:p-8">
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {metrics.map((metric) => (
                <div key={metric.label} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="text-xs font-semibold uppercase text-gray-500">{metric.label}</div>
                  <div className="mt-3 text-3xl font-semibold text-gray-900">{metric.value}</div>
                  <div className="mt-2 text-sm text-gray-500">{metric.change}</div>
                </div>
              ))}
            </section>

            <section className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
              <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
                <div className="flex items-center justify-between gap-4 border-b border-gray-200 px-5 py-4">
                  <div>
                    <h2 className="text-sm font-semibold text-gray-900">Operational Modules</h2>
                    <p className="mt-1 text-sm text-gray-500">Quick access to the main work areas.</p>
                  </div>
                </div>
                <div className="divide-y divide-gray-100">
                  {modules.map((module) => (
                    <div key={module.title} className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900">{module.title}</h3>
                        <p className="mt-1 max-w-2xl text-sm text-gray-500">{module.description}</p>
                      </div>
                      <Link href={module.href} className="text-sm font-medium text-gray-900 hover:underline">
                        {module.action}
                      </Link>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
                <div className="border-b border-gray-200 px-5 py-4">
                  <h2 className="text-sm font-semibold text-gray-900">Approval Queue</h2>
                  <p className="mt-1 text-sm text-gray-500">Items waiting on administrator action.</p>
                </div>
                <div className="space-y-3 p-5">
                  {approvals.map((item) => (
                    <div key={item.label} className="flex items-center justify-between rounded border border-gray-200 px-4 py-3">
                      <span className="text-sm text-gray-600">{item.label}</span>
                      <span className="text-sm font-semibold text-gray-900">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="rounded-lg border border-gray-200 bg-white shadow-sm">
              <div className="flex items-center justify-between gap-4 border-b border-gray-200 px-5 py-4">
                <h2 className="text-sm font-semibold text-gray-900">Recent Activity</h2>
                <Link href="/order-management" className="text-sm font-medium text-gray-900 hover:underline">
                  See all
                </Link>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-gray-200 text-xs uppercase text-gray-500">
                    <tr>
                      <th className="px-5 py-3">Reference</th>
                      <th className="px-5 py-3">Customer</th>
                      <th className="px-5 py-3">Owner</th>
                      <th className="px-5 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {activity.map((item) => (
                      <tr key={item.id}>
                        <td className="px-5 py-4 font-medium text-gray-900">{item.id}</td>
                        <td className="px-5 py-4 text-gray-600">{item.customer}</td>
                        <td className="px-5 py-4 text-gray-600">{item.owner}</td>
                        <td className="px-5 py-4">
                          <StatusBadge tone={item.tone}>{item.status}</StatusBadge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  )
}
