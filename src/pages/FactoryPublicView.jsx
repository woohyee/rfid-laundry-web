import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import {
  collection, query, where, onSnapshot, doc, getDoc, updateDoc,
  orderBy, arrayUnion, Timestamp
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import logo from '@/assets/logo.png'

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

export default function FactoryPublicView() {
  const { depotUid } = useParams()
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [depotName, setDepotName] = useState('')
  const myName = 'Factory'

  // 디포 이름 조회
  useEffect(() => {
    if (!depotUid) return
    getDoc(doc(db, 'shops', depotUid)).then(snap => {
      if (snap.exists()) setDepotName(snap.data().name)
    }).catch(() => {})
  }, [depotUid])

  // 실시간 리스너
  useEffect(() => {
    if (!depotUid) return
    const q = query(
      collection(db, 'lostReports'),
      where('depotUid', '==', depotUid),
      orderBy('createdAt', 'desc')
    )
    const unsubscribe = onSnapshot(q, (snap) => {
      setReports(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
    return unsubscribe
  }, [depotUid])

  function handleClose() {
    window.close()
    setTimeout(() => {
      document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;color:#999"><p>You can close this tab now.</p></div>'
    }, 300)
  }

  const activeReports = reports.filter(r => r.status !== 'resolved')

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* 헤더 */}
      <header className="px-4 sm:px-10 py-3" style={{ background: '#18181B' }}>
        <div className="flex items-center gap-3">
          <img src={logo} alt="RFID Laundry" className="h-10 w-auto" />
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold truncate" style={{ color: '#FAFAFA' }}>
              {depotName || 'Missing Items'}
            </h1>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>Missing Items Report</p>
          </div>
          <button
            onClick={handleClose}
            className="text-[11px] font-bold px-2 py-1 rounded-lg border border-white/20 text-white/60 hover:bg-white/10 flex-shrink-0"
          >
            Close
          </button>
        </div>
      </header>

      {/* 컨텐츠 */}
      <main className="flex-1 p-4 sm:p-10 max-w-2xl w-full mx-auto space-y-3">
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
                depotName={depotName}
                myName={myName}
                myName={myName}
              />
            ))}
          </div>
        )}
      </main>

    </div>
  )
}

function ReportCard({ report, depotName, myName }) {
  const [comment, setComment] = useState('')
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
          authorUid: 'factory',
          authorName: myName,
          text: comment.trim(),
          createdAt: Timestamp.now(),
        })
      })
      setComment('')
    } catch {
      setError('Failed to add comment')
    } finally {
      setSaving(false)
    }
  }


  return (
    <div className="bg-white rounded-xl overflow-hidden border border-zinc-200">
      {/* 사진 */}
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

        {/* 코멘트 입력 — 항상 표시 */}
        {report.status !== 'resolved' && (
          <div className="flex gap-1.5">
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
