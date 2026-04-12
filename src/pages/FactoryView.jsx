import { useState, useEffect, useCallback } from 'react'
import {
  collection, query, getDocs, doc, updateDoc,
  orderBy, arrayUnion, Timestamp
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/context/AuthContext'

const STATUS_COLORS = {
  reported: 'bg-blue-100 text-blue-700',
  searching: 'bg-yellow-100 text-yellow-700',
  found: 'bg-green-100 text-green-700',
  resolved: 'bg-zinc-100 text-zinc-500',
}

function daysAgo(createdAt) {
  if (!createdAt) return ''
  const days = Math.floor((Date.now() - createdAt.toDate().getTime()) / (1000 * 60 * 60 * 24))
  if (days === 0) return 'Today'
  if (days === 1) return '1 day ago'
  return `${days} days ago`
}

export default function FactoryView() {
  const { user, shop } = useAuth()
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchReports = useCallback(async () => {
    setLoading(true)
    // 1:1 하드코딩 — 모든 lostReports 조회 (필터 없음)
    const q = query(
      collection(db, 'lostReports'),
      orderBy('createdAt', 'desc')
    )
    const snap = await getDocs(q)
    setReports(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    setLoading(false)
  }, [])

  useEffect(() => { fetchReports() }, [fetchReports])

  // resolved 제외한 활성 리포트
  const activeReports = reports.filter(r => r.status !== 'resolved')
  const resolvedReports = reports.filter(r => r.status === 'resolved')

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-zinc-800">Missing Items</h2>
      <p className="text-sm text-zinc-500">{activeReports.length} active reports</p>

      {loading ? (
        <p className="text-zinc-400">Loading...</p>
      ) : activeReports.length === 0 ? (
        <p className="text-zinc-400 text-center py-10">No missing item reports</p>
      ) : (
        <div className="space-y-4">
          {activeReports.map(report => (
            <ReportCard
              key={report.id}
              report={report}
              factoryUid={user.uid}
              factoryName={shop?.name || 'Factory'}
              onUpdate={fetchReports}
            />
          ))}
        </div>
      )}

      {/* Resolved */}
      {resolvedReports.length > 0 && (
        <details className="mt-6">
          <summary className="text-sm text-zinc-400 cursor-pointer">
            {resolvedReports.length} resolved
          </summary>
          <div className="space-y-3 mt-3 opacity-60">
            {resolvedReports.map(report => (
              <ReportCard
                key={report.id}
                report={report}
                factoryUid={user.uid}
                factoryName={shop?.name || 'Factory'}
                onUpdate={fetchReports}
              />
            ))}
          </div>
        </details>
      )}
    </div>
  )
}

function ReportCard({ report, factoryUid, factoryName, onUpdate }) {
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleAddComment() {
    if (!comment.trim()) return
    setSaving(true)
    setError('')
    try {
      await updateDoc(doc(db, 'lostReports', report.id), {
        comments: arrayUnion({
          authorUid: factoryUid,
          authorName: factoryName,
          text: comment.trim(),
          createdAt: Timestamp.now(),
        })
      })
      setComment('')
      onUpdate()
    } catch {
      setError('Failed to add comment')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-xl p-4 border border-zinc-200">
      {/* 사진 — 모바일 최적화 */}
      {report.photoUrls?.length > 0 && (
        <div className="flex gap-2 mb-3 overflow-x-auto">
          {report.photoUrls.map((url, i) => (
            <img key={i} src={url} alt="" className="w-24 h-24 sm:w-32 sm:h-32 object-cover rounded-lg flex-shrink-0" />
          ))}
        </div>
      )}

      {/* 상태 + 날짜 */}
      <div className="flex items-center gap-2 mb-1">
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[report.status] || 'bg-zinc-100 text-zinc-500'}`}>
          {report.status}
        </span>
        <span className="text-xs text-zinc-400">{daysAgo(report.createdAt)}</span>
      </div>

      {/* 설명 */}
      {report.description && (
        <p className="text-sm text-zinc-600 mt-1">{report.description}</p>
      )}

      {/* 기존 코멘트 */}
      {report.comments?.length > 0 && (
        <div className="mt-3 space-y-1">
          {report.comments.map((c, i) => (
            <div key={i} className="bg-blue-50 rounded-lg px-3 py-2">
              <p className="text-sm text-zinc-700">{c.text}</p>
              <p className="text-xs text-zinc-400 mt-0.5">
                {c.authorName} {c.createdAt ? `— ${c.createdAt.toDate().toLocaleDateString('en-CA')}` : ''}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* 코멘트 입력 — resolved가 아닌 경우만 */}
      {report.status !== 'resolved' && (
        <div className="mt-3 flex gap-2">
          <input
            type="text"
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Add a comment..."
            className="flex-1 px-3 py-2 rounded-lg border border-zinc-300 text-sm focus:border-[#2563EB] focus:outline-none"
            onKeyDown={e => { if (e.key === 'Enter' && !saving) handleAddComment() }}
          />
          <button
            onClick={handleAddComment}
            disabled={saving || !comment.trim()}
            className="px-4 py-2 rounded-lg bg-[#2563EB] text-white text-sm font-bold disabled:opacity-50"
          >
            {saving ? '...' : 'Send'}
          </button>
        </div>
      )}
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  )
}
