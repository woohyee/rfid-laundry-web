import { useState, useRef, useEffect } from 'react'
import { collection, addDoc, getDocs, query, where, serverTimestamp, doc, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/context/AuthContext'
import TagScanner from '@/components/TagScanner'
import ErrorBanner from '@/components/ErrorBanner'

const STEPS = {
  INVOICE: 'invoice',
  DUE_DAY: 'dueDay',
  SHIRT_COUNT: 'shirtCount',
  SHIRT_SCAN: 'shirtScan',
  DC_COUNT: 'dcCount',
  DC_SCAN: 'dcScan'
}

// 단계 순서 (비교용)
const STEP_ORDER = [STEPS.INVOICE, STEPS.DUE_DAY, STEPS.SHIRT_COUNT, STEPS.SHIRT_SCAN, STEPS.DC_COUNT, STEPS.DC_SCAN]
function stepIndex(s) { return STEP_ORDER.indexOf(s) }
function stepGte(a, b) { return stepIndex(a) >= stepIndex(b) }
function stepGt(a, b) { return stepIndex(a) > stepIndex(b) }

function looksLikeTagId(val) {
  return /^\d{6,}$/.test(val.trim())
}

export default function Tagging() {
  const { user } = useAuth()
  const [step, setStep] = useState(STEPS.INVOICE)
  const [invoiceNo, setInvoiceNo] = useState('')
  const [shirtCount, setShirtCount] = useState('')
  const [dcCount, setDcCount] = useState('')
  const [shirtTags, setShirtTags] = useState([])
  const [dcTags, setDcTags] = useState([])
  const [editingTag, setEditingTag] = useState(null) // { type: 'shirt'|'dc', index: number, value: string }
  const [toast, setToast] = useState(null)
  const [dueDay, setDueDay] = useState('')
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [dayFillMode, setDayFillMode] = useState(null) // { invoiceId } — 기존 인보이스 요일 입력 모드

  const invoiceRef = useRef(null)
  const shirtCountRef = useRef(null)
  const dcCountRef = useRef(null)

  useEffect(() => {
    const delay = (step === STEPS.SHIRT_COUNT || step === STEPS.DC_COUNT) ? 500 : 50
    const t = setTimeout(() => {
      if (step === STEPS.INVOICE) invoiceRef.current?.focus()
      if (step === STEPS.SHIRT_COUNT) shirtCountRef.current?.focus()
      if (step === STEPS.DC_COUNT) dcCountRef.current?.focus()
    }, delay)
    return () => clearTimeout(t)
  }, [step])

  function goBack() {
    setError(null)
    if (step === STEPS.DUE_DAY) setStep(STEPS.INVOICE)
    else if (step === STEPS.SHIRT_COUNT) setStep(STEPS.DUE_DAY)
    else if (step === STEPS.SHIRT_SCAN) { setShirtTags([]); setStep(STEPS.SHIRT_COUNT) }
    else if (step === STEPS.DC_COUNT) {
      const shirtNum = parseInt(shirtCount, 10) || 0
      setStep(shirtNum > 0 ? STEPS.SHIRT_SCAN : STEPS.SHIRT_COUNT)
    }
    else if (step === STEPS.DC_SCAN) { setDcTags([]); setStep(STEPS.DC_COUNT) }
  }

  async function handleInvoiceKey(e) {
    if (e.key !== 'Enter' || !invoiceNo.trim()) return
    // 중복 인보이스 체크
    setError(null)
    try {
      const q = query(
        collection(db, 'invoices'),
        where('shopId', '==', user.uid),
        where('invoiceNo', '==', invoiceNo.trim())
      )
      const snap = await getDocs(q)
      if (!snap.empty) {
        const existing = snap.docs[0]
        const existingData = existing.data()
        if (!existingData.dueDay) {
          // 요일만 없는 기존 인보이스 → 요일 입력 모드
          setError(null)
          setDayFillMode({ invoiceId: existing.id })
          return
        }
        setError(`Invoice #${invoiceNo.trim()} already exists. Please check the invoice number.`)
        return
      }
    } catch (e) {
      setError('Check failed: ' + e.message)
      return
    }
    setStep(STEPS.DUE_DAY)
  }

  function handleDueDaySelect(day) {
    setDueDay(day)
    setStep(STEPS.SHIRT_COUNT)
  }

  async function handleDayFillSelect(day) {
    if (!dayFillMode?.invoiceId) return
    setSaving(true)
    try {
      await updateDoc(doc(db, 'invoices', dayFillMode.invoiceId), { dueDay: day })
      showToast(`#${invoiceNo.trim()} → ${day}`)
      setDayFillMode(null)
      setInvoiceNo('')
      invoiceRef.current?.focus()
    } catch (e) {
      setError('Save failed: ' + e.message)
    } finally {
      setSaving(false)
    }
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
    else setStep(STEPS.DC_COUNT)
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
    else {
      if (shirtTags.length === 0) resetAll()
      else saveInvoice(shirtTags, [])
    }
  }

  function handleShirtScan(tagId) {
    if (shirtTags.includes(tagId) || dcTags.includes(tagId)) return
    const newShirtTags = [...shirtTags, tagId]
    setShirtTags(newShirtTags)
    if (newShirtTags.length >= parseInt(shirtCount, 10)) setStep(STEPS.DC_COUNT)
  }

  function handleDcScan(tagId) {
    if (dcTags.includes(tagId) || shirtTags.includes(tagId)) return
    const newDcTags = [...dcTags, tagId]
    setDcTags(newDcTags)
    if (newDcTags.length >= parseInt(dcCount, 10)) saveInvoice(shirtTags, newDcTags)
  }

  // 태그 인라인 편집 확정
  function commitEdit() {
    if (!editingTag) return
    const newVal = editingTag.value.trim()
    if (!newVal) { setEditingTag(null); return }
    if (editingTag.type === 'shirt') {
      const others = shirtTags.filter((_, i) => i !== editingTag.index)
      if (others.includes(newVal) || dcTags.includes(newVal)) {
        setError('Duplicate tag ID.')
        setEditingTag(null)
        return
      }
      const updated = [...shirtTags]
      updated[editingTag.index] = newVal
      setShirtTags(updated)
    } else {
      const others = dcTags.filter((_, i) => i !== editingTag.index)
      if (others.includes(newVal) || shirtTags.includes(newVal)) {
        setError('Duplicate tag ID.')
        setEditingTag(null)
        return
      }
      const updated = [...dcTags]
      updated[editingTag.index] = newVal
      setDcTags(updated)
    }
    setEditingTag(null)
  }

  async function saveInvoice(finalShirtTags, finalDcTags) {
    setError(null)
    setSaving(true)
    try {
      await addDoc(collection(db, 'invoices'), {
        invoiceNo: invoiceNo.trim(),
        shopId: user.uid,
        dueDay: dueDay,
        shirtCount: parseInt(shirtCount, 10) || 0,
        dcCount: parseInt(dcCount, 10) || 0,
        status: 'pending',
        createdAt: serverTimestamp(),
        receivedAt: null,
        photoUrls: [],
        shirtTags: finalShirtTags,
        dcTags: finalDcTags,
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
    setDueDay('')
    setShirtCount('')
    setDcCount('')
    setShirtTags([])
    setDcTags([])
    setEditingTag(null)
    setError(null)
    setDayFillMode(null)
    setStep(STEPS.INVOICE)
  }

  const shirtCountNum = parseInt(shirtCount, 10) || 0
  const dcCountNum = parseInt(dcCount, 10) || 0
  const activeCard = 'rounded-xl p-4 bg-white shadow-md border-2 border-[#E07B0F]'
  const inactiveCard = 'rounded-xl p-4 bg-white border border-[#E4E2DC]'
  const activeInput = 'w-full border-2 border-[#E07B0F] rounded-lg px-4 py-3 text-2xl font-mono font-bold text-gray-900 focus:outline-none focus:border-[#C46A09] bg-white'
  const disabledInput = 'w-full border-2 border-[#E4E2DC] rounded-lg px-4 py-3 text-2xl font-mono font-bold bg-[#F7F6F3] text-gray-700 cursor-not-allowed'
  const labelClass = 'text-sm font-bold text-gray-700 uppercase tracking-wide'

  const hasData = invoiceNo || step !== STEPS.INVOICE

  // 태그 행 렌더러 (공통)
  function renderTagRow(tag, i, type, bgClass, textClass) {
    const isEditing = editingTag?.type === type && editingTag?.index === i
    return (
      <div key={i} className={`flex items-center justify-between ${bgClass} px-3 py-1 rounded text-sm font-mono ${textClass}`}>
        {isEditing ? (
          <input
            autoFocus
            value={editingTag.value}
            onChange={e => setEditingTag(prev => ({ ...prev, value: e.target.value }))}
            onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditingTag(null) }}
            onBlur={commitEdit}
            className="flex-1 bg-white border border-[#E07B0F] rounded px-2 py-0.5 font-mono text-sm text-gray-900 focus:outline-none mr-2"
          />
        ) : (
          <span className="flex-1">{i + 1}. {tag}</span>
        )}
        <div className="flex items-center gap-1 ml-2 shrink-0">
          {!isEditing && (
            <button
              onClick={() => setEditingTag({ type, index: i, value: tag })}
              className="text-gray-400 hover:text-[#E07B0F] font-bold text-base leading-none"
              title="Edit tag"
            >✎</button>
          )}
          <button
            onClick={() => {
              if (type === 'shirt') setShirtTags(prev => prev.filter((_, idx) => idx !== i))
              else setDcTags(prev => prev.filter((_, idx) => idx !== i))
              if (isEditing) setEditingTag(null)
            }}
            className="text-red-400 hover:text-red-600 font-bold"
          >✕</button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto space-y-3 relative">

      {/* Reset 버튼 */}
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
        <div className={`${labelClass} mb-2`}>Invoice #</div>
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

      {/* 기존 인보이스 요일 채우기 모드 */}
      {dayFillMode && (
        <div className={activeCard}>
          <div className={`${labelClass} mb-3`}>Select Due Day for #{invoiceNo}</div>
          <div className="flex gap-2 flex-wrap">
            {['MON','TUE','WED','THU','FRI','SAT'].map(day => (
              <button
                key={day}
                onClick={() => handleDayFillSelect(day)}
                disabled={saving}
                className="flex-1 min-w-[60px] py-3 rounded-lg text-xl font-bold border-2 border-[#E4E2DC] hover:border-[#E07B0F] hover:text-[#E07B0F] transition-colors disabled:opacity-50"
              >
                {day}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 요일 선택 */}
      {!dayFillMode && stepGte(step, STEPS.DUE_DAY) && (
        <div className={step === STEPS.DUE_DAY ? activeCard : inactiveCard}>
          <div className="flex justify-between items-center mb-3">
            <div className={labelClass}>Due Day</div>
            {step === STEPS.DUE_DAY && (
              <button onClick={goBack} className="text-xs text-gray-400 hover:text-gray-600">← Back</button>
            )}
          </div>
          {step === STEPS.DUE_DAY ? (
            <div className="flex gap-2 flex-wrap">
              {['MON','TUE','WED','THU','FRI','SAT'].map(day => (
                <button
                  key={day}
                  onClick={() => handleDueDaySelect(day)}
                  className="flex-1 min-w-[60px] py-3 rounded-lg text-xl font-bold border-2 border-[#E4E2DC] hover:border-[#E07B0F] hover:text-[#E07B0F] transition-colors"
                >
                  {day}
                </button>
              ))}
            </div>
          ) : (
            <div className={disabledInput}>{dueDay}</div>
          )}
        </div>
      )}

      {/* 셔츠 수량 */}
      {stepGte(step, STEPS.SHIRT_COUNT) && (
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
      {(step === STEPS.SHIRT_SCAN || (stepGt(step, STEPS.SHIRT_SCAN) && shirtTags.length > 0)) && (
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
              {shirtTags.map((tag, i) => renderTagRow(tag, i, 'shirt', 'bg-green-50', 'text-green-800'))}
            </div>
          )}
        </div>
      )}

      {/* D/C 수량 */}
      {stepGte(step, STEPS.DC_COUNT) && (
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
      {(step === STEPS.DC_SCAN || dcTags.length > 0) && (
        <div className={step === STEPS.DC_SCAN ? activeCard : inactiveCard}>
          <div className="flex justify-between items-center mb-2">
            <div className={labelClass}>Scan D/C Tags</div>
            {step === STEPS.DC_SCAN && (
              <button onClick={goBack} className="text-xs text-gray-400 hover:text-gray-600">← Back</button>
            )}
          </div>
          <div className="text-center my-2">
            <span className="text-8xl font-extrabold" style={{color:'#E07B0F'}}>{dcTags.length}</span>
            <span className="text-5xl font-bold text-gray-300"> / </span>
            <span className="text-8xl font-extrabold text-gray-400">{dcCountNum}</span>
          </div>
          <TagScanner onScan={handleDcScan} placeholder="Scan D/C RFID tag..." autoFocus={step === STEPS.DC_SCAN} disabled={step !== STEPS.DC_SCAN} />
          {dcTags.length > 0 && (
            <div className="mt-3 space-y-1">
              {dcTags.map((tag, i) => renderTagRow(tag, i, 'dc', 'bg-[#FEF3E2]', 'text-[#92400E]'))}
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
