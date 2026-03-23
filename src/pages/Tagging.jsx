import { useState, useRef, useEffect } from 'react'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/context/AuthContext'
import TagScanner from '@/components/TagScanner'
import ErrorBanner from '@/components/ErrorBanner'

const STEPS = {
  INVOICE: 'invoice',
  DC_COUNT: 'dcCount',
  DC_SCAN: 'dcScan',
  SHIRT_COUNT: 'shirtCount',
  SHIRT_SCAN: 'shirtScan'
}

function looksLikeTagId(val) {
  return /^\d{6,}$/.test(val.trim())
}

export default function Tagging() {
  const { user } = useAuth()
  const [step, setStep] = useState(STEPS.INVOICE)
  const [invoiceNo, setInvoiceNo] = useState('')
  const [dcCount, setDcCount] = useState('')
  const [shirtCount, setShirtCount] = useState('')
  const [dcTags, setDcTags] = useState([])
  const [shirtTags, setShirtTags] = useState([])
  const [toast, setToast] = useState(null)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  const invoiceRef = useRef(null)
  const dcCountRef = useRef(null)
  const shirtCountRef = useRef(null)

  useEffect(() => {
    const delay = (step === STEPS.SHIRT_COUNT || step === STEPS.DC_COUNT) ? 500 : 50
    const t = setTimeout(() => {
      if (step === STEPS.INVOICE) invoiceRef.current?.focus()
      if (step === STEPS.DC_COUNT) dcCountRef.current?.focus()
      if (step === STEPS.SHIRT_COUNT) shirtCountRef.current?.focus()
    }, delay)
    return () => clearTimeout(t)
  }, [step])

  function goBack() {
    setError(null)
    if (step === STEPS.DC_COUNT) setStep(STEPS.INVOICE)
    else if (step === STEPS.DC_SCAN) { setDcTags([]); setStep(STEPS.DC_COUNT) }
    else if (step === STEPS.SHIRT_COUNT) setStep(STEPS.DC_SCAN)
    else if (step === STEPS.SHIRT_SCAN) { setShirtTags([]); setStep(STEPS.SHIRT_COUNT) }
  }

  function handleInvoiceKey(e) {
    if (e.key === 'Enter' && invoiceNo.trim()) setStep(STEPS.DC_COUNT)
  }

  function handleDcCountKey(e) {
    if (e.key !== 'Enter') return
    const raw = dcCount.trim()
    if (looksLikeTagId(raw)) {
      setDcCount('')
      setError('Tag ID detected in D/C count — please enter a number only.')
      return
    }
    const count = raw === '' ? 0 : parseInt(raw, 10)
    if (isNaN(count) || count < 0 || count > 99) {
      setDcCount('')
      setError('D/C count must be between 0 and 99.')
      return
    }
    if (raw === '') setDcCount('0')
    setError(null)
    if (count > 0) setStep(STEPS.DC_SCAN)
    else setStep(STEPS.SHIRT_COUNT)
  }

  function handleShirtCountKey(e) {
    if (e.key !== 'Enter') return
    const raw = shirtCount.trim()
    if (looksLikeTagId(raw)) {
      setShirtCount('')
      setError('Tag ID detected in Shirt count — please enter a number only.')
      return
    }
    const count = raw === '' ? 0 : parseInt(raw, 10)
    if (isNaN(count) || count < 0 || count > 99) {
      setShirtCount('')
      setError('Shirt count must be between 0 and 99.')
      return
    }
    if (raw === '') setShirtCount('0')
    setError(null)
    if (count > 0) setStep(STEPS.SHIRT_SCAN)
    else {
      if (dcTags.length === 0) resetAll()
      else saveInvoice(dcTags, [])
    }
  }

  function handleDcScan(tagId) {
    if (dcTags.includes(tagId) || shirtTags.includes(tagId)) return
    const newDcTags = [...dcTags, tagId]
    setDcTags(newDcTags)
    if (newDcTags.length >= parseInt(dcCount, 10)) setStep(STEPS.SHIRT_COUNT)
  }

  function handleShirtScan(tagId) {
    if (shirtTags.includes(tagId) || dcTags.includes(tagId)) return
    const newShirtTags = [...shirtTags, tagId]
    setShirtTags(newShirtTags)
    if (newShirtTags.length >= parseInt(shirtCount, 10)) saveInvoice(dcTags, newShirtTags)
  }

  async function saveInvoice(finalDcTags, finalShirtTags) {
    setError(null)
    setSaving(true)
    try {
      // Firestore에 인보이스 저장
      const invoiceRef = await addDoc(collection(db, 'invoices'), {
        invoiceNo: invoiceNo.trim(),
        shopId: user.uid,
        dcCount: parseInt(dcCount, 10) || 0,
        shirtCount: parseInt(shirtCount, 10) || 0,
        status: 'pending',
        createdAt: serverTimestamp(),
        receivedAt: null,
        photoUrls: [],
        // 태그 목록을 배열로 저장 (Firestore 서브컬렉션 대신 간단하게)
        dcTags: finalDcTags,
        shirtTags: finalShirtTags,
      })

      showToast(`Saved: #${invoiceNo}`)
      resetAll()
    } catch (e) {
      setError('Save failed: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(null), 2000)
  }

  function resetAll() {
    setInvoiceNo('')
    setDcCount('')
    setShirtCount('')
    setDcTags([])
    setShirtTags([])
    setError(null)
    setStep(STEPS.INVOICE)
  }

  const dcCountNum = parseInt(dcCount, 10) || 0
  const shirtCountNum = parseInt(shirtCount, 10) || 0
  const activeCard = 'rounded-xl p-4 bg-white shadow-md border-2 border-blue-400'
  const inactiveCard = 'rounded-xl p-4 bg-gray-50 border border-gray-200'
  const activeInput = 'w-full border-2 border-blue-500 rounded-lg px-4 py-3 text-2xl font-mono font-bold text-gray-900 focus:outline-none focus:border-blue-700 bg-white'
  const disabledInput = 'w-full border-2 border-gray-200 rounded-lg px-4 py-3 text-2xl font-mono font-bold bg-gray-50 text-gray-700 cursor-not-allowed'
  const labelClass = 'text-sm font-bold text-gray-700 uppercase tracking-wide'

  const hasData = invoiceNo || step !== STEPS.INVOICE

  return (
    <div className="max-w-lg mx-auto space-y-3 relative">

      {/* Reset 버튼 — 데이터 있을 때 항상 표시 */}
      {hasData && (
        <div className="flex justify-end">
          <button
            onClick={resetAll}
            className="flex items-center gap-1 text-sm font-semibold text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors"
          >
            ✕ Reset All
          </button>
        </div>
      )}

      <ErrorBanner message={error} onClose={() => setError(null)} />

      {/* 인보이스 번호 */}
      <div className={step === STEPS.INVOICE ? activeCard : inactiveCard}>
        <div className="flex justify-between items-center mb-2">
          <div className={labelClass}>Invoice #</div>
          {step !== STEPS.INVOICE && invoiceNo && (
            <button
              onClick={() => setStep(STEPS.INVOICE)}
              className="text-xs font-semibold text-blue-500 hover:text-blue-700"
            >✎ Edit</button>
          )}
        </div>
        <div className="relative">
          <input
            ref={invoiceRef}
            type="text"
            value={invoiceNo}
            onChange={e => setInvoiceNo(e.target.value)}
            onKeyDown={handleInvoiceKey}
            placeholder="Invoice number..."
            disabled={step !== STEPS.INVOICE}
            className={step === STEPS.INVOICE ? activeInput + ' pr-10' : disabledInput}
          />
          {step === STEPS.INVOICE && invoiceNo && (
            <button
              onClick={() => { setInvoiceNo(''); invoiceRef.current?.focus() }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 text-xl font-bold"
            >✕</button>
          )}
        </div>
      </div>

      {/* D/C 수량 */}
      {step >= STEPS.DC_COUNT && (
        <div className={step === STEPS.DC_COUNT ? activeCard : inactiveCard}>
          <div className="flex justify-between items-center mb-2">
            <div className={labelClass}>D/C Count</div>
            {step === STEPS.DC_COUNT && (
              <button onClick={goBack} className="text-xs text-gray-400 hover:text-gray-600">← Back</button>
            )}
          </div>
          <input
            ref={dcCountRef}
            type="number"
            min="0" max="99"
            value={dcCount}
            onChange={e => setDcCount(e.target.value)}
            onKeyDown={handleDcCountKey}
            placeholder="0"
            disabled={step !== STEPS.DC_COUNT}
            className={step === STEPS.DC_COUNT ? activeInput : disabledInput}
          />
        </div>
      )}

      {/* D/C 스캔 */}
      {(step === STEPS.DC_SCAN || (step > STEPS.DC_SCAN && dcTags.length > 0)) && (
        <div className={step === STEPS.DC_SCAN ? activeCard : inactiveCard}>
          <div className="flex justify-between items-center mb-2">
            <div className={labelClass}>Scan D/C Tags</div>
            {step === STEPS.DC_SCAN && (
              <button onClick={goBack} className="text-xs text-gray-400 hover:text-gray-600">← Back</button>
            )}
          </div>
          <div className="text-center my-2">
            <span className="text-8xl font-extrabold text-blue-600">{dcTags.length}</span>
            <span className="text-5xl font-bold text-gray-300"> / </span>
            <span className="text-8xl font-extrabold text-gray-400">{dcCountNum}</span>
          </div>
          <TagScanner onScan={handleDcScan} placeholder="Scan D/C RFID tag..." autoFocus={step === STEPS.DC_SCAN} disabled={step !== STEPS.DC_SCAN} />
          {dcTags.length > 0 && (
            <div className="mt-3 space-y-1">
              {dcTags.map((tag, i) => (
                <div key={i} className="flex items-center justify-between bg-blue-50 px-3 py-1 rounded text-sm font-mono text-blue-800">
                  <span>{i + 1}. {tag}</span>
                  {step === STEPS.DC_SCAN && (
                    <button onClick={() => setDcTags(prev => prev.filter(t => t !== tag))} className="text-red-400 hover:text-red-600 ml-2 font-bold">✕</button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 셔츠 수량 */}
      {(step === STEPS.SHIRT_COUNT || step === STEPS.SHIRT_SCAN || shirtCount !== '') && (
        <div className={step === STEPS.SHIRT_COUNT ? activeCard : inactiveCard}>
          <div className="flex justify-between items-center mb-2">
            <div className={labelClass}>Shirt Count</div>
            {step === STEPS.SHIRT_COUNT && (
              <button onClick={goBack} className="text-xs text-gray-400 hover:text-gray-600">← Back</button>
            )}
          </div>
          <input
            ref={shirtCountRef}
            type="number"
            min="0" max="99"
            value={shirtCount}
            onChange={e => setShirtCount(e.target.value)}
            onKeyDown={handleShirtCountKey}
            placeholder="0"
            disabled={step !== STEPS.SHIRT_COUNT}
            className={step === STEPS.SHIRT_COUNT ? activeInput : disabledInput}
          />
        </div>
      )}

      {/* 셔츠 스캔 */}
      {(step === STEPS.SHIRT_SCAN || shirtTags.length > 0) && (
        <div className={step === STEPS.SHIRT_SCAN ? activeCard : inactiveCard}>
          <div className="flex justify-between items-center mb-2">
            <div className={labelClass}>Scan Shirt Tags</div>
            {step === STEPS.SHIRT_SCAN && (
              <button onClick={goBack} className="text-xs text-gray-400 hover:text-gray-600">← Back</button>
            )}
          </div>
          <div className="text-center my-2">
            <span className="text-8xl font-extrabold text-green-600">{shirtTags.length}</span>
            <span className="text-5xl font-bold text-gray-300"> / </span>
            <span className="text-8xl font-extrabold text-gray-400">{shirtCountNum}</span>
          </div>
          <TagScanner onScan={handleShirtScan} placeholder="Scan shirt RFID tag..." autoFocus={step === STEPS.SHIRT_SCAN} disabled={step !== STEPS.SHIRT_SCAN} />
          {shirtTags.length > 0 && (
            <div className="mt-3 space-y-1">
              {shirtTags.map((tag, i) => (
                <div key={i} className="flex items-center justify-between bg-green-50 px-3 py-1 rounded text-sm font-mono text-green-800">
                  <span>{i + 1}. {tag}</span>
                  {step === STEPS.SHIRT_SCAN && (
                    <button onClick={() => setShirtTags(prev => prev.filter(t => t !== tag))} className="text-red-400 hover:text-red-600 ml-2 font-bold">✕</button>
                  )}
                </div>
              ))}
            </div>
          )}
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
