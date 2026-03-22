import { useState } from 'react'
import { collection, query, where, getDocs, doc, updateDoc, serverTimestamp, arrayUnion } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/context/AuthContext'
import TagScanner from '@/components/TagScanner'
import ErrorBanner from '@/components/ErrorBanner'

export default function Receiving() {
  const { user } = useAuth()
  // 세션에서 스캔된 인보이스 현황: { [invoiceId]: { invoice, scannedDc, scannedShirt } }
  const [sessionScanned, setSessionScanned] = useState({})
  const [lastScan, setLastScan] = useState(null)
  const [sessionTags, setSessionTags] = useState([])
  const [error, setError] = useState(null)

  async function handleScan(tagId) {
    setError(null)

    // 이번 세션에서 이미 스캔한 태그 무시
    if (sessionTags.includes(tagId)) {
      setError(`Tag ${tagId} already scanned in this session.`)
      return
    }

    try {
      // Firestore에서 이 태그가 속한 인보이스 찾기
      const q = query(
        collection(db, 'invoices'),
        where('shopId', '==', user.uid),
        where('status', '==', 'pending')
      )
      const snapshot = await getDocs(q)

      let foundInvoice = null
      let tagCategory = null

      for (const docSnap of snapshot.docs) {
        const data = docSnap.data()
        if (data.dcTags?.includes(tagId)) {
          foundInvoice = { id: docSnap.id, ...data }
          tagCategory = 'dc'
          break
        }
        if (data.shirtTags?.includes(tagId)) {
          foundInvoice = { id: docSnap.id, ...data }
          tagCategory = 'shirt'
          break
        }
      }

      if (!foundInvoice) {
        setError(`Tag ${tagId} not found in any pending invoice.`)
        return
      }

      // Firestore에 receivedTags 누적 저장 (세션 끊겨도 유지됨)
      await updateDoc(doc(db, 'invoices', foundInvoice.id), {
        receivedTags: arrayUnion(tagId),
      })

      // 누적 receivedTags 계산
      const newReceived = [...(foundInvoice.receivedTags || []), tagId]
      const scannedDc = newReceived.filter(t => foundInvoice.dcTags?.includes(t)).length
      const scannedShirt = newReceived.filter(t => foundInvoice.shirtTags?.includes(t)).length
      const updatedInvoice = { ...foundInvoice, receivedTags: newReceived }

      // 세션 태그 목록에 추가
      setSessionTags(prev => [...prev, tagId])

      // 세션 현황 업데이트
      const updated = { invoice: updatedInvoice, scannedDc, scannedShirt }
      setSessionScanned(prev => ({ ...prev, [foundInvoice.id]: updated }))
      setLastScan({ invoice: updatedInvoice, tagCategory })

      // 모든 태그 스캔 완료 확인
      const totalDc = foundInvoice.dcCount || 0
      const totalShirt = foundInvoice.shirtCount || 0
      if (scannedDc >= totalDc && scannedShirt >= totalShirt) {
        await updateDoc(doc(db, 'invoices', foundInvoice.id), {
          status: 'received',
          receivedAt: serverTimestamp(),
        })
        setSessionScanned(prev => ({
          ...prev,
          [foundInvoice.id]: { ...updated, done: true }
        }))
      }
    } catch (e) {
      setError('Error: ' + e.message)
    }
  }

  const [summary, setSummary] = useState(null)

  function handleCompleteSession() {
    const results = Object.values(sessionScanned)
    const received = results.filter(s => {
      const totalDc = s.invoice.dcCount || 0
      const totalShirt = s.invoice.shirtCount || 0
      return s.done || (s.scannedDc >= totalDc && s.scannedShirt >= totalShirt)
    })
    const incomplete = results.filter(s => {
      const totalDc = s.invoice.dcCount || 0
      const totalShirt = s.invoice.shirtCount || 0
      return !(s.done || (s.scannedDc >= totalDc && s.scannedShirt >= totalShirt))
    })
    setSummary({ received, incomplete })
    // 세션 초기화
    setSessionScanned({})
    setLastScan(null)
    setSessionTags([])
    setError(null)
  }

  const lastInvoice = lastScan?.invoice
  const lastSession = lastInvoice ? sessionScanned[lastInvoice.id] : null
  const sessionCount = Object.keys(sessionScanned).length

  return (
    <div className="space-y-4">
      <ErrorBanner message={error} onClose={() => setError(null)} />

      <div className="flex flex-col sm:flex-row gap-4">
        {/* 스캔 영역 */}
        <div className="flex-1 space-y-4">
          <div className="bg-white rounded-xl shadow-md p-5">
            <div className="text-sm font-semibold text-gray-500 mb-3">Scan RFID Tag</div>
            <TagScanner onScan={handleScan} placeholder="Scan RFID tag..." autoFocus={true} />
          </div>

          {/* 마지막 스캔 결과 */}
          {lastScan && lastSession && (() => {
            const totalDc = lastInvoice.dcCount || 0
            const totalShirt = lastInvoice.shirtCount || 0
            const isDone = lastSession.done || (lastSession.scannedDc >= totalDc && lastSession.scannedShirt >= totalShirt)
            return (
              <div className={`rounded-2xl shadow-lg overflow-hidden transition-all duration-300 ${isDone ? 'bg-green-500' : 'bg-gray-900'}`}>
                {/* 인보이스 번호 — 최우선 */}
                <div className="flex flex-col items-center justify-center px-8 py-10 text-center">
                  <div className="text-xs font-semibold tracking-widest uppercase mb-4"
                    style={{ color: isDone ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.5)' }}>
                    Invoice
                  </div>
                  <div className="leading-none text-white"
                    style={{ fontSize: '5rem', fontFamily: "'Inter', sans-serif", fontWeight: 300, letterSpacing: '0.1em' }}>
                    {lastInvoice.invoiceNo}
                  </div>
                  {isDone && (
                    <div className="mt-4 text-white font-bold text-xl tracking-wide">
                      ✓ All Received!
                    </div>
                  )}
                </div>

                {/* D/C · Shirts 카운터 */}
                <div className="flex divide-x divide-white/20 border-t border-white/20 mt-2">
                  {totalDc > 0 && (
                    <div className="flex-1 py-5 text-center">
                      <div className="text-xs font-semibold tracking-widest uppercase mb-1"
                        style={{ color: 'rgba(255,255,255,0.6)' }}>D/C</div>
                      <div className="text-white" style={{ fontSize: '2.5rem', fontFamily: "'Inter', sans-serif", fontWeight: 300 }}>
                        {lastSession.scannedDc}
                        <span className="text-lg font-normal" style={{ color: 'rgba(255,255,255,0.5)' }}>
                          {' '}/ {totalDc}
                        </span>
                      </div>
                    </div>
                  )}
                  {totalShirt > 0 && (
                    <div className="flex-1 py-5 text-center">
                      <div className="text-xs font-semibold tracking-widest uppercase mb-1"
                        style={{ color: 'rgba(255,255,255,0.6)' }}>Shirts</div>
                      <div className="text-white" style={{ fontSize: '2.5rem', fontFamily: "'Inter', sans-serif", fontWeight: 300 }}>
                        {lastSession.scannedShirt}
                        <span className="text-lg font-normal" style={{ color: 'rgba(255,255,255,0.5)' }}>
                          {' '}/ {totalShirt}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })()}
        </div>

        {/* 세션 인보이스 목록 */}
        <div className="w-full sm:w-56 bg-white rounded-xl shadow-md p-4 self-start">
          <div className="text-sm font-semibold text-gray-500 mb-3">
            Session ({sessionCount})
          </div>
          {Object.keys(sessionScanned).length === 0 ? (
            <div className="text-gray-400 text-sm">No invoices yet</div>
          ) : (
            <div className="space-y-2">
              {Object.values(sessionScanned).map(({ invoice, scannedDc, scannedShirt, done }) => {
                const totalDc = invoice.dcCount || 0
                const totalShirt = invoice.shirtCount || 0
                const isDone = done || (scannedDc >= totalDc && scannedShirt >= totalShirt)
                return (
                  <div key={invoice.id} className={`px-3 py-2 rounded-lg text-sm ${isDone ? 'bg-green-100 text-green-800' : 'bg-blue-50 text-blue-800'}`}>
                    <div className="font-bold font-mono">{invoice.invoiceNo}</div>
                    {totalDc > 0 && <div>D/C: {scannedDc} / {totalDc}</div>}
                    {totalShirt > 0 && <div>Shirts: {scannedShirt} / {totalShirt}</div>}
                    {isDone && <div className="text-green-600 font-semibold">✓ Done</div>}
                  </div>
                )
              })}
            </div>
          )}
          {/* Complete Session 버튼 */}
          {sessionCount > 0 && (
            <button
              onClick={handleCompleteSession}
              className="mt-4 w-full bg-gray-900 text-white font-bold py-2 px-4 rounded-lg hover:bg-gray-700 transition-colors"
            >
              Complete Session
            </button>
          )}
        </div>
      </div>

      {/* 세션 종료 요약 모달 */}
      {summary && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4">
            <h2 className="text-2xl font-bold mb-6">Session Complete</h2>

            <div className="mb-4">
              <div className="text-green-700 font-semibold text-lg mb-2">
                ✓ Received: {summary.received.length} invoices
              </div>
              {summary.received.length > 0 && (
                <div className="space-y-1">
                  {summary.received.map(({ invoice }) => (
                    <div key={invoice.id} className="text-sm bg-green-50 px-3 py-1 rounded text-green-800 font-mono">
                      {invoice.invoiceNo}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {summary.incomplete.length > 0 && (
              <div className="mb-6">
                <div className="text-red-700 font-semibold text-lg mb-2">
                  ⚠ Incomplete: {summary.incomplete.length} invoices
                </div>
                <div className="space-y-1">
                  {summary.incomplete.map(({ invoice, scannedDc, scannedShirt }) => (
                    <div key={invoice.id} className="text-sm bg-red-50 px-3 py-1 rounded text-red-800 font-mono">
                      {invoice.invoiceNo} — D/C {scannedDc}/{invoice.dcCount} · Shirts {scannedShirt}/{invoice.shirtCount}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => setSummary(null)}
              className="w-full bg-gray-900 text-white font-bold py-3 rounded-lg hover:bg-gray-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
