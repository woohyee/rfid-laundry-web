import { useState } from 'react'
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/context/AuthContext'
import TagScanner from '@/components/TagScanner'
import ErrorBanner from '@/components/ErrorBanner'

const DAY_COLORS = {
  MON: '#3B82F6',
  TUE: '#8B5CF6',
  WED: '#10B981',
  THU: '#F59E0B',
  FRI: '#EF4444',
  SAT: '#EC4899',
}

export default function DayCheck() {
  const { user } = useAuth()
  const [result, setResult] = useState(null) // { invoiceNo, dueDay, invoiceId }
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  async function handleScan(tagId) {
    setError(null)
    setResult(null)
    try {
      const q = query(
        collection(db, 'invoices'),
        where('shopId', '==', user.uid),
        where('status', '==', 'pending')
      )
      const snapshot = await getDocs(q)

      let found = null
      for (const docSnap of snapshot.docs) {
        const data = docSnap.data()
        if (data.shirtTags?.includes(tagId) || data.dcTags?.includes(tagId)) {
          found = { invoiceNo: data.invoiceNo, dueDay: data.dueDay || null, invoiceId: docSnap.id }
          break
        }
      }

      if (!found) {
        setError(`Tag ${tagId} not found.`)
        return
      }

      setResult(found)
    } catch (e) {
      setError('Lookup failed: ' + e.message)
    }
  }

  async function handleDaySelect(day) {
    if (!result?.invoiceId) return
    setSaving(true)
    try {
      await updateDoc(doc(db, 'invoices', result.invoiceId), { dueDay: day })
      setResult(prev => ({ ...prev, dueDay: day }))
      setTimeout(() => setResult(null), 1000)
    } catch (e) {
      setError('Save failed: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  const dayColor = result?.dueDay ? (DAY_COLORS[result.dueDay] || '#6B7280') : '#E07B0F'

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <ErrorBanner message={error} onClose={() => setError(null)} />

      <TagScanner
        onScan={handleScan}
        placeholder="Scan RFID tag..."
        autoFocus={true}
      />

      {result && (
        <div className="rounded-xl bg-white shadow-md border border-[#E4E2DC] p-8 text-center">
          <div className="text-5xl font-extrabold font-mono text-gray-900 tracking-tight">
            {result.invoiceNo}
          </div>

          {result.dueDay ? (
            <div
              className="text-4xl font-extrabold font-mono mt-2"
              style={{ color: dayColor }}
            >
              {result.dueDay}
            </div>
          ) : (
            <div className="mt-4">
              <div className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">
                Select Due Day
              </div>
              <div className="flex gap-2 flex-wrap justify-center">
                {['MON','TUE','WED','THU','FRI','SAT'].map(day => (
                  <button
                    key={day}
                    onClick={() => handleDaySelect(day)}
                    disabled={saving}
                    className="flex-1 min-w-[60px] py-3 rounded-lg text-xl font-bold border-2 border-[#E4E2DC] hover:border-[#E07B0F] hover:text-[#E07B0F] transition-colors disabled:opacity-50"
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
