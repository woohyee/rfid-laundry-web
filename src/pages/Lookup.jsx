import { useState, useEffect } from 'react'
import {
  collection, query, where, getDocs,
  doc, deleteDoc, updateDoc, writeBatch
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/context/AuthContext'
import ErrorBanner from '@/components/ErrorBanner'

function StatusBadge({ status }) {
  const styles = {
    pending: 'bg-yellow-100 text-yellow-800',
    received: 'bg-green-100 text-green-800',
    missing: 'bg-red-100 text-red-800',
  }
  return (
    <span className={`px-2 py-1 rounded text-sm font-bold ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
      {status}
    </span>
  )
}

function fmtDate(ts) {
  if (!ts) return '-'
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return d.toLocaleDateString('en-CA')
}

function isInRange(ts, from, to) {
  if (!ts) return false
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  const dateStr = d.toLocaleDateString('en-CA')
  if (from && dateStr < from) return false
  if (to && dateStr > to) return false
  return true
}

export default function Lookup() {
  const { user } = useAuth()
  const [invoices, setInvoices] = useState([])
  const [statusFilter, setStatusFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [statsFrom, setStatsFrom] = useState('')
  const [statsTo, setStatsTo] = useState('')
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [error, setError] = useState(null)
  const [viewInvoice, setViewInvoice] = useState(null)
  const [editInvoice, setEditInvoice] = useState(null)
  const [editValue, setEditValue] = useState('')

  useEffect(() => {
    fetchInvoices()
  }, [statusFilter, dateFrom, dateTo])

  async function fetchInvoices() {
    setLoading(true)
    setError(null)
    try {
      let q = query(
        collection(db, 'invoices'),
        where('shopId', '==', user.uid)
      )
      const snapshot = await getDocs(q)
      let data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }))

      // 최신순 정렬
      data.sort((a, b) => {
        const aTime = a.createdAt?.toDate?.() ?? new Date(0)
        const bTime = b.createdAt?.toDate?.() ?? new Date(0)
        return bTime - aTime
      })

      // 상태 필터
      if (statusFilter !== 'all') {
        data = data.filter(inv => inv.status === statusFilter)
      }

      // 날짜 구간 필터
      if (dateFrom || dateTo) {
        data = data.filter(inv => isInRange(inv.createdAt, dateFrom, dateTo))
      }

      // pending을 상단에 고정
      const pending = data.filter(inv => inv.status === 'pending')
      const others = data.filter(inv => inv.status !== 'pending')
      setInvoices([...pending, ...others])
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }

  async function deleteInvoice(id, invoiceNo) {
    if (!window.confirm(`Delete invoice #${invoiceNo}?`)) return
    try {
      await deleteDoc(doc(db, 'invoices', id))
      fetchInvoices()
    } catch (e) {
      setError(e.message)
    }
  }

  // 일괄 삭제 — received만, pending 제외
  async function handleBulkDelete() {
    const toDelete = invoices.filter(inv => inv.status === 'received')
    const skipped = invoices.filter(inv => inv.status === 'pending')

    if (toDelete.length === 0) {
      setError('No received invoices to delete in the selected range.')
      return
    }

    const rangeLabel = (dateFrom || dateTo)
      ? `${dateFrom || '…'} ~ ${dateTo || '…'}`
      : 'all dates'

    const msg = [
      `Delete ${toDelete.length} received invoice(s) [${rangeLabel}]?`,
      skipped.length > 0 ? `⚠️ ${skipped.length} pending invoice(s) will be skipped.` : '',
      '\nThis cannot be undone.',
    ].filter(Boolean).join('\n')

    if (!window.confirm(msg)) return

    setBulkDeleting(true)
    try {
      // Firestore writeBatch — 최대 500개씩
      const chunks = []
      for (let i = 0; i < toDelete.length; i += 500) {
        chunks.push(toDelete.slice(i, i + 500))
      }
      for (const chunk of chunks) {
        const batch = writeBatch(db)
        chunk.forEach(inv => batch.delete(doc(db, 'invoices', inv.id)))
        await batch.commit()
      }
      fetchInvoices()
    } catch (e) {
      setError('Bulk delete failed: ' + e.message)
    }
    setBulkDeleting(false)
  }

  async function saveEditInvoice() {
    const newNo = editValue.trim()
    if (!newNo) return
    try {
      await updateDoc(doc(db, 'invoices', editInvoice.id), { invoiceNo: newNo })
      setEditInvoice(null)
      setEditValue('')
      fetchInvoices()
    } catch (e) {
      setError(e.message)
    }
  }

  function calcStats() {
    if (!statsFrom || !statsTo) {
      setError('Please select both from and to dates.')
      return
    }
    const from = new Date(statsFrom)
    const to = new Date(statsTo)
    to.setHours(23, 59, 59)

    const filtered = invoices.filter(inv => {
      if (!inv.createdAt) return false
      const d = inv.createdAt.toDate ? inv.createdAt.toDate() : new Date(inv.createdAt)
      return d >= from && d <= to
    })

    setStats({
      invoiceCount: filtered.length,
      dcCount: filtered.reduce((s, i) => s + (i.dcCount || 0), 0),
      shirtCount: filtered.reduce((s, i) => s + (i.shirtCount || 0), 0),
      receivedCount: filtered.filter(i => i.status === 'received').length,
      pendingCount: filtered.filter(i => i.status === 'pending').length,
    })
  }

  const pendingInvoices = invoices.filter(inv => inv.status === 'pending')
  const receivedInRange = invoices.filter(inv => inv.status === 'received')
  const hasDateFilter = dateFrom || dateTo

  return (
    <div className="space-y-6">

      <ErrorBanner message={error} onClose={() => setError(null)} />

      {/* 전체 목록 */}
      <div className="bg-white rounded-xl shadow-md p-5">
        <h2 className="text-lg font-bold text-gray-800 mb-4">All Invoices</h2>

        {/* 필터 */}
        <div className="space-y-3 mb-4">
          {/* 상태 필터 */}
          <div className="flex gap-1">
            {['all', 'pending', 'received'].map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-4 py-1.5 rounded-lg font-semibold text-sm capitalize ${statusFilter === s ? 'bg-[#18181B] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>

          {/* 날짜 구간 필터 */}
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label className="block text-xs text-gray-500 mb-1">From</label>
              <input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="border border-gray-300 rounded px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">To</label>
              <input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="border border-gray-300 rounded px-3 py-1.5 text-sm"
              />
            </div>
            {hasDateFilter && (
              <button
                onClick={() => { setDateFrom(''); setDateTo('') }}
                className="text-sm text-gray-500 hover:text-gray-700 pb-1"
              >
                Clear
              </button>
            )}
          </div>

          {/* 일괄 삭제 버튼 */}
          {receivedInRange.length > 0 && (
            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={handleBulkDelete}
                disabled={bulkDeleting}
                className="flex items-center gap-2 text-sm font-bold text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 border border-red-300 px-4 py-2 rounded-lg transition-colors disabled:opacity-40"
              >
                {bulkDeleting ? 'Deleting...' : `🗑 Delete Received (${receivedInRange.length})`}
              </button>
              {pendingInvoices.length > 0 && (
                <span className="text-xs text-yellow-700 font-semibold">
                  ⚠️ {pendingInvoices.length} pending will be skipped
                </span>
              )}
            </div>
          )}
        </div>

        {/* 테이블 */}
        {loading ? (
          <div className="text-gray-400 py-8 text-center">Loading...</div>
        ) : invoices.length === 0 ? (
          <div className="text-gray-400 py-8 text-center">No invoices found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-base">
              <thead>
                <tr className="border-b-2 border-gray-200 text-left text-gray-600 font-bold">
                  <th className="py-2 px-3">Invoice #</th>
                  <th className="py-2 px-3 hidden sm:table-cell">Date</th>
                  <th className="py-2 px-3 text-center hidden sm:table-cell">D/C</th>
                  <th className="py-2 px-3 text-center hidden sm:table-cell">Shirts</th>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 px-3"></th>
                </tr>
              </thead>
              <tbody>
                {invoices.map(inv => (
                  <tr key={inv.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2 px-3 font-bold text-red-600 font-mono text-base">
                      <div>{inv.invoiceNo}</div>
                      <div className="sm:hidden text-xs text-gray-400 font-normal font-sans mt-0.5">
                        D/C {inv.dcCount} · Shirts {inv.shirtCount} · {fmtDate(inv.createdAt)}
                      </div>
                    </td>
                    <td className="py-2 px-3 text-gray-600 hidden sm:table-cell">{fmtDate(inv.createdAt)}</td>
                    <td className="py-2 px-3 text-center font-mono text-sm hidden sm:table-cell">
                      <span className={inv.status === 'received' ? 'text-green-600 font-bold' : 'text-red-500'}>
                        {inv.status === 'received' ? inv.dcCount : 0}
                      </span>
                      <span className="text-gray-400"> / {inv.dcCount}</span>
                    </td>
                    <td className="py-2 px-3 text-center font-mono text-sm hidden sm:table-cell">
                      <span className={inv.status === 'received' ? 'text-green-600 font-bold' : 'text-red-500'}>
                        {inv.status === 'received' ? inv.shirtCount : 0}
                      </span>
                      <span className="text-gray-400"> / {inv.shirtCount}</span>
                    </td>
                    <td className="py-2 px-3"><StatusBadge status={inv.status} /></td>
                    <td className="py-2 px-3">
                      <div className="flex gap-1">
                        {inv.status === 'pending' && (
                          <button
                            onClick={() => setViewInvoice(inv)}
                            className="text-xs text-blue-500 hover:text-blue-700 px-2 py-1 rounded hover:bg-blue-50 font-semibold"
                          >
                            View
                          </button>
                        )}
                        <button
                          onClick={() => deleteInvoice(inv.id, inv.invoiceNo)}
                          className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50 font-semibold"
                        >
                          Del
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 통계 */}
      <div className="bg-white rounded-xl shadow-md p-5">
        <h2 className="text-lg font-bold text-gray-800 mb-4">Statistics</h2>
        <div className="flex flex-wrap gap-3 items-end mb-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">From</label>
            <input type="date" value={statsFrom} onChange={e => setStatsFrom(e.target.value)}
              className="border border-gray-300 rounded px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">To</label>
            <input type="date" value={statsTo} onChange={e => setStatsTo(e.target.value)}
              className="border border-gray-300 rounded px-3 py-2 text-sm" />
          </div>
          <button onClick={calcStats}
            className="bg-[#E07B0F] text-white font-bold px-5 py-2 rounded-lg hover:bg-[#C46A09] transition-colors">
            Get Stats
          </button>
        </div>

        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="bg-blue-50 rounded-lg p-4 text-center">
              <div className="text-3xl font-extrabold text-blue-700">{stats.invoiceCount}</div>
              <div className="text-sm font-semibold text-gray-600 mt-1">Invoices</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4 text-center">
              <div className="text-3xl font-extrabold text-purple-700">{stats.dcCount}</div>
              <div className="text-sm font-semibold text-gray-600 mt-1">D/C</div>
            </div>
            <div className="bg-indigo-50 rounded-lg p-4 text-center">
              <div className="text-3xl font-extrabold text-indigo-700">{stats.shirtCount}</div>
              <div className="text-sm font-semibold text-gray-600 mt-1">Shirts</div>
            </div>
            <div className="bg-green-50 rounded-lg p-4 text-center">
              <div className="text-3xl font-extrabold text-green-700">{stats.receivedCount}</div>
              <div className="text-sm font-semibold text-gray-600 mt-1">Received</div>
            </div>
            <div className="bg-yellow-50 rounded-lg p-4 text-center">
              <div className="text-3xl font-extrabold text-yellow-700">{stats.pendingCount}</div>
              <div className="text-sm font-semibold text-gray-600 mt-1">Pending</div>
            </div>
          </div>
        )}
      </div>

      {/* 인보이스 번호 수정 모달 */}
      {editInvoice && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full">
            <h2 className="text-xl font-bold mb-1">Edit Invoice #</h2>
            <p className="text-sm text-gray-500 mb-4">기존: <span className="font-mono font-bold text-gray-700">{editInvoice.invoiceNo}</span></p>
            <input
              type="text"
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveEditInvoice()}
              autoFocus
              className="w-full border-2 border-blue-500 rounded-lg px-4 py-3 text-2xl font-mono focus:outline-none mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={saveEditInvoice}
                disabled={!editValue.trim()}
                className="flex-1 bg-gray-900 text-white font-bold py-2 rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-40"
              >
                Save
              </button>
              <button
                onClick={() => { setEditInvoice(null); setEditValue('') }}
                className="flex-1 bg-gray-100 text-gray-700 font-bold py-2 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 태그 조회 모달 */}
      {viewInvoice && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-xl font-bold">#{viewInvoice.invoiceNo}</h2>
                <p className="text-sm text-gray-400 mt-0.5">{fmtDate(viewInvoice.createdAt)}</p>
              </div>
              <button onClick={() => setViewInvoice(null)} className="text-gray-400 hover:text-gray-600 text-xl font-bold">✕</button>
            </div>

            <div className="overflow-y-auto space-y-4">
              {(viewInvoice.dcTags || []).length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-gray-400 uppercase mb-2">
                    D/C Tags ({viewInvoice.dcTags.length})
                  </div>
                  <div className="space-y-1">
                    {viewInvoice.dcTags.map((tag, i) => {
                      const received = (viewInvoice.receivedTags || []).includes(tag)
                      return (
                        <div key={tag} className={`flex items-center justify-between px-3 py-1.5 rounded text-sm font-mono ${received ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                          <span>{i + 1}. {tag}</span>
                          <span className="text-xs font-semibold ml-2">{received ? '✓ received' : '⏳ pending'}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {(viewInvoice.shirtTags || []).length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-gray-400 uppercase mb-2">
                    Shirt Tags ({viewInvoice.shirtTags.length})
                  </div>
                  <div className="space-y-1">
                    {viewInvoice.shirtTags.map((tag, i) => {
                      const received = (viewInvoice.receivedTags || []).includes(tag)
                      return (
                        <div key={tag} className={`flex items-center justify-between px-3 py-1.5 rounded text-sm font-mono ${received ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                          <span>{i + 1}. {tag}</span>
                          <span className="text-xs font-semibold ml-2">{received ? '✓ received' : '⏳ pending'}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
