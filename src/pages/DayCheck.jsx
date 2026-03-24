import { useState } from 'react'
import { collection, query, where, getDocs } from 'firebase/firestore'
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
  const [result, setResult] = useState(null) // { invoiceNo, dueDay }
  const [error, setError] = useState(null)

  async function handleScan(tagId) {
    setError(null)
    try {
      const q = query(
        collection(db, 'invoices'),
        where('shopId', '==', user.uid)
      )
      const snapshot = await getDocs(q)

      let found = null
      for (const docSnap of snapshot.docs) {
        const data = docSnap.data()
        if (data.shirtTags?.includes(tagId) || data.dcTags?.includes(tagId)) {
          found = { invoiceNo: data.invoiceNo, dueDay: data.dueDay || '—' }
          break
        }
      }

      if (!found) {
        setError(`Tag ${tagId} not found.`)
        setResult(null)
        return
      }

      setResult(found)
    } catch (e) {
      setError('Lookup failed: ' + e.message)
    }
  }

  const dayColor = result ? (DAY_COLORS[result.dueDay] || '#6B7280') : '#E07B0F'

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
          <div
            className="text-8xl font-extrabold font-mono mt-2"
            style={{ color: dayColor }}
          >
            {result.dueDay}
          </div>
        </div>
      )}
    </div>
  )
}
