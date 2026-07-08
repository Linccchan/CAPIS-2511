'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

export default function CustomerDocuments() {
  const router = useRouter()
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }

      const { data: customerData } = await supabase
        .from('customers')
        .select('id')
        .eq('profile_id', user.id)
        .single()

      if (customerData) {
        const { data: documentsData } = await supabase
          .from('documents')
          .select('*, customer_orders!inner(order_number, customer_id)')
          .eq('customer_orders.customer_id', customerData.id)
          .order('uploaded_at', { ascending: false })

        setDocuments(documentsData || [])
      }

      setLoading(false)
    }

    fetchData()
  }, [])

  const formatType = (type) =>
    type?.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()) || 'Document'

  const formatStatus = (status) =>
    status?.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()) || 'Unknown'

  const getStatusStyle = (status) =>
    status === 'final' ? 'bg-black text-white' : 'bg-gray-200 text-gray-700'

  const formatDate = (d) =>
    d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'

  const filteredDocuments = documents.filter((doc) => {
    const q = search.toLowerCase()
    return (
      doc.file_name?.toLowerCase().includes(q) ||
      doc.document_type?.toLowerCase().includes(q) ||
      doc.customer_orders?.order_number?.toLowerCase().includes(q)
    )
  })

  const groupedByOrder = filteredDocuments.reduce((acc, doc) => {
    const orderNumber = doc.customer_orders?.order_number || 'Other'
    if (!acc[orderNumber]) acc[orderNumber] = []
    acc[orderNumber].push(doc)
    return acc
  }, {})

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500">Loading...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-100 flex">

      {/* Sidebar */}
      <div className="w-56 bg-white border-r border-gray-200 flex flex-col p-4 fixed h-full">
        <div className="flex items-center gap-2 mb-8">
          <Image src="/dmc-logo.png" alt="DMC" width={36} height={36} />
          <span className="font-semibold text-sm">DMC Export</span>
        </div>
        <p className="text-xs text-gray-400 uppercase mb-2">My Account</p>
        <nav className="flex flex-col gap-1">
          {[
            { label: 'Dashboard', path: '/customer/dashboard' },
            { label: 'My Orders', path: '/customer/orders' },
            { label: 'Product Catalog', path: '/customer/catalog' },
            { label: 'Request Quotation', path: '/customer/quotation/new' },
            { label: 'Documents', path: '/customer/documents' },
            { label: 'Profile & Settings', path: '/customer/profile' },
          ].map((item) => (
            <button
              key={item.label}
              onClick={() => router.push(item.path)}
              className={`text-left text-sm px-3 py-2 rounded ${item.label === 'Documents' ? 'font-semibold text-black bg-gray-50' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              • {item.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Main Content */}
      <div className="ml-56 flex-1 p-8">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">Documents</h1>
          <p className="text-sm text-gray-500">Export paperwork for your orders — pro forma invoices, packing lists, and certificates.</p>
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder="Search by file name, document type, or order number..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm text-black bg-white mb-6 focus:outline-none focus:ring-2 focus:ring-gray-400"
        />

        {/* Document groups */}
        {Object.keys(groupedByOrder).length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-400">
            {documents.length === 0
              ? 'No documents yet. Documents appear here once DMC prepares your export paperwork.'
              : 'No documents match your search'}
          </div>
        ) : (
          Object.entries(groupedByOrder).map(([orderNumber, docs]) => (
            <div key={orderNumber} className="mb-6">
              <h2 className="text-xs font-semibold text-gray-400 uppercase mb-3">{orderNumber}</h2>
              <div className="bg-white rounded-lg border border-gray-200 p-5">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-400 uppercase border-b border-gray-100">
                      <th className="pb-2">Document Type</th>
                      <th className="pb-2">File Name</th>
                      <th className="pb-2">Uploaded</th>
                      <th className="pb-2">Status</th>
                      <th className="pb-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {docs.map((doc) => (
                      <tr key={doc.id} className="border-b border-gray-50">
                        <td className="py-3 font-medium">{formatType(doc.document_type)}</td>
                        <td className="py-3 text-gray-600">{doc.file_name}</td>
                        <td className="py-3 text-gray-600">{formatDate(doc.uploaded_at)}</td>
                        <td className="py-3">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusStyle(doc.status)}`}>
                            {formatStatus(doc.status)}
                          </span>
                        </td>
                        <td className="py-3 text-right">
                          <button className="text-sm border border-gray-300 px-3 py-1 rounded hover:bg-gray-50">
                            Download
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}

      </div>
    </div>
  )
}
