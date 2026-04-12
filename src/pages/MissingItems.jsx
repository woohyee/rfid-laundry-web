import { useState, useEffect, useCallback } from 'react'
import {
  collection, query, where, onSnapshot, addDoc, doc, updateDoc, deleteDoc,
  serverTimestamp, orderBy
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { uploadPhoto } from '@/lib/storage'
import { useAuth } from '@/context/AuthContext'
import PhotoUpload from '@/components/PhotoUpload'

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

export default function MissingItems() {
  const { user, shop } = useAuth()
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  // 실시간 리스너 — 공장 코멘트 즉시 반영
  useEffect(() => {
    const q = query(
      collection(db, 'lostReports'),
      where('depotUid', '==', user.uid),
      orderBy('createdAt', 'desc')
    )
    const unsubscribe = onSnapshot(q, (snap) => {
      setReports(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
    return unsubscribe
  }, [user.uid])

  // 수동 리프레시용 (삭제/업데이트 후 호출)
  const refreshReports = useCallback(() => {}, [])

  const shareUrl = `${window.location.origin}/view/${user.uid}`
  const [copied, setCopied] = useState(false)
  const [showQR, setShowQR] = useState(false)

  function handleCopyLink() {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="space-y-4">
      {/* 공유 링크 */}
      <div className="bg-blue-50 rounded-xl p-3 flex items-center gap-2">
        <p className="text-xs text-blue-700 flex-1 min-w-0 truncate">
          Factory link: <span className="font-mono">{shareUrl}</span>
        </p>
        <button
          onClick={handleCopyLink}
          className="text-xs font-bold text-blue-700 px-2 py-1 rounded bg-blue-100 flex-shrink-0"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
        <button
          onClick={() => setShowQR(!showQR)}
          className="text-xs font-bold text-blue-700 px-2 py-1 rounded bg-blue-100 flex-shrink-0"
        >
          QR
        </button>
      </div>

      {/* QR 코드 */}
      {showQR && (
        <div className="flex justify-center py-2">
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(shareUrl)}`}
            alt="QR Code"
            className="w-48 h-48 rounded-lg border border-zinc-200"
          />
        </div>
      )}

      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">{reports.length} reports</p>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 rounded-lg bg-[#E07B0F] text-white text-sm font-bold"
        >
          + Report Missing
        </button>
      </div>

      {/* 리포트 목록 */}
      {loading ? (
        <p className="text-zinc-400">Loading...</p>
      ) : reports.length === 0 ? (
        <p className="text-zinc-400 text-center py-10">No missing item reports yet</p>
      ) : (
        <div className="space-y-3">
          {reports.map(report => (
            <ReportCard key={report.id} report={report} onUpdate={refreshReports} />
          ))}
        </div>
      )}

      {/* 신고 폼 모달 */}
      {showForm && (
        <NewReportForm
          uid={user.uid}
          shopName={shop?.name || ''}
          onClose={() => setShowForm(false)}
          onAdded={refreshReports}
        />
      )}
    </div>
  )
}

// 리포트 카드 — 사진 + 상태 + 공장 코멘트 + 삭제
function ReportCard({ report, onUpdate }) {
  const [confirmDelete, setConfirmDelete] = useState(false)

  async function handleDelete() {
    await deleteDoc(doc(db, 'lostReports', report.id))
    onUpdate()
  }

  return (
    <div className={`bg-white rounded-xl p-4 border border-zinc-200 ${report.status === 'resolved' ? 'opacity-60' : ''}`}>
      {/* 사진 */}
      {report.photoUrls?.length > 0 && (
        <div className="flex gap-2 mb-3 overflow-x-auto">
          {report.photoUrls.map((url, i) => (
            <img key={i} src={url} alt="" className="w-20 h-20 sm:w-24 sm:h-24 object-cover rounded-lg flex-shrink-0" />
          ))}
        </div>
      )}

      {/* 상태 + 날짜 + 삭제 */}
      <div className="flex items-center gap-2 mb-1">
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[report.status] || 'bg-zinc-100 text-zinc-500'}`}>
          {report.status}
        </span>
        <span className="text-xs text-zinc-400">{daysAgo(report.createdAt)}</span>
        <button
          onClick={() => setConfirmDelete(true)}
          className="ml-auto text-xs text-zinc-300 hover:text-red-500"
        >
          Delete
        </button>
      </div>

      {/* 삭제 확인 */}
      {confirmDelete && (
        <div className="flex items-center gap-2 mt-2 p-2 bg-red-50 rounded-lg">
          <p className="text-xs text-red-600 flex-1">Delete this report?</p>
          <button onClick={handleDelete} className="text-xs font-bold text-red-600 px-2 py-1">Yes</button>
          <button onClick={() => setConfirmDelete(false)} className="text-xs text-zinc-500 px-2 py-1">No</button>
        </div>
      )}

      {/* 설명 */}
      {report.description && (
        <p className="text-sm text-zinc-600 mt-1">{report.description}</p>
      )}

      {/* 공장 코멘트 */}
      {report.comments?.length > 0 && (
        <div className="mt-3 border-t border-zinc-100 pt-2 space-y-1">
          <p className="text-xs font-semibold text-zinc-500">Factory Comments</p>
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

    </div>
  )
}

// 신고 폼 — 사진(필수) + 설명(선택)
function NewReportForm({ uid, shopName, onClose, onAdded }) {
  const [photos, setPhotos] = useState([])
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (photos.length === 0) {
      setError('Please add at least one photo')
      return
    }

    setSaving(true)
    setError('')
    try {
      // lostReport 생성
      const reportRef = await addDoc(collection(db, 'lostReports'), {
        depotUid: uid,
        photoUrls: [],
        description: description.trim(),
        status: 'reported',
        createdAt: serverTimestamp(),
        comments: [],
      })

      // 사진 업로드 (Cloudinary)
      const photoUrls = []
      for (let i = 0; i < photos.length; i++) {
        const url = await uploadPhoto(`lostReports/${reportRef.id}`, photos[i])
        photoUrls.push(url)
      }
      await updateDoc(doc(db, 'lostReports', reportRef.id), { photoUrls })

      onAdded()
      onClose()
    } catch (err) {
      console.error('Report submit error:', err)
      setError(err.message || 'Failed to submit report')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl p-4 sm:p-6 w-full sm:max-w-md max-h-[85vh] overflow-y-auto">
        <h3 className="text-base font-bold mb-3">Report Missing Item</h3>

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* 사진 (필수) */}
          <div>
            <label className="block text-xs font-semibold mb-1">
              Photos <span className="text-red-500">*</span>
            </label>
            <PhotoUpload photos={photos} onChange={setPhotos} />
          </div>

          {/* 설명 (선택) */}
          <div>
            <label className="block text-xs font-semibold mb-1">
              Description <span className="text-zinc-400">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Describe the missing item"
              rows={2}
              className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 focus:border-[#E07B0F] focus:outline-none"
            />
          </div>

          {error && <p className="text-red-500 text-xs">{error}</p>}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-zinc-300 text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-[#E07B0F] text-white text-sm font-bold disabled:opacity-50"
            >
              {saving ? 'Submitting...' : 'Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
