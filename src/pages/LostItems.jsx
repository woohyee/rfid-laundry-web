import { useState, useEffect, useCallback } from 'react'
import {
  collection, query, where, getDocs, addDoc, doc, updateDoc,
  serverTimestamp, Timestamp, orderBy
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { uploadPhoto } from '@/lib/storage'
import { useAuth } from '@/context/AuthContext'
import PhotoUpload from '@/components/PhotoUpload'

const SUB_TABS = [
  { id: 'myReports', label: 'My Reports' },
  { id: 'foundItems', label: 'Found Items' },
]

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
}

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

const AUTO_DELETE_DAYS = 5

function daysUntilDelete(resolvedAt) {
  if (!resolvedAt) return ''
  const resolved = resolvedAt.toDate().getTime()
  const deleteAt = resolved + AUTO_DELETE_DAYS * 24 * 60 * 60 * 1000
  const remaining = Math.ceil((deleteAt - Date.now()) / (1000 * 60 * 60 * 24))
  if (remaining <= 0) return 'soon'
  return `${remaining} day${remaining > 1 ? 's' : ''}`
}

export default function LostItems() {
  const { user } = useAuth()
  const [subTab, setSubTab] = useState('myReports')

  return (
    <div className="space-y-4">
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

      {subTab === 'myReports' && <MyReports uid={user.uid} />}
      {subTab === 'foundItems' && <DepotFoundItems uid={user.uid} />}
    </div>
  )
}

// ─── My Reports 탭 ──────────────────────────────────────────

function MyReports({ uid }) {
  const { shop } = useAuth()
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  const fetchReports = useCallback(async () => {
    setLoading(true)
    const q = query(
      collection(db, 'lostReports'),
      where('depotUid', '==', uid),
      orderBy('createdAt', 'desc')
    )
    const snap = await getDocs(q)
    setReports(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    setLoading(false)
  }, [uid])

  useEffect(() => { fetchReports() }, [fetchReports])

  // 파트너 공장 목록 조회 (신고 폼에서 사용)
  const [partners, setPartners] = useState([])
  useEffect(() => {
    async function fetchPartners() {
      const q = query(
        collection(db, 'partnerships'),
        where('depotUid', '==', uid),
        where('status', '==', 'active')
      )
      const snap = await getDocs(q)
      const list = []
      for (const d of snap.docs) {
        const data = d.data()
        const factorySnap = await getDocs(
          query(collection(db, 'shops'), where('shopId', '==', data.factoryUid))
        )
        list.push({
          partnershipId: d.id,
          factoryUid: data.factoryUid,
          factoryName: factorySnap.docs[0]?.data()?.name || 'Unknown Factory',
        })
      }
      setPartners(list)
    }
    fetchPartners()
  }, [uid])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">{reports.length} reports</p>
        <button
          onClick={() => setShowForm(true)}
          disabled={partners.length === 0}
          className="px-4 py-2 rounded-lg bg-[#E07B0F] text-white text-sm font-bold disabled:opacity-50"
        >
          + New Report
        </button>
      </div>

      {partners.length === 0 && !loading && (
        <p className="text-sm text-zinc-400 bg-zinc-50 p-4 rounded-lg">
          No factory partners yet. Go to Partners tab to connect with a factory.
        </p>
      )}

      {loading ? (
        <p className="text-zinc-400">Loading...</p>
      ) : reports.length === 0 ? (
        <p className="text-zinc-400 text-center py-10">No reports yet</p>
      ) : (
        <div className="space-y-2">
          {reports.map(report => (
            <div key={report.id} className={`bg-white rounded-xl p-4 border border-zinc-200 ${report.resolvedAt ? 'opacity-50' : ''}`}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
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
                  {report.timeline.map((entry, i) => (
                    <p key={i} className="text-xs text-zinc-400">
                      {entry.status}{entry.note ? ` — ${entry.note}` : ''} ({entry.updatedAt ? formatDate(entry.updatedAt) : ''})
                    </p>
                  ))}
                </div>
              )}
              {/* delivered/closed → 해결 표시 (5일 후 자동 삭제) */}
              {['delivered', 'closed'].includes(report.status) && !report.resolvedAt && (
                <button
                  onClick={async () => {
                    await updateDoc(doc(db, 'lostReports', report.id), {
                      resolvedAt: serverTimestamp(),
                    })
                    fetchReports()
                  }}
                  className="mt-3 px-4 py-2 rounded-lg text-sm font-bold bg-green-500 text-white hover:bg-green-600"
                >
                  {report.status === 'delivered' ? 'Received — Mark Resolved' : 'Mark Resolved'}
                </button>
              )}
              {report.resolvedAt && (
                <p className="mt-3 text-xs text-zinc-400">
                  Resolved — auto-deletes in {daysUntilDelete(report.resolvedAt)}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 신고 폼 모달 */}
      {showForm && (
        <NewReportModal
          uid={uid}
          shopName={shop?.name || ''}
          partners={partners}
          onClose={() => setShowForm(false)}
          onAdded={fetchReports}
        />
      )}
    </div>
  )
}

function NewReportModal({ uid, shopName, partners, onClose, onAdded }) {
  const [selectedPartner, setSelectedPartner] = useState(partners[0] || null)
  const [photos, setPhotos] = useState([])
  const [garmentType, setGarmentType] = useState('shirt')
  const [color, setColor] = useState('')
  const [description, setDescription] = useState('')
  const [invoiceNo, setInvoiceNo] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    // 사진 OR 텍스트 최소 하나 필수
    if (photos.length === 0 && !description.trim() && !color.trim()) {
      setError('Please add a photo or describe the garment')
      return
    }
    if (!selectedPartner) return

    setSaving(true)
    setError('')
    try {
      const reportRef = await addDoc(collection(db, 'lostReports'), {
        depotUid: uid,
        factoryUid: selectedPartner.factoryUid,
        partnershipId: selectedPartner.partnershipId,
        photoUrls: [],
        garmentType,
        color: color.trim(),
        description: description.trim(),
        invoiceNo: invoiceNo.trim() || null,
        status: 'reported',
        timeline: [{
          status: 'reported',
          note: `Reported by ${shopName}`,
          updatedAt: Timestamp.now(),
          by: 'depot',
        }],
        createdAt: serverTimestamp(),
        deletedAt: null,
      })

      // 사진 업로드
      if (photos.length > 0) {
        const photoUrls = []
        for (let i = 0; i < photos.length; i++) {
          const path = `lostReports/${reportRef.id}/photo_${i}.jpg`
          const url = await uploadPhoto(path, photos[i])
          photoUrls.push(url)
        }
        const { updateDoc: ud } = await import('firebase/firestore')
        await ud(doc(db, 'lostReports', reportRef.id), { photoUrls })
      }

      onAdded()
      onClose()
    } catch {
      setError('Failed to submit report')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-bold mb-4">Report Lost Item</h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 공장 선택 */}
          {partners.length > 1 && (
            <div>
              <label className="block text-sm font-semibold mb-2">Factory</label>
              <select
                value={selectedPartner?.factoryUid || ''}
                onChange={e => setSelectedPartner(partners.find(p => p.factoryUid === e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-zinc-300 focus:border-[#E07B0F] focus:outline-none"
              >
                {partners.map(p => (
                  <option key={p.factoryUid} value={p.factoryUid}>{p.factoryName}</option>
                ))}
              </select>
            </div>
          )}

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
              placeholder="e.g. Black, White"
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 focus:border-[#E07B0F] focus:outline-none"
            />
          </div>

          {/* 설명 */}
          <div>
            <label className="block text-sm font-semibold mb-2">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Describe the garment"
              rows={2}
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 focus:border-[#E07B0F] focus:outline-none"
            />
          </div>

          {/* 인보이스 번호 */}
          <div>
            <label className="block text-sm font-semibold mb-2">
              Invoice # <span className="text-zinc-400">(optional)</span>
            </label>
            <input
              type="text"
              value={invoiceNo}
              onChange={e => setInvoiceNo(e.target.value)}
              placeholder="Invoice number"
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 focus:border-[#E07B0F] focus:outline-none"
            />
          </div>

          {/* 사진 (선택) */}
          <div>
            <label className="block text-sm font-semibold mb-2">
              Photos <span className="text-zinc-400">(optional)</span>
            </label>
            <PhotoUpload photos={photos} onChange={setPhotos} />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

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
              disabled={saving}
              className="flex-1 py-3 rounded-xl bg-[#E07B0F] text-white font-bold disabled:opacity-50"
            >
              {saving ? 'Submitting...' : 'Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Found Items 탭 (디포 뷰) ───────────────────────────────

function DepotFoundItems({ uid }) {
  const { shop } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [claimModal, setClaimModal] = useState(null)

  const fetchItems = useCallback(async () => {
    setLoading(true)
    // 파트너 공장 uid 조회
    const partnerQ = query(
      collection(db, 'partnerships'),
      where('depotUid', '==', uid),
      where('status', '==', 'active')
    )
    const partnerSnap = await getDocs(partnerQ)
    const factoryUids = partnerSnap.docs.map(d => d.data().factoryUid)

    if (factoryUids.length === 0) {
      setItems([])
      setLoading(false)
      return
    }

    // 각 공장의 foundItems 병렬 조회
    const allItems = []
    await Promise.all(factoryUids.map(async (fUid) => {
      const q = query(
        collection(db, 'foundItems'),
        where('factoryUid', '==', fUid),
        where('partnerDepotUids', 'array-contains', uid),
        orderBy('createdAt', 'desc')
      )
      const snap = await getDocs(q)
      for (const d of snap.docs) {
        const data = { id: d.id, ...d.data() }
        // 내 클레임 존재 여부
        const claimsSnap = await getDocs(collection(db, 'foundItems', d.id, 'claims'))
        const myClaim = claimsSnap.docs.find(c => c.data().depotUid === uid)
        data.myClaim = myClaim ? { id: myClaim.id, ...myClaim.data() } : null
        data.hasAccepted = claimsSnap.docs.some(c => c.data().status === 'accepted')
        // 공장명
        const factorySnap = await getDocs(
          query(collection(db, 'shops'), where('shopId', '==', fUid))
        )
        data.factoryName = factorySnap.docs[0]?.data()?.name || 'Unknown Factory'
        allItems.push(data)
      }
    }))

    // unclaimed/claimed만 보여줌 (returned/discarded 제외)
    allItems.sort((a, b) => {
      const at = a.createdAt?.toMillis?.() || 0
      const bt = b.createdAt?.toMillis?.() || 0
      return bt - at
    })
    setItems(allItems.filter(i => !['returned', 'discarded'].includes(i.status)))
    setLoading(false)
  }, [uid])

  useEffect(() => { fetchItems() }, [fetchItems])

  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-500">{items.length} items from partner factories</p>

      {loading ? (
        <p className="text-zinc-400">Loading...</p>
      ) : items.length === 0 ? (
        <p className="text-zinc-400 text-center py-10">No found items from your factories</p>
      ) : (
        <div className="space-y-2">
          {items.map(item => (
            <div key={item.id} className="bg-white rounded-xl p-4 border border-zinc-200">
              <div className="flex items-start gap-3">
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
                    <span className="text-xs text-zinc-400">{item.factoryName}</span>
                    <span className="text-xs text-zinc-400">{daysAgo(item.createdAt)}</span>
                  </div>
                  <p className="text-sm text-zinc-600">
                    {item.garmentType} {item.color && `— ${item.color}`}
                  </p>
                  {item.description && (
                    <p className="text-sm text-zinc-500 mt-1">{item.description}</p>
                  )}
                </div>
              </div>

              {/* 클레임 상태 */}
              <div className="mt-3">
                {item.myClaim ? (
                  <p className={`text-sm font-medium ${
                    item.myClaim.status === 'accepted' ? 'text-green-600'
                    : item.myClaim.status === 'rejected' ? 'text-red-500'
                    : 'text-yellow-600'
                  }`}>
                    {item.myClaim.status === 'accepted' && 'Your claim was accepted!'}
                    {item.myClaim.status === 'rejected' && 'Your claim was rejected'}
                    {item.myClaim.status === 'pending' && 'Claim submitted — waiting for review'}
                  </p>
                ) : item.hasAccepted ? (
                  <p className="text-sm text-zinc-400">Claimed by another depot</p>
                ) : (
                  <button
                    onClick={() => setClaimModal(item)}
                    className="px-4 py-2 rounded-lg bg-[#E07B0F] text-white text-sm font-bold"
                  >
                    This is mine
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 클레임 모달 */}
      {claimModal && (
        <ClaimModal
          item={claimModal}
          uid={uid}
          shopName={shop?.name || ''}
          onClose={() => setClaimModal(null)}
          onClaimed={fetchItems}
        />
      )}
    </div>
  )
}

function ClaimModal({ item, uid, shopName, onClose, onClaimed }) {
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    await addDoc(collection(db, 'foundItems', item.id, 'claims'), {
      depotUid: uid,
      depotName: shopName,
      claimNote: note.trim(),
      status: 'pending',
      claimedAt: serverTimestamp(),
    })
    setSaving(false)
    onClaimed()
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
        <h3 className="text-lg font-bold mb-2">Claim This Item</h3>
        <p className="text-sm text-zinc-500 mb-4">
          {item.garmentType} {item.color && `— ${item.color}`}
        </p>

        <form onSubmit={handleSubmit}>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Why do you think this is yours? (e.g. customer name, description)"
            rows={3}
            className="w-full px-3 py-2 rounded-lg border border-zinc-300 text-sm mb-4 focus:border-[#E07B0F] focus:outline-none"
          />

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 rounded-lg border border-zinc-300 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2 rounded-lg bg-[#E07B0F] text-white font-bold disabled:opacity-50"
            >
              {saving ? 'Submitting...' : 'Claim'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
