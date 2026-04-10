import { useState, useEffect, useCallback } from 'react'
import {
  collection, query, where, getDocs, addDoc, doc, updateDoc,
  serverTimestamp, Timestamp, orderBy
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { uploadPhoto } from '@/lib/storage'
import { useAuth } from '@/context/AuthContext'
import PhotoCapture from '@/components/PhotoCapture'

const SUB_TABS = [
  { id: 'depotReports', label: 'Depot Reports' },
  { id: 'foundItems', label: 'Found Items' },
  { id: 'delivery', label: 'Delivery Plan' },
]

// 경과일 기준 색상
function agingColor(createdAt) {
  if (!createdAt) return ''
  const days = Math.floor((Date.now() - createdAt.toDate().getTime()) / (1000 * 60 * 60 * 24))
  if (days >= 7) return 'border-l-4 border-l-red-500 bg-red-50'
  if (days >= 3) return 'border-l-4 border-l-yellow-500 bg-yellow-50'
  return ''
}

function daysAgo(createdAt) {
  if (!createdAt) return ''
  const days = Math.floor((Date.now() - createdAt.toDate().getTime()) / (1000 * 60 * 60 * 24))
  if (days === 0) return 'Today'
  if (days === 1) return '1 day ago'
  return `${days} days ago`
}

const AUTO_DELETE_DAYS = 5

function daysUntilDelete(resolvedAt) {
  if (!resolvedAt) return ''
  const resolved = resolvedAt.toDate().getTime()
  const deleteAt = resolved + AUTO_DELETE_DAYS * 24 * 60 * 60 * 1000
  const remaining = Math.ceil((deleteAt - Date.now()) / (1000 * 60 * 60 * 24))
  if (remaining <= 0) return 'soon'
  return `${remaining} day${remaining > 1 ? 's' : ''}`
}

function formatDate(ts) {
  if (!ts) return ''
  const d = ts.toDate()
  return d.toLocaleDateString('en-CA') // YYYY-MM-DD
}

// 날짜별 그루핑
function groupByDate(items, dateField = 'createdAt') {
  const groups = {}
  for (const item of items) {
    const date = item[dateField] ? formatDate(item[dateField]) : 'Unknown'
    if (!groups[date]) groups[date] = []
    groups[date].push(item)
  }
  // 최신 먼저
  return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]))
}

const STATUS_COLORS = {
  reported: 'bg-blue-100 text-blue-700',
  searching: 'bg-yellow-100 text-yellow-700',
  found: 'bg-green-100 text-green-700',
  delivery_scheduled: 'bg-purple-100 text-purple-700',
  delivered: 'bg-zinc-100 text-zinc-500',
  closed: 'bg-zinc-100 text-zinc-500',
  unclaimed: 'bg-blue-100 text-blue-700',
  claimed: 'bg-green-100 text-green-700',
  returned: 'bg-zinc-100 text-zinc-500',
  discarded: 'bg-zinc-100 text-zinc-500',
}

export default function FactoryLostItems() {
  const { user } = useAuth()
  const [subTab, setSubTab] = useState('depotReports')

  return (
    <div className="space-y-4">
      {/* 서브탭 */}
      <div className="flex gap-2">
        {SUB_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setSubTab(tab.id)}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
              subTab === tab.id
                ? 'bg-[#E07B0F] text-white'
                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {subTab === 'depotReports' && <DepotReports uid={user.uid} />}
      {subTab === 'foundItems' && <FoundItems uid={user.uid} />}
      {subTab === 'delivery' && <DeliveryPlan uid={user.uid} />}
    </div>
  )
}

// ─── Depot Reports 탭 ───────────────────────────────────────

function DepotReports({ uid }) {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [showResolved, setShowResolved] = useState(false)
  const [statusModal, setStatusModal] = useState(null)

  const fetchReports = useCallback(async () => {
    setLoading(true)
    const q = query(
      collection(db, 'lostReports'),
      where('factoryUid', '==', uid),
      orderBy('createdAt', 'desc')
    )
    const snap = await getDocs(q)
    // 디포명 조회
    const list = []
    for (const d of snap.docs) {
      const data = { id: d.id, ...d.data() }
      const depotSnap = await getDocs(
        query(collection(db, 'shops'), where('shopId', '==', data.depotUid))
      )
      data.depotName = depotSnap.docs[0]?.data()?.name || 'Unknown Depot'
      list.push(data)
    }
    setReports(list)
    setLoading(false)
  }, [uid])

  useEffect(() => { fetchReports() }, [fetchReports])

  const unresolved = reports.filter(r => !['delivered', 'closed'].includes(r.status))
  const resolved = reports.filter(r => ['delivered', 'closed'].includes(r.status))
  const displayed = showResolved ? reports : unresolved
  const grouped = groupByDate(displayed)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">
          {unresolved.length} unresolved{resolved.length > 0 ? ` / ${resolved.length} resolved` : ''}
        </p>
        <button
          onClick={() => setShowResolved(!showResolved)}
          className="text-sm text-[#E07B0F] font-medium"
        >
          {showResolved ? 'Hide resolved' : 'Show resolved'}
        </button>
      </div>

      {loading ? (
        <p className="text-zinc-400">Loading...</p>
      ) : grouped.length === 0 ? (
        <p className="text-zinc-400 text-center py-10">No reports</p>
      ) : (
        grouped.map(([date, items]) => (
          <div key={date}>
            <p className="text-xs font-bold text-zinc-400 mb-2">{date}</p>
            <div className="space-y-2">
              {items.map(report => (
                <div
                  key={report.id}
                  className={`bg-white rounded-xl p-4 border border-zinc-200 ${agingColor(report.createdAt)}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold">{report.depotName}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[report.status] || ''}`}>
                          {report.status}
                        </span>
                        <span className="text-xs text-zinc-400">{daysAgo(report.createdAt)}</span>
                      </div>
                      <p className="text-sm text-zinc-600">
                        {report.garmentType} {report.color && `— ${report.color}`}
                      </p>
                      {report.description && (
                        <p className="text-sm text-zinc-500 mt-1">{report.description}</p>
                      )}
                      {report.invoiceNo && (
                        <p className="text-xs text-zinc-400 mt-1">Invoice: {report.invoiceNo}</p>
                      )}
                    </div>
                    {/* 사진 */}
                    {report.photoUrls?.length > 0 && (
                      <div className="flex gap-1 ml-3">
                        {report.photoUrls.map((url, i) => (
                          <img key={i} src={url} alt="" className="w-16 h-16 object-cover rounded-lg" />
                        ))}
                      </div>
                    )}
                  </div>
                  {/* 타임라인 */}
                  {report.timeline?.length > 0 && (
                    <div className="mt-3 border-t border-zinc-100 pt-2">
                      {report.timeline.slice(-3).map((entry, i) => (
                        <p key={i} className="text-xs text-zinc-400">
                          {entry.status} — {entry.note} ({entry.updatedAt ? formatDate(entry.updatedAt) : ''})
                        </p>
                      ))}
                    </div>
                  )}
                  {/* 상태 업데이트 버튼 */}
                  {!['delivered', 'closed'].includes(report.status) && (
                    <button
                      onClick={() => setStatusModal(report)}
                      className="mt-3 text-sm font-medium text-[#E07B0F] hover:underline"
                    >
                      Update Status
                    </button>
                  )}
                  {/* delivered인데 디포가 아직 삭제 안 한 경우: 삭제 요청 */}
                  {report.status === 'delivered' && (
                    <button
                      onClick={async () => {
                        const timeline = [...(report.timeline || []), {
                          status: 'delete_requested',
                          note: 'Factory requests deletion — item was delivered',
                          updatedAt: Timestamp.now(),
                          by: 'factory',
                        }]
                        await updateDoc(doc(db, 'lostReports', report.id), { timeline })
                        fetchReports()
                      }}
                      className="mt-3 text-sm font-medium text-red-500 hover:underline"
                    >
                      Request Deletion
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {/* 상태 업데이트 모달 */}
      {statusModal && (
        <StatusUpdateModal
          report={statusModal}
          onClose={() => setStatusModal(null)}
          onUpdated={fetchReports}
        />
      )}
    </div>
  )
}

function StatusUpdateModal({ report, onClose, onUpdated }) {
  const [status, setStatus] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  const nextStatuses = {
    reported: ['searching', 'closed'],
    searching: ['found', 'closed'],
    found: ['delivery_scheduled'],
    delivery_scheduled: ['delivered'],
  }
  const options = nextStatuses[report.status] || []

  async function handleSubmit() {
    if (!status) return
    setSaving(true)
    const timeline = [...(report.timeline || []), {
      status,
      note: note.trim(),
      updatedAt: Timestamp.now(),
      by: 'factory',
    }]
    // 공장은 상태 변경만. 삭제는 디포만 가능.
    await updateDoc(doc(db, 'lostReports', report.id), { status, timeline })
    setSaving(false)
    onUpdated()
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
        <h3 className="text-lg font-bold mb-4">Update Status</h3>
        <p className="text-sm text-zinc-500 mb-4">{report.depotName} — {report.garmentType}</p>

        <div className="space-y-2 mb-4">
          {options.map(s => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`w-full py-2 px-4 rounded-lg text-left font-medium border-2 transition-colors ${
                status === s
                  ? 'border-[#E07B0F] bg-orange-50'
                  : 'border-zinc-200 hover:border-zinc-300'
              }`}
            >
              {s.replace('_', ' ')}
            </button>
          ))}
        </div>

        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Add a note (optional)"
          rows={2}
          className="w-full px-3 py-2 rounded-lg border border-zinc-300 text-sm mb-4 focus:border-[#E07B0F] focus:outline-none"
        />

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg border border-zinc-300 font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!status || saving}
            className="flex-1 py-2 rounded-lg bg-[#E07B0F] text-white font-bold disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Update'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Found Items 탭 ─────────────────────────────────────────

function FoundItems({ uid }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [showResolved, setShowResolved] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [selectedItem, setSelectedItem] = useState(null)

  const fetchItems = useCallback(async () => {
    setLoading(true)
    const q = query(
      collection(db, 'foundItems'),
      where('factoryUid', '==', uid),
      orderBy('createdAt', 'desc')
    )
    const snap = await getDocs(q)
    const list = []
    for (const d of snap.docs) {
      const data = { id: d.id, ...d.data() }
      // 클레임 조회
      const claimsSnap = await getDocs(collection(db, 'foundItems', d.id, 'claims'))
      data.claims = claimsSnap.docs.map(c => ({ id: c.id, ...c.data() }))
      list.push(data)
    }
    setItems(list)
    setLoading(false)
  }, [uid])

  useEffect(() => { fetchItems() }, [fetchItems])

  const unresolved = items.filter(i => !['returned', 'discarded'].includes(i.status))
  const displayed = showResolved ? items : unresolved
  const grouped = groupByDate(displayed)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">{unresolved.length} unresolved</p>
        <div className="flex gap-3">
          <button
            onClick={() => setShowResolved(!showResolved)}
            className="text-sm text-[#E07B0F] font-medium"
          >
            {showResolved ? 'Hide resolved' : 'Show resolved'}
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 rounded-lg bg-[#E07B0F] text-white text-sm font-bold"
          >
            + Add Found Item
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-zinc-400">Loading...</p>
      ) : grouped.length === 0 ? (
        <p className="text-zinc-400 text-center py-10">No found items</p>
      ) : (
        grouped.map(([date, dateItems]) => (
          <div key={date}>
            <p className="text-xs font-bold text-zinc-400 mb-2">{date}</p>
            <div className="space-y-2">
              {dateItems.map(item => (
                <div
                  key={item.id}
                  className={`bg-white rounded-xl p-4 border border-zinc-200 ${item.resolvedAt ? 'opacity-50' : agingColor(item.createdAt)}`}
                >
                  <div className="flex items-start gap-3">
                    {/* 사진 */}
                    {item.photoUrls?.length > 0 && (
                      <div className="flex gap-1 flex-shrink-0">
                        {item.photoUrls.map((url, i) => (
                          <img key={i} src={url} alt="" className="w-16 h-16 object-cover rounded-lg" />
                        ))}
                      </div>
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[item.status] || ''}`}>
                          {item.status}
                        </span>
                        <span className="text-xs text-zinc-400">{daysAgo(item.createdAt)}</span>
                        {item.claims.length > 0 && (
                          <span className="text-xs font-bold text-[#E07B0F]">
                            {item.claims.filter(c => c.status === 'pending').length} claims
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-zinc-600">
                        {item.garmentType} {item.color && `— ${item.color}`}
                      </p>
                      {item.description && (
                        <p className="text-sm text-zinc-500 mt-1">{item.description}</p>
                      )}
                    </div>
                  </div>

                  {/* 클레임 목록 */}
                  {item.claims.filter(c => c.status === 'pending').length > 0 && (
                    <div className="mt-3 border-t border-zinc-100 pt-3 space-y-2">
                      <p className="text-xs font-bold text-zinc-500">Pending Claims:</p>
                      {item.claims.filter(c => c.status === 'pending').map(claim => (
                        <ClaimRow
                          key={claim.id}
                          claim={claim}
                          itemId={item.id}
                          allClaims={item.claims}
                          onUpdated={fetchItems}
                        />
                      ))}
                    </div>
                  )}

                  {/* 수락된 클레임 */}
                  {item.claims.filter(c => c.status === 'accepted').map(claim => (
                    <div key={claim.id} className="mt-3 border-t border-zinc-100 pt-2">
                      <p className="text-xs text-green-600 font-medium">
                        Accepted: {claim.depotName} — "{claim.claimNote}"
                      </p>
                    </div>
                  ))}
                  {/* 해결된 건: 공장이 resolved 표시 → 5일 후 자동 삭제 */}
                  {['returned', 'discarded'].includes(item.status) && !item.resolvedAt && (
                    <button
                      onClick={async () => {
                        await updateDoc(doc(db, 'foundItems', item.id), {
                          resolvedAt: serverTimestamp(),
                        })
                        fetchItems()
                      }}
                      className="mt-3 px-4 py-2 rounded-lg text-sm font-bold bg-green-500 text-white hover:bg-green-600"
                    >
                      Mark Resolved
                    </button>
                  )}
                  {item.resolvedAt && (
                    <p className="mt-3 text-xs text-zinc-400">
                      Resolved — auto-deletes in {daysUntilDelete(item.resolvedAt)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {/* 등록 폼 모달 */}
      {showForm && (
        <AddFoundItemModal
          uid={uid}
          onClose={() => setShowForm(false)}
          onAdded={fetchItems}
        />
      )}
    </div>
  )
}

function ClaimRow({ claim, itemId, allClaims, onUpdated }) {
  const [saving, setSaving] = useState(false)

  async function handleAccept() {
    setSaving(true)
    // 이 클레임 수락
    await updateDoc(doc(db, 'foundItems', itemId, 'claims', claim.id), {
      status: 'accepted'
    })
    // 나머지 pending 클레임 전부 기각
    const others = allClaims.filter(c => c.id !== claim.id && c.status === 'pending')
    for (const other of others) {
      await updateDoc(doc(db, 'foundItems', itemId, 'claims', other.id), {
        status: 'rejected'
      })
    }
    // foundItem 상태를 claimed로
    await updateDoc(doc(db, 'foundItems', itemId), { status: 'claimed' })
    setSaving(false)
    onUpdated()
  }

  async function handleReject() {
    setSaving(true)
    await updateDoc(doc(db, 'foundItems', itemId, 'claims', claim.id), {
      status: 'rejected'
    })
    setSaving(false)
    onUpdated()
  }

  return (
    <div className="flex items-center justify-between bg-zinc-50 rounded-lg px-3 py-2">
      <div>
        <p className="text-sm font-medium">{claim.depotName}</p>
        {claim.claimNote && <p className="text-xs text-zinc-500">"{claim.claimNote}"</p>}
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleAccept}
          disabled={saving}
          className="px-3 py-1 text-xs font-bold rounded-lg bg-green-500 text-white disabled:opacity-50"
        >
          Accept
        </button>
        <button
          onClick={handleReject}
          disabled={saving}
          className="px-3 py-1 text-xs font-bold rounded-lg bg-zinc-300 text-zinc-700 disabled:opacity-50"
        >
          Reject
        </button>
      </div>
    </div>
  )
}

function AddFoundItemModal({ uid, onClose, onAdded }) {
  const [photos, setPhotos] = useState([])
  const [garmentType, setGarmentType] = useState('shirt')
  const [color, setColor] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (photos.length === 0) return
    setSaving(true)

    try {
      // 파트너 디포 uid 목록 조회
      const partnerQ = query(
        collection(db, 'partnerships'),
        where('factoryUid', '==', uid),
        where('status', '==', 'active')
      )
      const partnerSnap = await getDocs(partnerQ)
      const partnerDepotUids = partnerSnap.docs.map(d => d.data().depotUid)

      // foundItem 문서 생성 (사진 URL 없이 먼저)
      const itemRef = await addDoc(collection(db, 'foundItems'), {
        factoryUid: uid,
        photoUrls: [],
        garmentType,
        color: color.trim(),
        description: description.trim(),
        status: 'unclaimed',
        partnerDepotUids,
        createdAt: serverTimestamp(),
        deletedAt: null,
      })

      // 사진 업로드
      const photoUrls = []
      for (let i = 0; i < photos.length; i++) {
        const path = `foundItems/${itemRef.id}/photo_${i}.jpg`
        const url = await uploadPhoto(path, photos[i])
        photoUrls.push(url)
      }

      // URL 업데이트
      await updateDoc(doc(db, 'foundItems', itemRef.id), { photoUrls })

      onAdded()
      onClose()
    } catch {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-bold mb-4">Add Found Item</h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 사진 (필수) */}
          <div>
            <label className="block text-sm font-semibold mb-2">
              Photos <span className="text-red-500">*</span>
            </label>
            <PhotoCapture photos={photos} onChange={setPhotos} required />
          </div>

          {/* 의류 종류 */}
          <div>
            <label className="block text-sm font-semibold mb-2">Type</label>
            <div className="flex gap-2">
              {['shirt', 'dc', 'other'].map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setGarmentType(t)}
                  className={`flex-1 py-2 rounded-lg text-sm font-bold border-2 ${
                    garmentType === t
                      ? 'border-[#E07B0F] bg-orange-50'
                      : 'border-zinc-200'
                  }`}
                >
                  {t === 'dc' ? 'DC' : t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* 색상 */}
          <div>
            <label className="block text-sm font-semibold mb-2">Color</label>
            <input
              type="text"
              value={color}
              onChange={e => setColor(e.target.value)}
              placeholder="e.g. Black, White, Blue"
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 focus:border-[#E07B0F] focus:outline-none"
            />
          </div>

          {/* 설명 */}
          <div>
            <label className="block text-sm font-semibold mb-2">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Any distinguishing features"
              rows={2}
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 focus:border-[#E07B0F] focus:outline-none"
            />
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
              disabled={saving || photos.length === 0}
              className="flex-1 py-3 rounded-xl bg-[#E07B0F] text-white font-bold disabled:opacity-50"
            >
              {saving ? 'Uploading...' : 'Register'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Delivery Plan 탭 ───────────────────────────────────────

function DeliveryPlan({ uid }) {
  const [deliveryItems, setDeliveryItems] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchDelivery = useCallback(async () => {
    setLoading(true)
    const items = []

    // 1. foundItems에서 claimed (accepted claim이 있고 아직 returned 아닌 것)
    const fiQ = query(
      collection(db, 'foundItems'),
      where('factoryUid', '==', uid),
      where('status', '==', 'claimed')
    )
    const fiSnap = await getDocs(fiQ)
    for (const d of fiSnap.docs) {
      const data = d.data()
      const claimsSnap = await getDocs(collection(db, 'foundItems', d.id, 'claims'))
      const accepted = claimsSnap.docs.find(c => c.data().status === 'accepted')
      if (accepted) {
        items.push({
          id: d.id,
          type: 'foundItem',
          depotName: accepted.data().depotName,
          depotUid: accepted.data().depotUid,
          garmentType: data.garmentType,
          color: data.color,
          photoUrls: data.photoUrls,
          createdAt: data.createdAt,
        })
      }
    }

    // 2. lostReports에서 found 또는 delivery_scheduled
    const lrQ = query(
      collection(db, 'lostReports'),
      where('factoryUid', '==', uid)
    )
    const lrSnap = await getDocs(lrQ)
    for (const d of lrSnap.docs) {
      const data = d.data()
      if (['found', 'delivery_scheduled'].includes(data.status)) {
        const depotSnap = await getDocs(
          query(collection(db, 'shops'), where('shopId', '==', data.depotUid))
        )
        items.push({
          id: d.id,
          type: 'lostReport',
          depotName: depotSnap.docs[0]?.data()?.name || 'Unknown',
          depotUid: data.depotUid,
          garmentType: data.garmentType,
          color: data.color,
          photoUrls: data.photoUrls,
          status: data.status,
          createdAt: data.createdAt,
        })
      }
    }

    // 디포별 그루핑
    items.sort((a, b) => (a.depotName || '').localeCompare(b.depotName || ''))
    setDeliveryItems(items)
    setLoading(false)
  }, [uid])

  useEffect(() => { fetchDelivery() }, [fetchDelivery])

  // 디포별 그루핑
  const byDepot = {}
  for (const item of deliveryItems) {
    const name = item.depotName || 'Unknown'
    if (!byDepot[name]) byDepot[name] = []
    byDepot[name].push(item)
  }

  async function markDelivered(item) {
    if (item.type === 'foundItem') {
      await updateDoc(doc(db, 'foundItems', item.id), { status: 'returned' })
    } else {
      // 배송 완료 상태로 변경. 삭제는 디포가 확인 후 직접.
      const timeline = [{
        status: 'delivered',
        note: 'Delivered',
        updatedAt: Timestamp.now(),
        by: 'factory',
      }]
      await updateDoc(doc(db, 'lostReports', item.id), { status: 'delivered', timeline })
    }
    fetchDelivery()
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-500">{deliveryItems.length} items pending delivery</p>

      {loading ? (
        <p className="text-zinc-400">Loading...</p>
      ) : Object.keys(byDepot).length === 0 ? (
        <p className="text-zinc-400 text-center py-10">No pending deliveries</p>
      ) : (
        Object.entries(byDepot).map(([depotName, items]) => (
          <div key={depotName} className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
            <div className="px-4 py-3 bg-zinc-50 border-b border-zinc-200">
              <span className="font-bold">{depotName}</span>
              <span className="text-sm text-zinc-400 ml-2">{items.length} items</span>
            </div>
            <div className="divide-y divide-zinc-100">
              {items.map(item => (
                <div key={item.id} className="px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {item.photoUrls?.[0] && (
                      <img src={item.photoUrls[0]} alt="" className="w-10 h-10 object-cover rounded" />
                    )}
                    <div>
                      <p className="text-sm font-medium">
                        {item.garmentType} {item.color && `— ${item.color}`}
                      </p>
                      <p className="text-xs text-zinc-400">
                        {item.type === 'foundItem' ? 'Found item' : 'Lost report'} · {daysAgo(item.createdAt)}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => markDelivered(item)}
                    className="px-3 py-1 text-xs font-bold rounded-lg bg-green-500 text-white hover:bg-green-600"
                  >
                    Delivered
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
