import { useState, useEffect, useCallback } from 'react'
import {
  collection, query, onSnapshot, doc, updateDoc,
  orderBy, arrayUnion, Timestamp
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/context/AuthContext'

const STATUS_COLORS = {
  reported: 'bg-orange-100 text-orange-700',
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

  // 실시간 리스너 — 디포 리포트 즉시 반영
  useEffect(() => {
    const q = query(
      collection(db, 'lostReports'),
      orderBy('createdAt', 'desc')
    )
    const unsubscribe = onSnapshot(q, (snap) => {
      setReports(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
    return unsubscribe
  }, [])

  const activeReports = reports.filter(r => r.status !== 'resolved')
  const resolvedReports = reports.filter(r => r.status === 'resolved')

  return (
    <div className="space-y-3">
      {/* 헤더 */}
      <div className="flex items-baseline justify-between">
        <h2 className="text-base font-bold text-zinc-800">Missing Items</h2>
        <span className="text-xs text-zinc-400">{activeReports.length} active</span>
      </div>

      {loading ? (
        <p className="text-zinc-400 text-sm text-center py-8">Loading...</p>
      ) : activeReports.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-zinc-400 text-sm">No missing item reports</p>
        </div>
      ) : (
        <div className="space-y-3">
          {activeReports.map(report => (
            <ReportCard
              key={report.id}
              report={report}
              factoryUid={user.uid}
              factoryName={shop?.name || 'Factory'}
              onUpdate={() => {}}
            />
          ))}
        </div>
      )}

      {resolvedReports.length > 0 && (
        <details className="mt-4">
          <summary className="text-xs text-zinc-400 cursor-pointer py-2">
            {resolvedReports.length} resolved
          </summary>
          <div className="space-y-3 mt-2 opacity-50">
            {resolvedReports.map(report => (
              <ReportCard
                key={report.id}
                report={report}
                factoryUid={user.uid}
                factoryName={shop?.name || 'Factory'}
                onUpdate={() => {}}
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
  const [fullscreenImg, setFullscreenImg] = useState(null)

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
    <div className="bg-white rounded-xl overflow-hidden border border-zinc-200">
      {/* 사진 — 탭하면 전체화면 */}
      {report.photoUrls?.length > 0 && (
        <div className="flex gap-1 overflow-x-auto bg-zinc-50">
          {report.photoUrls.map((url, i) => (
            <img
              key={i}
              src={url}
              alt=""
              className="w-full max-w-[200px] h-40 object-cover flex-shrink-0 cursor-pointer active:opacity-80"
              onClick={() => setFullscreenImg(url)}
            />
          ))}
        </div>
      )}

      {/* 전체화면 오버레이 */}
      {fullscreenImg && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setFullscreenImg(null)}
        >
          <img src={fullscreenImg} alt="" className="max-w-full max-h-full object-contain rounded-lg" />
        </div>
      )}

      <div className="p-3">
        {/* 상태 + 날짜 */}
        <div className="flex items-center gap-2">
          <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${STATUS_COLORS[report.status] || 'bg-zinc-100 text-zinc-500'}`}>
            {report.status}
          </span>
          <span className="text-[11px] text-zinc-400">{daysAgo(report.createdAt)}</span>
        </div>

        {/* 설명 */}
        {report.description && (
          <p className="text-sm text-zinc-700 mt-1.5">{report.description}</p>
        )}

        {/* 코멘트 목록 */}
        {report.comments?.length > 0 && (
          <div className="mt-2 space-y-1.5">
            {report.comments.map((c, i) => (
              <div key={i} className="bg-blue-50 rounded-lg px-2.5 py-1.5">
                <p className="text-sm text-zinc-700">{c.text}</p>
                <p className="text-[10px] text-zinc-400 mt-0.5">
                  {c.authorName} {c.createdAt ? `\u00b7 ${c.createdAt.toDate().toLocaleDateString('en-CA')}` : ''}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* 코멘트 입력 */}
        {report.status !== 'resolved' && (
          <div className="mt-2 flex gap-1.5">
            <input
              type="text"
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Reply..."
              className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg border border-zinc-200 text-sm focus:border-[#2563EB] focus:outline-none"
              onKeyDown={e => { if (e.key === 'Enter' && !saving) handleAddComment() }}
            />
            <button
              onClick={handleAddComment}
              disabled={saving || !comment.trim()}
              className="px-3 py-1.5 rounded-lg bg-[#2563EB] text-white text-xs font-bold disabled:opacity-40 flex-shrink-0"
            >
              {saving ? '...' : 'Send'}
            </button>
          </div>
        )}
        {error && <p className="text-red-500 text-[11px] mt-1">{error}</p>}
      </div>
    </div>
  )
}
