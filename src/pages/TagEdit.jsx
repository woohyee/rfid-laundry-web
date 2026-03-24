import { useState, useRef } from 'react'
import { collection, query, where, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/context/AuthContext'
import TagScanner from '@/components/TagScanner'
import ErrorBanner from '@/components/ErrorBanner'

export default function TagEdit() {
  const { user } = useAuth()
  const [searchNo, setSearchNo] = useState('')
  const [invoice, setInvoice] = useState(null)   // 검색된 인보이스 (id 포함)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [toast, setToast] = useState(null)
  const [scannedTag, setScannedTag] = useState(null) // { tagId, type: 'shirt'|'dc' }
  const searchRef = useRef(null)

  async function handleSearch(e) {
    if (e.key !== 'Enter' && e.type !== 'click') return
    const no = searchNo.trim()
    if (!no) return
    setError(null)
    setInvoice(null)
    setScannedTag(null)
    setLoading(true)
    try {
      const q = query(
        collection(db, 'invoices'),
        where('shopId', '==', user.uid),
        where('invoiceNo', '==', no)
      )
      const snap = await getDocs(q)
      if (snap.empty) {
        setError(`Invoice #${no} not found.`)
      } else {
        const d = snap.docs[0]
        setInvoice({ id: d.id, ...d.data() })
      }
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }

  // 태그 스캔 → 어느 카테고리인지 찾기
  function handleTagScan(tagId) {
    if (!invoice) return
    setError(null)
    const inShirt = (invoice.shirtTags || []).includes(tagId)
    const inDc = (invoice.dcTags || []).includes(tagId)
    if (!inShirt && !inDc) {
      setError(`Tag ${tagId} not found in invoice #${invoice.invoiceNo}.`)
      setScannedTag(null)
      return
    }
    setScannedTag({ tagId, type: inShirt ? 'shirt' : 'dc' })
  }

  // Firestore 업데이트 후 로컬 invoice 상태도 갱신
  async function applyChange(updatedFields) {
    setSaving(true)
    try {
      await updateDoc(doc(db, 'invoices', invoice.id), updatedFields)
      setInvoice(prev => ({ ...prev, ...updatedFields }))
      setScannedTag(null)
      showToast('Saved.')
    } catch (e) {
      setError('Save failed: ' + e.message)
    }
    setSaving(false)
  }

  // 태그 삭제
  function handleDelete() {
    if (!scannedTag) return
    const { tagId, type } = scannedTag
    if (!window.confirm(`Delete tag ${tagId} from invoice #${invoice.invoiceNo}?`)) return
    if (type === 'shirt') {
      applyChange({
        shirtTags: (invoice.shirtTags || []).filter(t => t !== tagId),
        shirtCount: Math.max(0, (invoice.shirtCount || 0) - 1),
      })
    } else {
      applyChange({
        dcTags: (invoice.dcTags || []).filter(t => t !== tagId),
        dcCount: Math.max(0, (invoice.dcCount || 0) - 1),
      })
    }
  }

  // 인보이스 전체 삭제
  async function handleDeleteInvoice() {
    if (!window.confirm(`Delete entire invoice #${invoice.invoiceNo}? This cannot be undone.`)) return
    setSaving(true)
    try {
      await deleteDoc(doc(db, 'invoices', invoice.id))
      setInvoice(null)
      setScannedTag(null)
      setSearchNo('')
      showToast(`Invoice #${invoice.invoiceNo} deleted.`)
    } catch (e) {
      setError('Delete failed: ' + e.message)
    }
    setSaving(false)
  }

  // 태그 이동 (shirt ↔ dc)
  function handleMove() {
    if (!scannedTag) return
    const { tagId, type } = scannedTag
    const fromLabel = type === 'shirt' ? 'Shirt → D/C' : 'D/C → Shirt'
    if (!window.confirm(`Move tag ${tagId}: ${fromLabel}?`)) return
    if (type === 'shirt') {
      applyChange({
        shirtTags: (invoice.shirtTags || []).filter(t => t !== tagId),
        shirtCount: Math.max(0, (invoice.shirtCount || 0) - 1),
        dcTags: [...(invoice.dcTags || []), tagId],
        dcCount: (invoice.dcCount || 0) + 1,
      })
    } else {
      applyChange({
        dcTags: (invoice.dcTags || []).filter(t => t !== tagId),
        dcCount: Math.max(0, (invoice.dcCount || 0) - 1),
        shirtTags: [...(invoice.shirtTags || []), tagId],
        shirtCount: (invoice.shirtCount || 0) + 1,
      })
    }
  }

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(null), 2000)
  }

  const labelClass = 'text-sm font-bold text-gray-700 uppercase tracking-wide'
  const activeCard = 'rounded-xl p-4 bg-white shadow-md border-2 border-[#E07B0F]'
  const inactiveCard = 'rounded-xl p-4 bg-white border border-[#E4E2DC]'

  return (
    <div className="max-w-lg mx-auto space-y-4 relative">

      <ErrorBanner message={error} onClose={() => setError(null)} />

      {/* 인보이스 검색 */}
      <div className={activeCard}>
        <div className={`${labelClass} mb-2`}>Search Invoice #</div>
        <div className="flex gap-2">
          <input
            ref={searchRef}
            type="text"
            value={searchNo}
            onChange={e => setSearchNo(e.target.value)}
            onKeyDown={handleSearch}
            placeholder="Invoice number..."
            className="flex-1 border-2 border-[#E07B0F] rounded-lg px-4 py-3 text-2xl font-mono font-bold text-gray-900 focus:outline-none focus:border-[#C46A09] bg-white"
          />
          <button
            onClick={handleSearch}
            disabled={loading || !searchNo.trim()}
            className="px-5 py-3 bg-[#E07B0F] text-white font-bold rounded-lg hover:bg-[#C46A09] transition-colors disabled:opacity-40 text-lg"
          >
            {loading ? '...' : 'Find'}
          </button>
        </div>
      </div>

      {/* 검색 결과 */}
      {invoice && (
        <>
          {/* 인보이스 요약 */}
          <div className={inactiveCard}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="text-xl font-extrabold font-mono text-gray-900">#{invoice.invoiceNo}</span>
                <span className={`ml-3 px-2 py-0.5 rounded text-sm font-bold ${invoice.status === 'received' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                  {invoice.status}
                </span>
              </div>
              <button
                onClick={handleDeleteInvoice}
                disabled={saving}
                className="text-sm font-bold text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40"
              >
                🗑 Delete Invoice
              </button>
            </div>
            <div className="flex gap-6 text-sm font-semibold text-gray-600">
              <span>Shirts: <span className="text-green-700 font-extrabold">{(invoice.shirtTags || []).length}</span> / {invoice.shirtCount}</span>
              <span>D/C: <span className="text-[#E07B0F] font-extrabold">{(invoice.dcTags || []).length}</span> / {invoice.dcCount}</span>
            </div>

            {/* 태그 목록 */}
            <div className="mt-4 space-y-3">
              {(invoice.shirtTags || []).length > 0 && (
                <div>
                  <div className="text-xs font-bold text-gray-400 uppercase mb-1">Shirt Tags</div>
                  <div className="space-y-1">
                    {(invoice.shirtTags || []).map((tag, i) => (
                      <div
                        key={tag}
                        onClick={() => setScannedTag({ tagId: tag, type: 'shirt' })}
                        className={`flex items-center px-3 py-1.5 rounded text-sm font-mono cursor-pointer transition-colors ${
                          scannedTag?.tagId === tag
                            ? 'bg-green-200 text-green-900 font-bold ring-2 ring-green-400'
                            : 'bg-green-50 text-green-800 hover:bg-green-100'
                        }`}
                      >
                        <span className="flex-1">{i + 1}. {tag}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {(invoice.dcTags || []).length > 0 && (
                <div>
                  <div className="text-xs font-bold text-gray-400 uppercase mb-1">D/C Tags</div>
                  <div className="space-y-1">
                    {(invoice.dcTags || []).map((tag, i) => (
                      <div
                        key={tag}
                        onClick={() => setScannedTag({ tagId: tag, type: 'dc' })}
                        className={`flex items-center px-3 py-1.5 rounded text-sm font-mono cursor-pointer transition-colors ${
                          scannedTag?.tagId === tag
                            ? 'bg-amber-200 text-amber-900 font-bold ring-2 ring-amber-400'
                            : 'bg-[#FEF3E2] text-[#92400E] hover:bg-amber-100'
                        }`}
                      >
                        <span className="flex-1">{i + 1}. {tag}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 태그 스캔 */}
          <div className={activeCard}>
            <div className={`${labelClass} mb-2`}>Scan Tag to Select</div>
            <TagScanner
              onScan={handleTagScan}
              placeholder="Scan RFID tag..."
              autoFocus={true}
              disabled={false}
            />
            <p className="text-xs text-gray-400 mt-2">
              또는 위 목록에서 태그를 직접 클릭해서 선택하세요.
            </p>
          </div>
        </>
      )}

      {/* 태그 액션 모달 */}
      {scannedTag && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-gray-800">Tag Action</h2>
              <button
                onClick={() => setScannedTag(null)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold"
              >✕</button>
            </div>

            <div className={`px-4 py-3 rounded-lg font-mono text-lg font-bold mb-6 ${
              scannedTag.type === 'shirt'
                ? 'bg-green-50 text-green-800'
                : 'bg-[#FEF3E2] text-[#92400E]'
            }`}>
              {scannedTag.tagId}
              <span className="ml-3 text-sm font-semibold opacity-60">
                ({scannedTag.type === 'shirt' ? 'Shirt' : 'D/C'})
              </span>
            </div>

            <div className="flex gap-3 mb-3">
              <button
                onClick={handleMove}
                disabled={saving}
                className="flex-1 py-3 font-bold rounded-lg transition-colors text-base bg-[#18181B] text-white hover:bg-gray-700 disabled:opacity-40"
              >
                {scannedTag.type === 'shirt' ? '→ Move to D/C' : '→ Move to Shirt'}
              </button>
              <button
                onClick={handleDelete}
                disabled={saving}
                className="flex-1 py-3 font-bold rounded-lg transition-colors text-base bg-red-500 text-white hover:bg-red-600 disabled:opacity-40"
              >
                Delete
              </button>
            </div>
            <button
              onClick={() => setScannedTag(null)}
              className="w-full py-2 text-sm font-semibold text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
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
    </div>
  )
}
