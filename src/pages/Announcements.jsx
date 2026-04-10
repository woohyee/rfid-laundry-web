import { useState, useEffect, useCallback } from 'react'
import {
  collection, query, where, getDocs, addDoc, doc, deleteDoc,
  serverTimestamp, Timestamp, orderBy
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/context/AuthContext'

function formatDate(ts) {
  if (!ts) return ''
  return ts.toDate().toLocaleDateString('en-CA')
}

function daysAgo(createdAt) {
  if (!createdAt) return ''
  const days = Math.floor((Date.now() - createdAt.toDate().getTime()) / (1000 * 60 * 60 * 24))
  if (days === 0) return 'Today'
  if (days === 1) return '1 day ago'
  return `${days} days ago`
}

export default function Announcements() {
  const { user, shop } = useAuth()
  const role = shop?.role || 'depot'
  const [announcements, setAnnouncements] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [partners, setPartners] = useState([])

  // 파트너 목록 조회
  useEffect(() => {
    async function fetchPartners() {
      const field = role === 'factory' ? 'factoryUid' : 'depotUid'
      const q = query(
        collection(db, 'partnerships'),
        where(field, '==', user.uid),
        where('status', '==', 'active')
      )
      const snap = await getDocs(q)
      const list = []
      for (const d of snap.docs) {
        const data = d.data()
        const partnerUid = role === 'factory' ? data.depotUid : data.factoryUid
        const partnerSnap = await getDocs(
          query(collection(db, 'shops'), where('shopId', '==', partnerUid))
        )
        list.push({
          uid: partnerUid,
          name: partnerSnap.docs[0]?.data()?.name || 'Unknown',
        })
      }
      setPartners(list)
    }
    fetchPartners()
  }, [user.uid, role])

  const fetchAnnouncements = useCallback(async () => {
    setLoading(true)
    const results = []

    if (role === 'factory') {
      // 공장: 내가 쓴 공지 + 디포들이 보낸 메시지
      const myQ = query(
        collection(db, 'announcements'),
        where('factoryUid', '==', user.uid),
        orderBy('createdAt', 'desc')
      )
      const snap = await getDocs(myQ)
      snap.docs.forEach(d => results.push({ id: d.id, ...d.data() }))
    } else {
      // 디포: 파트너 공장 목록으로 조회
      const partnerQ = query(
        collection(db, 'partnerships'),
        where('depotUid', '==', user.uid),
        where('status', '==', 'active')
      )
      const partnerSnap = await getDocs(partnerQ)
      const factoryUids = partnerSnap.docs.map(d => d.data().factoryUid)

      // 각 공장의 공지 조회 (내가 볼 수 있는 것만)
      for (const fUid of factoryUids) {
        // 전체 공지 (scope: all, 내 uid가 partnerDepotUids에 포함)
        const allQ = query(
          collection(db, 'announcements'),
          where('factoryUid', '==', fUid),
          where('scope', '==', 'all'),
          where('partnerDepotUids', 'array-contains', user.uid),
          orderBy('createdAt', 'desc')
        )
        const allSnap = await getDocs(allQ)
        allSnap.docs.forEach(d => results.push({ id: d.id, ...d.data() }))

        // 개별 공지 (scope: direct, 나에게 온 것)
        const directQ = query(
          collection(db, 'announcements'),
          where('factoryUid', '==', fUid),
          where('scope', '==', 'direct'),
          where('targetDepotUid', '==', user.uid),
          orderBy('createdAt', 'desc')
        )
        const directSnap = await getDocs(directQ)
        directSnap.docs.forEach(d => results.push({ id: d.id, ...d.data() }))
      }

      // 내가 쓴 메시지 (디포 → 공장)
      const myQ = query(
        collection(db, 'announcements'),
        where('authorUid', '==', user.uid),
        orderBy('createdAt', 'desc')
      )
      const mySnap = await getDocs(myQ)
      mySnap.docs.forEach(d => {
        if (!results.find(r => r.id === d.id)) {
          results.push({ id: d.id, ...d.data() })
        }
      })
    }

    // 중복 제거 + 최신순
    const unique = [...new Map(results.map(r => [r.id, r])).values()]
    unique.sort((a, b) => {
      const at = a.createdAt?.toMillis?.() || 0
      const bt = b.createdAt?.toMillis?.() || 0
      return bt - at
    })

    // 만료 필터
    const now = new Date()
    setAnnouncements(unique.filter(a => !a.expiresAt || a.expiresAt.toDate() > now))
    setLoading(false)
  }, [user.uid, role])

  useEffect(() => { fetchAnnouncements() }, [fetchAnnouncements])

  async function handleDelete(id) {
    await deleteDoc(doc(db, 'announcements', id))
    fetchAnnouncements()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Announcements</h2>
        <button
          onClick={() => setShowForm(true)}
          disabled={partners.length === 0}
          className="px-4 py-2 rounded-lg bg-[#E07B0F] text-white text-sm font-bold disabled:opacity-50"
        >
          + New
        </button>
      </div>

      {partners.length === 0 && !loading && (
        <p className="text-sm text-zinc-400 bg-zinc-50 p-4 rounded-lg">
          No partners yet. Go to Partners tab to connect.
        </p>
      )}

      {loading ? (
        <p className="text-zinc-400">Loading...</p>
      ) : announcements.length === 0 ? (
        <p className="text-zinc-400 text-center py-10">No announcements</p>
      ) : (
        <div className="space-y-2">
          {announcements.map(a => (
            <div key={a.id} className="bg-white rounded-xl p-4 border border-zinc-200">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      a.authorRole === 'factory'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-green-100 text-green-700'
                    }`}>
                      {a.authorRole === 'factory' ? 'Factory' : 'Depot'}
                    </span>
                    {a.scope === 'all' && (
                      <span className="text-xs text-zinc-400">All depots</span>
                    )}
                    {a.scope === 'direct' && a.authorRole === 'factory' && (
                      <span className="text-xs text-zinc-400">Direct</span>
                    )}
                    <span className="text-xs text-zinc-400">{daysAgo(a.createdAt)}</span>
                  </div>
                  <p className="font-semibold">{a.title}</p>
                  {a.body && <p className="text-sm text-zinc-600 mt-1">{a.body}</p>}
                  <p className="text-xs text-zinc-400 mt-2">From: {a.authorName}</p>
                </div>
                {a.authorUid === user.uid && (
                  <button
                    onClick={() => handleDelete(a.id)}
                    className="text-xs text-red-400 hover:text-red-600 ml-3"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <NewAnnouncementModal
          uid={user.uid}
          shop={shop}
          role={role}
          partners={partners}
          onClose={() => setShowForm(false)}
          onAdded={fetchAnnouncements}
        />
      )}
    </div>
  )
}

function NewAnnouncementModal({ uid, shop, role, partners, onClose, onAdded }) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [scope, setScope] = useState(role === 'factory' ? 'all' : 'direct')
  const [targetUid, setTargetUid] = useState('')
  const [expiryDays, setExpiryDays] = useState(7)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)

    try {
      const expiresAt = Timestamp.fromDate(new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000))

      const data = {
        authorUid: uid,
        authorRole: role,
        authorName: shop?.name || 'Unknown',
        title: title.trim(),
        body: body.trim(),
        scope,
        createdAt: serverTimestamp(),
        expiresAt,
      }

      if (role === 'factory') {
        data.factoryUid = uid
        if (scope === 'all') {
          data.partnerDepotUids = partners.map(p => p.uid)
          data.targetDepotUid = null
        } else {
          data.targetDepotUid = targetUid || partners[0]?.uid
          data.partnerDepotUids = []
        }
      } else {
        // 디포 → 공장 메시지
        data.scope = 'direct'
        data.factoryUid = targetUid || partners[0]?.uid
        data.targetDepotUid = null
        data.partnerDepotUids = []
      }

      await addDoc(collection(db, 'announcements'), data)
      onAdded()
      onClose()
    } catch {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md">
        <h3 className="text-lg font-bold mb-4">
          {role === 'factory' ? 'New Announcement' : 'Message to Factory'}
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 공장: 범위 선택 */}
          {role === 'factory' && (
            <div>
              <label className="block text-sm font-semibold mb-2">Send to</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setScope('all')}
                  className={`flex-1 py-2 rounded-lg text-sm font-bold border-2 ${
                    scope === 'all' ? 'border-[#E07B0F] bg-orange-50' : 'border-zinc-200'
                  }`}
                >
                  All Depots
                </button>
                <button
                  type="button"
                  onClick={() => setScope('direct')}
                  className={`flex-1 py-2 rounded-lg text-sm font-bold border-2 ${
                    scope === 'direct' ? 'border-[#E07B0F] bg-orange-50' : 'border-zinc-200'
                  }`}
                >
                  Specific Depot
                </button>
              </div>
            </div>
          )}

          {/* 대상 선택 */}
          {((role === 'factory' && scope === 'direct') || role === 'depot') && partners.length > 1 && (
            <div>
              <label className="block text-sm font-semibold mb-2">
                {role === 'factory' ? 'Select Depot' : 'Select Factory'}
              </label>
              <select
                value={targetUid}
                onChange={e => setTargetUid(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-zinc-300 focus:border-[#E07B0F] focus:outline-none"
              >
                <option value="">Select...</option>
                {partners.map(p => (
                  <option key={p.uid} value={p.uid}>{p.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* 제목 */}
          <div>
            <label className="block text-sm font-semibold mb-2">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Holiday closure tomorrow"
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 focus:border-[#E07B0F] focus:outline-none"
            />
          </div>

          {/* 본문 */}
          <div>
            <label className="block text-sm font-semibold mb-2">Details</label>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="Additional details (optional)"
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 focus:border-[#E07B0F] focus:outline-none"
            />
          </div>

          {/* 만료 */}
          <div>
            <label className="block text-sm font-semibold mb-2">Expires in</label>
            <div className="flex gap-2">
              {[3, 7, 14, 30].map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setExpiryDays(d)}
                  className={`flex-1 py-2 rounded-lg text-sm font-bold border-2 ${
                    expiryDays === d ? 'border-[#E07B0F] bg-orange-50' : 'border-zinc-200'
                  }`}
                >
                  {d}d
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl border border-zinc-300 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !title.trim()}
              className="flex-1 py-3 rounded-xl bg-[#E07B0F] text-white font-bold disabled:opacity-50"
            >
              {saving ? 'Sending...' : 'Send'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
