import { useState, useEffect } from 'react'
import {
  collection, query, onSnapshot, doc, getDoc, updateDoc,
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
  const [depotNames, setDepotNames] = useState({})

  // 실시간 리스너
  useEffect(() => {
    const q = query(
      collection(db, 'lostReports'),
      orderBy('createdAt', 'desc')
    )
    const unsubscribe = onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setReports(list)
      setLoading(false)

      // 디포 이름 1회 조회 (캐시)
      const unknownUids = [...new Set(list.map(r => r.depotUid).filter(uid => uid && !depotNames[uid]))]
      unknownUids.forEach(uid => {
        getDoc(doc(db, 'shops', uid)).then(snap => {
          if (snap.exists()) {
            setDepotNames(prev => ({ ...prev, [uid]: snap.data().name }))
          }
        }).catch(() => {})
      })
    })
    return unsubscribe
  }, [])

  const activeReports = reports.filter(r => r.status !== 'resolved')
  const resolvedReports = reports.filter(r => r.status === 'resolved')

  return (
    <div className="space-y-3">
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
              depotName={depotNames[report.depotUid] || ''}
              factoryUid={user.uid}
              factoryName={shop?.name || 'Factory'}
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
                depotName={depotNames[report.depotUid] || ''}
                factoryUid={user.uid}
                factoryName={shop?.name || 'Factory'}
              />
            ))}
          </div>
        </details>
      )}
    </div>
  )
}

function ReportCard({ report, depotName, factoryUid, factoryName }) {
  const [comment, setComment] = useState('')
  const [showReply, setShowReply] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [expandedImg, setExpandedImg] = useState(null)

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
      setShowReply(false)
    } catch {
      setError('Failed to add comment')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-xl overflow-hidden border border-zinc-200">
      {/* 사진 — 탭하면 카드 내 확대 */}
      {report.photoUrls?.length > 0 && (
        <div className="bg-zinc-50">
          {report.photoUrls.map((url, i) => (
            <img
              key={i}
              src={url}
              alt=""
              className={`w-full object-cover cursor-pointer active:opacity-80 transition-all ${
                expandedImg === url ? 'max-h-[70vh] object-contain bg-black' : 'max-h-48'
              }`}
              onClick={() => setExpandedImg(expandedImg === url ? null : url)}
            />
          ))}
        </div>
      )}

      <div className="p-3 space-y-2">
        {/* 상태 + 세탁소 이름 + 날짜 */}
        <div>
          <p className="text-xs text-zinc-500">
            <span className={`inline-block px-1.5 py-0.5 rounded font-semibold mr-1 ${STATUS_COLORS[report.status] || 'bg-zinc-100 text-zinc-500'}`}>
              {report.status}
            </span>
            {depotName && <span>from <span className="font-medium text-zinc-700">{depotName}</span> · </span>}
            {daysAgo(report.createdAt)}
          </p>
          {report.description && (
            <p className="text-sm text-zinc-700 mt-1">{report.description}</p>
          )}
        </div>

        {/* 코멘트 목록 */}
        {report.comments?.length > 0 && (
          <div className="space-y-1.5">
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

        {/* Reply 버튼 또는 입력창 */}
        {report.status !== 'resolved' && (
          showReply ? (
            <div className="flex gap-1.5">
              <input
                type="text"
                value={comment}
                onChange={e => setComment(e.target.value)}
                placeholder="Reply..."
                autoFocus
                className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg border border-zinc-200 text-sm focus:border-[#2563EB] focus:outline-none"
                onKeyDown={e => {
                  if (e.key === 'Enter' && !saving) handleAddComment()
                  if (e.key === 'Escape') { setShowReply(false); setComment('') }
                }}
              />
              <button
                onClick={handleAddComment}
                disabled={saving || !comment.trim()}
                className="px-3 py-1.5 rounded-lg bg-[#2563EB] text-white text-xs font-bold disabled:opacity-40 flex-shrink-0"
              >
                {saving ? '...' : 'Send'}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowReply(true)}
              className="text-xs text-[#2563EB] font-medium"
            >
              Reply
            </button>
          )
        )}
        {error && <p className="text-red-500 text-[11px] mt-1">{error}</p>}
      </div>
    </div>
  )
}
