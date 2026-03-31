import { useState, useEffect } from 'react'
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/context/AuthContext'
import ErrorBanner from '@/components/ErrorBanner'

function fmtDate(ts) {
  if (!ts) return '-'
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return d.toLocaleDateString('en-CA')
}

export default function Archive() {
  const { user } = useAuth()
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchArchived()
  }, [])

  async function fetchArchived() {
    setLoading(true)
    setError(null)
    try {
      const q = query(
        collection(db, 'invoices'),
        where('shopId', '==', user.uid),
        where('status', '==', 'archived'),
        orderBy('receivedAt', 'desc')
      )
      const snap = await getDocs(q)
      setInvoices(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <ErrorBanner message={error} onClose={() => setError(null)} />

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-700">Archived Invoices</h2>
        <span className="text-xs text-gray-400">Auto-deleted 7 days after receiving</span>
      </div>

      {loading ? (
        <div className="text-center py-10 text-gray-400">Loading...</div>
      ) : invoices.length === 0 ? (
        <div className="text-center py-10 text-gray-400">No archived invoices.</div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-[#E4E2DC] overflow-hidden">
          <div className="grid grid-cols-2 px-4 py-2 bg-gray-50 border-b border-[#E4E2DC] text-xs font-bold text-gray-400 uppercase tracking-wide">
            <span>Invoice #</span>
            <span className="text-right">Received</span>
          </div>
          {invoices.map(inv => (
            <div key={inv.id} className="grid grid-cols-2 px-4 py-3 border-b border-[#F0EFEB] last:border-0">
              <span className="font-mono font-bold text-gray-900">{inv.invoiceNo}</span>
              <span className="text-right text-sm text-gray-500">{fmtDate(inv.receivedAt)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
