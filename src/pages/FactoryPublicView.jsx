import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import {
  collection, query, where, onSnapshot, doc, getDoc, updateDoc,
  orderBy, arrayUnion, Timestamp
} from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { signInAnonymously } from 'firebase/auth'
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
  const [ready, setReady] = useState(false)
  const myName = 'Factory'

  // depotUid 저장 (PWA 홈화면 열기 시 리다이렉트용)
  useEffect(() => {
    if (depotUid) localStorage.setItem('factoryViewUid', depotUid)
  }, [depotUid])

  // 익명 로그인 완료 후 ready
  useEffect(() => {
    const init = async () => {
      if (!auth.currentUser) {
        await signInAnonymously(auth).catch(() => {})
      }
      setReady(true)
    }
    init()
  }, [])

  // 디포 이름 조회
  useEffect(() => {
    if (!ready || !depotUid) return
    getDoc(doc(db, 'shops', depotUid)).then(snap => {
      if (snap.exists()) setDepotName(snap.data().name)
    }).catch(() => {})
  }, [ready, depotUid])

  // 실시간 리스너
  useEffect(() => {
    if (!ready || !depotUid) return
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
  }, [ready, depotUid])

  function handleClose() {
    window.close()
    setTimeout(() => {
      document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;color:#999"><p>You can close this tab now.</p></div>'
    }, 300)
  }

  const activeReports = reports.filter(r => r.status !== 'resolved')

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col">
      {/* 헤더 */}
      <header className="sticky top-0 z-10 px-4 py-2.5" style={{ background: '#18181B' }}>
        <div className="flex items-center gap-2.5 max-w-lg mx-auto">
          <img src={logo} alt="RFID Laundry" className="h-8 w-auto" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white truncate">
              {depotName || 'Missing Items'}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="text-[11px] font-medium px-2 py-1 rounded border border-white/20 text-white/50 hover:bg-white/10 flex-shrink-0"
          >
            Close
          </button>
        </div>
      </header>

      {/* 컨텐츠 */}
      <main className="flex-1 px-3 py-3 max-w-lg w-full mx-auto space-y-3">
        <div className="flex items-baseline justify-between">
          <p className="text-sm font-bold text-zinc-800">Missing Items</p>
          <span className="text-[11px] text-zinc-400">{activeReports.length} active</span>
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
  const [expanded, setExpanded] = useState(false)

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
    } catch (err) {
      console.error('Comment error:', err)
      setError(err.message || 'Failed to add comment')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-xl overflow-hidden border border-zinc-200 shadow-sm">
      {/* 사진 — 탭하면 확대/축소 */}
      {report.photoUrls?.length > 0 && (
        <div
          className="bg-zinc-100 cursor-pointer"
          onClick={() => setExpanded(!expanded)}
        >
          {report.photoUrls.map((url, i) => (
            <img
              key={i}
              src={url}
              alt=""
              className={`w-full transition-all ${
                expanded ? 'max-h-[70vh] object-contain bg-black' : 'max-h-52 object-cover'
              }`}
            />
          ))}
        </div>
      )}

      {/* 정보 + 코멘트 */}
      <div className="px-3 py-2.5 space-y-2">
        {/* 상태 + 디포명 + 날짜 */}
        <p className="text-xs text-zinc-500">
          <span className={`inline-block px-1.5 py-0.5 rounded font-semibold mr-1 ${STATUS_COLORS[report.status] || 'bg-zinc-100 text-zinc-500'}`}>
            {report.status}
          </span>
          {depotName && <>from <span className="font-medium text-zinc-700">{depotName}</span> · </>}
          {daysAgo(report.createdAt)}
        </p>

        {/* 설명 */}
        {report.description && (
          <p className="text-sm text-zinc-700">{report.description}</p>
        )}

        {/* 코멘트 목록 */}
        {report.comments?.length > 0 && (
          <div className="space-y-1.5">
            {report.comments.map((c, i) => (
              <div key={i} className="bg-blue-50 rounded-lg px-2.5 py-1.5">
                <p className="text-sm text-zinc-700">{c.text}</p>
                <p className="text-[10px] text-zinc-400 mt-0.5">
                  {c.authorName} · {c.createdAt ? c.createdAt.toDate().toLocaleDateString('en-CA') : ''}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* 코멘트 입력 */}
        {report.status !== 'resolved' && (
          <div className="flex gap-2">
            <input
              type="text"
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Reply..."
              className="flex-1 min-w-0 px-2.5 py-2 rounded-lg border border-zinc-200 text-sm focus:border-[#2563EB] focus:outline-none"
              onKeyDown={e => { if (e.key === 'Enter' && !saving) handleAddComment() }}
            />
            <button
              onClick={handleAddComment}
              disabled={saving || !comment.trim()}
              className="px-4 py-2 rounded-lg bg-[#2563EB] text-white text-xs font-bold disabled:opacity-40 flex-shrink-0"
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
