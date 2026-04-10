import { useState, useEffect } from 'react'
import {
  collection, query, where, getDocs, addDoc, doc, updateDoc,
  serverTimestamp, Timestamp
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/context/AuthContext'

// 초대 코드 생성 (6자리 영숫자)
function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

export default function Partnership() {
  const { user, shop } = useAuth()
  const role = shop?.role || 'depot'

  const [partners, setPartners] = useState([])
  const [loading, setLoading] = useState(true)

  // Factory: 초대 코드 관련
  const [inviteCode, setInviteCode] = useState(null)
  const [generatingCode, setGeneratingCode] = useState(false)

  // Depot: 코드 입력 관련
  const [codeInput, setCodeInput] = useState('')
  const [joining, setJoining] = useState(false)
  const [message, setMessage] = useState({ text: '', type: '' })

  useEffect(() => {
    fetchPartners()
  }, [])

  async function fetchPartners() {
    setLoading(true)
    try {
      const field = role === 'factory' ? 'factoryUid' : 'depotUid'
      const q = query(
        collection(db, 'partnerships'),
        where(field, '==', user.uid)
      )
      const snap = await getDocs(q)
      const list = []
      for (const d of snap.docs) {
        const data = d.data()
        // 파트너 shop 정보 조회
        const partnerUid = role === 'factory' ? data.depotUid : data.factoryUid
        const partnerDoc = await getDocs(
          query(collection(db, 'shops'), where('shopId', '==', partnerUid))
        )
        const partnerShop = partnerDoc.docs[0]?.data() || {}
        list.push({
          id: d.id,
          ...data,
          partnerName: partnerShop.name || 'Unknown',
          partnerPhone: partnerShop.phone || '',
        })
      }
      setPartners(list)
    } finally {
      setLoading(false)
    }
  }

  // Factory: 초대 코드 생성
  async function handleGenerateCode() {
    setGeneratingCode(true)
    try {
      const code = generateCode()
      const expiresAt = Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))
      await addDoc(collection(db, 'inviteCodes'), {
        code,
        factoryUid: user.uid,
        expiresAt,
        used: false,
        createdAt: serverTimestamp(),
      })
      setInviteCode(code)
    } finally {
      setGeneratingCode(false)
    }
  }

  // Depot: 초대 코드로 파트너십 생성
  async function handleJoin(e) {
    e.preventDefault()
    const code = codeInput.trim().toUpperCase()
    if (!code) return

    setJoining(true)
    setMessage({ text: '', type: '' })
    try {
      // 코드 조회
      const q = query(
        collection(db, 'inviteCodes'),
        where('code', '==', code),
        where('used', '==', false)
      )
      const snap = await getDocs(q)
      if (snap.empty) {
        setMessage({ text: 'Invalid or expired code', type: 'error' })
        setJoining(false)
        return
      }

      const codeDoc = snap.docs[0]
      const codeData = codeDoc.data()

      // 만료 체크
      if (codeData.expiresAt.toDate() < new Date()) {
        setMessage({ text: 'This code has expired', type: 'error' })
        setJoining(false)
        return
      }

      // 이미 연결된 파트너인지 체크
      const existingQ = query(
        collection(db, 'partnerships'),
        where('depotUid', '==', user.uid),
        where('factoryUid', '==', codeData.factoryUid)
      )
      const existingSnap = await getDocs(existingQ)
      if (!existingSnap.empty) {
        setMessage({ text: 'Already partnered with this factory', type: 'error' })
        setJoining(false)
        return
      }

      // 파트너십 생성
      await addDoc(collection(db, 'partnerships'), {
        depotUid: user.uid,
        factoryUid: codeData.factoryUid,
        status: 'active',
        createdAt: serverTimestamp(),
      })

      // 코드 사용 처리
      await updateDoc(doc(db, 'inviteCodes', codeDoc.id), { used: true })

      setMessage({ text: 'Partnership created!', type: 'success' })
      setCodeInput('')
      fetchPartners()
    } catch {
      setMessage({ text: 'Failed to join. Please try again.', type: 'error' })
    } finally {
      setJoining(false)
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Partnerships</h2>

      {/* Factory: 초대 코드 생성 */}
      {role === 'factory' && (
        <div className="bg-white rounded-xl p-6 border border-zinc-200">
          <h3 className="text-lg font-bold mb-3">Invite a Depot</h3>
          <p className="text-zinc-500 text-sm mb-4">
            Generate an invite code and share it with your depot partner. Code expires in 7 days.
          </p>
          {inviteCode ? (
            <div className="flex items-center gap-4">
              <span className="text-3xl font-mono font-bold tracking-widest text-[#E07B0F]">
                {inviteCode}
              </span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(inviteCode)
                  setMessage({ text: 'Copied!', type: 'success' })
                }}
                className="px-3 py-1 text-sm rounded-lg border border-zinc-300 hover:bg-zinc-100"
              >
                Copy
              </button>
              <button
                onClick={handleGenerateCode}
                className="px-3 py-1 text-sm rounded-lg border border-zinc-300 hover:bg-zinc-100"
              >
                New Code
              </button>
            </div>
          ) : (
            <button
              onClick={handleGenerateCode}
              disabled={generatingCode}
              className="px-6 py-3 rounded-xl bg-[#E07B0F] text-white font-bold hover:bg-[#c96a0d] disabled:opacity-50"
            >
              {generatingCode ? 'Generating...' : 'Generate Invite Code'}
            </button>
          )}
        </div>
      )}

      {/* Depot: 초대 코드 입력 */}
      {role === 'depot' && (
        <div className="bg-white rounded-xl p-6 border border-zinc-200">
          <h3 className="text-lg font-bold mb-3">Join a Factory</h3>
          <p className="text-zinc-500 text-sm mb-4">
            Enter the invite code from your factory partner.
          </p>
          <form onSubmit={handleJoin} className="flex gap-3">
            <input
              type="text"
              value={codeInput}
              onChange={e => setCodeInput(e.target.value.toUpperCase())}
              placeholder="Enter code"
              maxLength={6}
              className="flex-1 px-4 py-3 text-xl font-mono tracking-widest text-center rounded-xl border-2 border-zinc-300 focus:border-[#E07B0F] focus:outline-none uppercase"
            />
            <button
              type="submit"
              disabled={joining || !codeInput.trim()}
              className="px-6 py-3 rounded-xl bg-[#E07B0F] text-white font-bold hover:bg-[#c96a0d] disabled:opacity-50"
            >
              {joining ? 'Joining...' : 'Join'}
            </button>
          </form>
        </div>
      )}

      {/* 메시지 */}
      {message.text && (
        <p className={`text-sm font-medium ${message.type === 'error' ? 'text-red-500' : 'text-green-600'}`}>
          {message.text}
        </p>
      )}

      {/* 파트너 목록 */}
      <div className="bg-white rounded-xl p-6 border border-zinc-200">
        <h3 className="text-lg font-bold mb-3">
          {role === 'factory' ? 'Connected Depots' : 'Connected Factories'}
        </h3>
        {loading ? (
          <p className="text-zinc-400">Loading...</p>
        ) : partners.length === 0 ? (
          <p className="text-zinc-400">No partnerships yet</p>
        ) : (
          <div className="space-y-3">
            {partners.map(p => (
              <div key={p.id} className="flex items-center justify-between py-3 border-b border-zinc-100 last:border-0">
                <div>
                  <p className="font-semibold">{p.partnerName}</p>
                  {p.partnerPhone && (
                    <p className="text-sm text-zinc-500">{p.partnerPhone}</p>
                  )}
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                  p.status === 'active'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-yellow-100 text-yellow-700'
                }`}>
                  {p.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
