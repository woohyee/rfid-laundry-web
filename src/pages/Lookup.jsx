import { useState, useEffect } from 'react'
import {
  collection, query, where, getDocs,
  doc, deleteDoc, updateDoc, writeBatch
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/context/AuthContext'
import TagScanner from '@/components/TagScanner'
import ErrorBanner from '@/components/ErrorBanner'

const DAY_COLORS = { MON:'#3B82F6', TUE:'#8B5CF6', WED:'#10B981', THU:'#F59E0B', FRI:'#EF4444', SAT:'#EC4899' }

function StatusBadge({ status }) {
  const styles = {
    pending: 'bg-yellow-100 text-yellow-800',
    received: 'bg-green-100 text-green-800',
    archived: 'bg-gray-100 text-gray-600',
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
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [toast, setToast] = useState(null)

  // 태그 편집 모달
  const [tagEditInvoice, setTagEditInvoice] = useState(null)
  const [scannedTag, setScannedTag] = useState(null)  // { tagId, type: 'shirt'|'dc' }
  const [addingTag, setAddingTag] = useState(null)     // 추가할 태그 ID
  const [editingDay, setEditingDay] = useState(false)

  useEffect(() => {
    runArchiveCleanup()
  }, [])

  useEffect(() => {
    fetchInvoices()
  }, [statusFilter, dateFrom, dateTo])

  // received → archived 전환 + 7일 초과 archived 삭제
  async function runArchiveCleanup() {
    try {
      const today = new Date(); today.setHours(0, 0, 0, 0)
      const cutoff7 = new Date(); cutoff7.setDate(cutoff7.getDate() - 7)
      const q = query(collection(db, 'invoices'), where('shopId', '==', user.uid))
      const snap = await getDocs(q)
      if (snap.empty) return
      const batch = writeBatch(db)
      let hasOps = false
      snap.docs.forEach(d => {
        const data = d.data()
        if (data.status !== 'received' && data.status !== 'archived') return
        const receivedDate = data.receivedAt?.toDate?.()
        if (!receivedDate) return
        if (data.status === 'archived' && receivedDate < cutoff7) {
          batch.delete(d.ref); hasOps = true
        } else if (data.status === 'received' && receivedDate < today) {
          batch.update(d.ref, { status: 'archived' }); hasOps = true
        }
      })
      if (hasOps) await batch.commit()
    } catch (_) {
      // cleanup 실패는 무시 (다음 진입 시 재시도)
    }
  }

  async function fetchInvoices() {
    setLoading(true)
    setError(null)
    try {
      const q = query(collection(db, 'invoices'), where('shopId', '==', user.uid))
      const snapshot = await getDocs(q)
      let data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }))

      if (statusFilter === 'archived') {
        // archived 필터: receivedAt 기준 내림차순
        data = data.filter(inv => inv.status === 'archived')
        data.sort((a, b) => {
          const aTime = a.receivedAt?.toDate?.() ?? new Date(0)
          const bTime = b.receivedAt?.toDate?.() ?? new Date(0)
          return bTime - aTime
        })
        if (dateFrom || dateTo) {
          data = data.filter(inv => isInRange(inv.receivedAt, dateFrom, dateTo))
        }
      } else {
        // 일반 필터: archived 제외, createdAt 기준 내림차순
        data = data.filter(inv => inv.status !== 'archived')
        data.sort((a, b) => {
          const aTime = a.createdAt?.toDate?.() ?? new Date(0)
          const bTime = b.createdAt?.toDate?.() ?? new Date(0)
          return bTime - aTime
        })
        if (statusFilter !== 'all') {
          data = data.filter(inv => inv.status === statusFilter)
        }
        if (dateFrom || dateTo) {
          data = data.filter(inv => isInRange(inv.createdAt, dateFrom, dateTo))
        }
        // pending 상단 고정
        const pending = data.filter(inv => inv.status === 'pending')
        const others = data.filter(inv => inv.status !== 'pending')
        data = [...pending, ...others]
      }

      setInvoices(data)
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
      const chunks = []
      for (let i = 0; i < toDelete.length; i += 500) chunks.push(toDelete.slice(i, i + 500))
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

  // ── 태그 편집 모달 함수들 ──

  function openTagEdit(inv) {
    setTagEditInvoice(inv)
    setScannedTag(null)
    setAddingTag(null)
    setEditingDay(false)
  }

  function handleTagScan(tagId) {
    if (!tagEditInvoice) return
    setError(null)
    const inShirt = (tagEditInvoice.shirtTags || []).includes(tagId)
    const inDc = (tagEditInvoice.dcTags || []).includes(tagId)
    if (!inShirt && !inDc) { setAddingTag(tagId); return }
    setScannedTag({ tagId, type: inShirt ? 'shirt' : 'dc' })
  }

  async function handleAddTag(type) {
    if (!addingTag) return
    const tagId = addingTag
    setAddingTag(null)
    if (type === 'shirt') {
      await applyTagChange({
        shirtTags: [...(tagEditInvoice.shirtTags || []), tagId],
        shirtCount: (tagEditInvoice.shirtCount || 0) + 1,
      })
    } else {
      await applyTagChange({
        dcTags: [...(tagEditInvoice.dcTags || []), tagId],
        dcCount: (tagEditInvoice.dcCount || 0) + 1,
      })
    }
  }

  async function applyTagChange(updatedFields) {
    setSaving(true)
    try {
      await updateDoc(doc(db, 'invoices', tagEditInvoice.id), updatedFields)
      setTagEditInvoice(prev => ({ ...prev, ...updatedFields }))
      setScannedTag(null)
      showToast('Saved.')
      fetchInvoices()
    } catch (e) {
      setError('Save failed: ' + e.message)
    }
    setSaving(false)
  }

  function handleTagDelete() {
    if (!scannedTag) return
    const { tagId, type } = scannedTag
    if (!window.confirm(`Delete tag ${tagId} from invoice #${tagEditInvoice.invoiceNo}?`)) return
    if (type === 'shirt') {
      applyTagChange({
        shirtTags: (tagEditInvoice.shirtTags || []).filter(t => t !== tagId),
        shirtCount: Math.max(0, (tagEditInvoice.shirtCount || 0) - 1),
      })
    } else {
      applyTagChange({
        dcTags: (tagEditInvoice.dcTags || []).filter(t => t !== tagId),
        dcCount: Math.max(0, (tagEditInvoice.dcCount || 0) - 1),
      })
    }
  }

  function handleTagMove() {
    if (!scannedTag) return
    const { tagId, type } = scannedTag
    if (!window.confirm(`Move tag ${tagId}: ${type === 'shirt' ? 'Shirt → D/C' : 'D/C → Shirt'}?`)) return
    if (type === 'shirt') {
      applyTagChange({
        shirtTags: (tagEditInvoice.shirtTags || []).filter(t => t !== tagId),
        shirtCount: Math.max(0, (tagEditInvoice.shirtCount || 0) - 1),
        dcTags: [...(tagEditInvoice.dcTags || []), tagId],
        dcCount: (tagEditInvoice.dcCount || 0) + 1,
      })
    } else {
      applyTagChange({
        dcTags: (tagEditInvoice.dcTags || []).filter(t => t !== tagId),
        dcCount: Math.max(0, (tagEditInvoice.dcCount || 0) - 1),
        shirtTags: [...(tagEditInvoice.shirtTags || []), tagId],
        shirtCount: (tagEditInvoice.shirtCount || 0) + 1,
      })
    }
  }

  async function handleDayChange(day) {
    setEditingDay(false)
    await applyTagChange({ dueDay: day })
  }

  async function handleDeleteTagEditInvoice() {
    if (!window.confirm(`Delete entire invoice #${tagEditInvoice.invoiceNo}? This cannot be undone.`)) return
    setSaving(true)
    try {
      await deleteDoc(doc(db, 'invoices', tagEditInvoice.id))
      setTagEditInvoice(null)
      showToast(`Invoice #${tagEditInvoice.invoiceNo} deleted.`)
      fetchInvoices()
    } catch (e) {
      setError('Delete failed: ' + e.message)
    }
    setSaving(false)
  }

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(null), 2000)
  }

  const pendingInvoices = invoices.filter(inv => inv.status === 'pending')
  const receivedInRange = invoices.filter(inv => inv.status === 'received')
  const hasDateFilter = dateFrom || dateTo

  return (
    <>
    <div className="space-y-6">

      <ErrorBanner message={error} onClose={() => setError(null)} />

      {/* 전체 목록 */}
      <div className="bg-white rounded-xl shadow-md p-5">
        <h2 className="text-lg font-bold text-gray-800 mb-4">All Invoices</h2>

        {/* 필터 */}
        <div className="space-y-3 mb-4">
          {/* 상태 필터 */}
          <div className="flex gap-1 flex-wrap">
            {['all', 'pending', 'received', 'archived'].map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-4 py-1.5 rounded-lg font-semibold text-sm capitalize ${statusFilter === s ? 'bg-[#18181B] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>

          {/* 날짜 구간 필터 */}
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label className="block text-xs text-gray-500 mb-1">From</label>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                className="border border-gray-300 rounded px-3 py-1.5 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">To</label>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                className="border border-gray-300 rounded px-3 py-1.5 text-sm" />
            </div>
            {hasDateFilter && (
              <button onClick={() => { setDateFrom(''); setDateTo('') }}
                className="text-sm text-gray-500 hover:text-gray-700 pb-1">Clear</button>
            )}
          </div>

          {/* 일괄 삭제 버튼 */}
          {receivedInRange.length > 0 && statusFilter !== 'archived' && (
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
                    <td className="py-2 px-3 text-gray-600 hidden sm:table-cell">
                      {statusFilter === 'archived' ? fmtDate(inv.receivedAt) : fmtDate(inv.createdAt)}
                    </td>
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
                        {inv.status !== 'archived' && (
                          <button
                            onClick={() => openTagEdit(inv)}
                            className="text-xs text-blue-500 hover:text-blue-700 px-2 py-1 rounded hover:bg-blue-50 font-semibold"
                          >
                            Edit
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
            {[
              { label: 'Invoices', value: stats.invoiceCount, color: 'blue' },
              { label: 'D/C', value: stats.dcCount, color: 'purple' },
              { label: 'Shirts', value: stats.shirtCount, color: 'indigo' },
              { label: 'Received', value: stats.receivedCount, color: 'green' },
              { label: 'Pending', value: stats.pendingCount, color: 'yellow' },
            ].map(({ label, value, color }) => (
              <div key={label} className={`bg-${color}-50 rounded-lg p-4 text-center`}>
                <div className={`text-3xl font-extrabold text-${color}-700`}>{value}</div>
                <div className="text-sm font-semibold text-gray-600 mt-1">{label}</div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>

    {/* ── 태그 편집 모달 ── */}
    {tagEditInvoice && (
      <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-40 p-4 overflow-y-auto">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-8">

          {/* 헤더 */}
          <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-[#E4E2DC]">
            <div>
              <span className="text-xl font-extrabold font-mono text-gray-900">{tagEditInvoice.invoiceNo}</span>
              <StatusBadge status={tagEditInvoice.status} />
            </div>
            <button onClick={() => setTagEditInvoice(null)}
              className="text-gray-400 hover:text-gray-600 text-2xl font-bold">✕</button>
          </div>

          <div className="px-6 py-4 space-y-4">

            {/* 인보이스 요약 */}
            <div className="flex items-center gap-4 text-sm font-semibold text-gray-600 flex-wrap">
              <span>Shirts: <span className="text-green-700 font-extrabold">{(tagEditInvoice.shirtTags || []).length}</span> / {tagEditInvoice.shirtCount}</span>
              <span>D/C: <span className="text-[#E07B0F] font-extrabold">{(tagEditInvoice.dcTags || []).length}</span> / {tagEditInvoice.dcCount}</span>
              <button
                onClick={() => setEditingDay(true)}
                className="ml-auto flex items-center gap-1 px-3 py-1 rounded-lg border border-[#E4E2DC] hover:border-[#E07B0F] transition-colors"
              >
                <span className="text-xs text-gray-400 uppercase tracking-wide">Due</span>
                <span className="text-base font-extrabold font-mono ml-1"
                  style={{ color: tagEditInvoice.dueDay ? (DAY_COLORS[tagEditInvoice.dueDay] || '#6B7280') : '#9CA3AF' }}>
                  {tagEditInvoice.dueDay || '—'}
                </span>
              </button>
              <button onClick={handleDeleteTagEditInvoice} disabled={saving}
                className="text-sm font-bold text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40">
                🗑 Delete Invoice
              </button>
            </div>

            {/* 태그 목록 */}
            <div className="space-y-3">
              {(tagEditInvoice.shirtTags || []).length > 0 && (
                <div>
                  <div className="text-xs font-bold text-gray-400 uppercase mb-1">Shirt Tags</div>
                  <div className="space-y-1">
                    {(tagEditInvoice.shirtTags || []).map((tag, i) => (
                      <div key={tag} onClick={() => setScannedTag({ tagId: tag, type: 'shirt' })}
                        className={`flex items-center px-3 py-1.5 rounded text-sm font-mono cursor-pointer transition-colors ${
                          scannedTag?.tagId === tag
                            ? 'bg-green-200 text-green-900 font-bold ring-2 ring-green-400'
                            : 'bg-green-50 text-green-800 hover:bg-green-100'
                        }`}>
                        <span className="flex-1">{i + 1}. {tag}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {(tagEditInvoice.dcTags || []).length > 0 && (
                <div>
                  <div className="text-xs font-bold text-gray-400 uppercase mb-1">D/C Tags</div>
                  <div className="space-y-1">
                    {(tagEditInvoice.dcTags || []).map((tag, i) => (
                      <div key={tag} onClick={() => setScannedTag({ tagId: tag, type: 'dc' })}
                        className={`flex items-center px-3 py-1.5 rounded text-sm font-mono cursor-pointer transition-colors ${
                          scannedTag?.tagId === tag
                            ? 'bg-amber-200 text-amber-900 font-bold ring-2 ring-amber-400'
                            : 'bg-[#FEF3E2] text-[#92400E] hover:bg-amber-100'
                        }`}>
                        <span className="flex-1">{i + 1}. {tag}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 태그 스캔 */}
            <div className="rounded-xl p-4 bg-white shadow-sm border-2 border-[#E07B0F]">
              <div className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-2">Scan Tag to Select or Add</div>
              <TagScanner onScan={handleTagScan} placeholder="Scan RFID tag..." autoFocus={true} disabled={false} />
              <p className="text-xs text-gray-400 mt-2">또는 위 목록에서 태그를 직접 클릭하세요.</p>
            </div>

          </div>
        </div>
      </div>
    )}

    {/* 태그 추가 모달 */}
    {addingTag && (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-gray-800">Add Tag</h2>
            <button onClick={() => setAddingTag(null)} className="text-gray-400 hover:text-gray-600 text-xl font-bold">✕</button>
          </div>
          <div className="px-4 py-3 rounded-lg font-mono text-lg font-bold mb-2 bg-gray-100 text-gray-800">{addingTag}</div>
          <p className="text-sm text-gray-500 mb-5">
            Not in invoice <span className="font-bold text-gray-700">#{tagEditInvoice?.invoiceNo}</span>. Add as:
          </p>
          <div className="flex gap-3">
            <button onClick={() => handleAddTag('shirt')} disabled={saving}
              className="flex-1 py-3 font-bold rounded-lg bg-green-500 text-white hover:bg-green-600 transition-colors disabled:opacity-40 text-base">
              + Shirt
            </button>
            <button onClick={() => handleAddTag('dc')} disabled={saving}
              className="flex-1 py-3 font-bold rounded-lg bg-[#E07B0F] text-white hover:bg-[#C46A09] transition-colors disabled:opacity-40 text-base">
              + D/C
            </button>
          </div>
          <button onClick={() => setAddingTag(null)}
            className="w-full mt-3 py-2 text-sm font-semibold text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
            Cancel
          </button>
        </div>
      </div>
    )}

    {/* 태그 액션 모달 */}
    {scannedTag && (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-gray-800">Tag Action</h2>
            <button onClick={() => setScannedTag(null)} className="text-gray-400 hover:text-gray-600 text-xl font-bold">✕</button>
          </div>
          <div className={`px-4 py-3 rounded-lg font-mono text-lg font-bold mb-6 ${
            scannedTag.type === 'shirt' ? 'bg-green-50 text-green-800' : 'bg-[#FEF3E2] text-[#92400E]'
          }`}>
            {scannedTag.tagId}
            <span className="ml-3 text-sm font-semibold opacity-60">({scannedTag.type === 'shirt' ? 'Shirt' : 'D/C'})</span>
          </div>
          <div className="flex gap-3 mb-3">
            <button onClick={handleTagMove} disabled={saving}
              className="flex-1 py-3 font-bold rounded-lg bg-[#18181B] text-white hover:bg-gray-700 disabled:opacity-40 text-base">
              {scannedTag.type === 'shirt' ? '→ Move to D/C' : '→ Move to Shirt'}
            </button>
            <button onClick={handleTagDelete} disabled={saving}
              className="flex-1 py-3 font-bold rounded-lg bg-red-500 text-white hover:bg-red-600 disabled:opacity-40 text-base">
              Delete
            </button>
          </div>
          <button onClick={() => setScannedTag(null)}
            className="w-full py-2 text-sm font-semibold text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
            Cancel
          </button>
        </div>
      </div>
    )}

    {/* 요일 선택 모달 */}
    {editingDay && (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-gray-800">Select Due Day</h2>
            <button onClick={() => setEditingDay(false)} className="text-gray-400 hover:text-gray-600 text-xl font-bold">✕</button>
          </div>
          <div className="flex gap-2 flex-wrap">
            {['MON','TUE','WED','THU','FRI','SAT'].map(day => (
              <button key={day} onClick={() => handleDayChange(day)}
                className={`flex-1 min-w-[60px] py-3 rounded-lg text-xl font-bold border-2 transition-colors ${
                  tagEditInvoice?.dueDay === day
                    ? 'border-[#E07B0F] text-[#E07B0F]'
                    : 'border-[#E4E2DC] hover:border-[#E07B0F] hover:text-[#E07B0F]'
                }`}>
                {day}
              </button>
            ))}
          </div>
        </div>
      </div>
    )}

    {/* 저장 중 오버레이 */}
    {saving && (
      <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl px-8 py-6 shadow-xl text-lg font-medium">Saving...</div>
      </div>
    )}

    {/* Toast */}
    {toast && (
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-green-600 text-white px-8 py-4 rounded-xl shadow-2xl text-xl font-bold z-50">
        ✓ {toast}
      </div>
    )}
    </>
  )
}
