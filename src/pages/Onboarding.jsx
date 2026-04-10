import { useState } from 'react'
import {
  doc, setDoc, addDoc, deleteDoc, getDoc, collection, query, where, getDocs,
  serverTimestamp
} from 'firebase/firestore'
import { createUserWithEmailAndPassword } from 'firebase/auth'
import { auth, db } from '@/lib/firebase'
import { useAuth } from '@/context/AuthContext'
import logo from '@/assets/logo.png'

// 공장명에서 업체코드 접두어 추출 (첫 단어, 최대 8자)
function extractPrefix(factoryName) {
  const firstWord = (factoryName || 'FACTORY').split(/\s+/)[0]
  return firstWord.slice(0, 8)
}

// 업체코드 생성: TopHat001, TopHat002, ...
async function generateDepotCode(factoryUid) {
  // 공장 정보에서 이름 가져오기
  const factoryDoc = await getDoc(doc(db, 'shops', factoryUid))
  const factoryName = factoryDoc.exists() ? factoryDoc.data().name : 'FACTORY'
  const prefix = extractPrefix(factoryName)

  // 해당 공장 소속 디포 수 조회
  const partnerSnap = await getDocs(
    query(collection(db, 'partnerships'), where('factoryUid', '==', factoryUid))
  )
  const num = partnerSnap.size + 1
  return `${prefix}${String(num).padStart(3, '0')}`
}

export default function Onboarding({ onBack }) {
  const { setShop } = useAuth()

  // 스텝: 'role' → 'invite' (depot만) → 'profile'
  const [step, setStep] = useState('role')
  const [role, setRole] = useState('')

  // 초대코드 (depot만)
  const [codeInput, setCodeInput] = useState('')
  const [codeError, setCodeError] = useState('')
  const [validatingCode, setValidatingCode] = useState(false)
  const [validatedCode, setValidatedCode] = useState(null) // { docId, factoryUid }

  // 계정 정보
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  // 프로필
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [hasRfidReader, setHasRfidReader] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // 역할 선택 후
  function handleRoleSelect(r) {
    setRole(r)
    if (r === 'factory') {
      setStep('profile') // 공장은 초대코드 불필요
    } else {
      setStep('invite') // 디포는 초대코드 먼저
    }
  }

  // 초대코드 검증
  async function handleCodeValidate(e) {
    e.preventDefault()
    const code = codeInput.trim().toUpperCase()
    if (!code) return

    setValidatingCode(true)
    setCodeError('')
    try {
      const q = query(
        collection(db, 'inviteCodes'),
        where('code', '==', code),
        where('used', '==', false)
      )
      const snap = await getDocs(q)
      if (snap.empty) {
        setCodeError('Invalid or expired code')
        setValidatingCode(false)
        return
      }

      const codeDoc = snap.docs[0]
      const codeData = codeDoc.data()

      if (codeData.expiresAt.toDate() < new Date()) {
        setCodeError('This code has expired')
        setValidatingCode(false)
        return
      }

      setValidatedCode({ docId: codeDoc.id, factoryUid: codeData.factoryUid })
      setStep('profile')
    } catch {
      setCodeError('Verification failed. Please try again.')
    } finally {
      setValidatingCode(false)
    }
  }

  // 통합 등록: Auth 계정 생성 + shop 문서 + partnership + 초대코드 삭제
  async function handleSubmit(e) {
    e.preventDefault()
    if (!email.trim()) return setError('Email is required')
    if (password.length < 6) return setError('Password must be at least 6 characters')
    if (!name.trim()) return setError('Business name is required')
    if (!phone.trim()) return setError('Phone number is required')

    setSaving(true)
    setError('')
    try {
      // 1. Firebase Auth 계정 생성
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password)
      const uid = cred.user.uid

      // 2. 디포: 업체코드 생성
      let depotCode = null
      if (role === 'depot' && validatedCode) {
        depotCode = await generateDepotCode(validatedCode.factoryUid)
      }

      // 3. shop 문서 생성
      const shopData = {
        name: name.trim(),
        phone: phone.trim(),
        role,
        address: address.trim() || null,
        hasRfidReader: role === 'depot' ? hasRfidReader : null,
        depotCode: depotCode,
        shopId: uid,
        createdAt: serverTimestamp(),
      }
      await setDoc(doc(db, 'shops', uid), shopData)

      // 4. 디포: 파트너십 생성 + 초대코드 삭제
      if (role === 'depot' && validatedCode) {
        await addDoc(collection(db, 'partnerships'), {
          depotUid: uid,
          factoryUid: validatedCode.factoryUid,
          depotCode,
          status: 'active',
          createdAt: serverTimestamp(),
        })
        await deleteDoc(doc(db, 'inviteCodes', validatedCode.docId))
      }

      setShop(shopData)
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') setError('Email already in use.')
      else if (err.code === 'auth/weak-password') setError('Password must be at least 6 characters.')
      else setError('Registration failed. Please try again.')
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* 로고 */}
        <div className="flex items-center gap-4 mb-8">
          <img src={logo} alt="RFID Laundry" className="h-16 w-auto" />
          <h1 className="text-2xl font-bold">RFID Laundry</h1>
        </div>

        <div className="bg-white rounded-2xl p-8 shadow-sm border border-zinc-200">

          {/* 스텝 1: 역할 선택 */}
          {step === 'role' && (
            <>
              <h2 className="text-xl font-bold mb-1">Welcome!</h2>
              <p className="text-zinc-500 mb-6">Select your business type to get started.</p>
              <div className="space-y-3">
                <button
                  onClick={() => handleRoleSelect('depot')}
                  className="w-full py-4 rounded-xl text-lg font-bold border-2 border-zinc-300 hover:border-[#E07B0F] hover:bg-orange-50 transition-colors text-left px-6"
                >
                  <span className="text-xl">Depot</span>
                  <p className="text-sm text-zinc-400 font-normal mt-1">Laundry collection point</p>
                </button>
                <button
                  onClick={() => handleRoleSelect('factory')}
                  className="w-full py-4 rounded-xl text-lg font-bold border-2 border-zinc-300 hover:border-[#2563EB] hover:bg-blue-50 transition-colors text-left px-6"
                >
                  <span className="text-xl">Factory</span>
                  <p className="text-sm text-zinc-400 font-normal mt-1">Laundry processing plant</p>
                </button>
              </div>
              {onBack && (
                <button
                  onClick={onBack}
                  className="w-full py-2 text-sm text-zinc-400 hover:text-zinc-600 mt-4"
                >
                  Back to Sign In
                </button>
              )}
            </>
          )}

          {/* 스텝 2: 초대코드 (depot만) */}
          {step === 'invite' && (
            <>
              <h2 className="text-xl font-bold mb-1">Enter Invite Code</h2>
              <p className="text-zinc-500 mb-6">Enter the code provided by your factory partner.</p>
              <form onSubmit={handleCodeValidate} className="space-y-4">
                <input
                  type="text"
                  value={codeInput}
                  onChange={e => setCodeInput(e.target.value.toUpperCase())}
                  placeholder="e.g. ABC123"
                  maxLength={6}
                  autoFocus
                  className="w-full px-4 py-4 text-2xl font-mono tracking-[0.3em] text-center rounded-xl border-2 border-zinc-300 focus:border-[#E07B0F] focus:outline-none uppercase"
                />
                {codeError && (
                  <p className="text-red-500 text-sm font-medium">{codeError}</p>
                )}
                <button
                  type="submit"
                  disabled={validatingCode || !codeInput.trim()}
                  className="w-full py-4 text-xl font-bold rounded-xl bg-[#E07B0F] text-white hover:bg-[#c96a0d] disabled:opacity-50 transition-colors"
                >
                  {validatingCode ? 'Verifying...' : 'Verify Code'}
                </button>
                <button
                  type="button"
                  onClick={() => { setStep('role'); setRole('') }}
                  className="w-full py-2 text-sm text-zinc-400 hover:text-zinc-600"
                >
                  Back
                </button>
              </form>
            </>
          )}

          {/* 스텝 3: 프로필 입력 */}
          {step === 'profile' && (
            <>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-xl font-bold">Business Profile</h2>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-md text-white uppercase ${
                  role === 'factory' ? 'bg-[#2563EB]' : 'bg-[#E07B0F]'
                }`}>
                  {role}
                </span>
              </div>
              <p className="text-zinc-500 mb-6">Fill in your business details.</p>

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* 이메일 */}
                <div>
                  <label className="block text-sm font-semibold mb-2">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="shop@example.com"
                    autoFocus
                    className="w-full px-4 py-3 text-lg rounded-xl border-2 border-zinc-300 focus:border-[#E07B0F] focus:outline-none"
                  />
                </div>

                {/* 비밀번호 */}
                <div>
                  <label className="block text-sm font-semibold mb-2">
                    Password <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="w-full px-4 py-3 text-lg rounded-xl border-2 border-zinc-300 focus:border-[#E07B0F] focus:outline-none"
                  />
                </div>

                <hr className="border-zinc-200" />

                {/* 업체명 */}
                <div>
                  <label className="block text-sm font-semibold mb-2">
                    Business Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. Dodo Cleaners"
                    className="w-full px-4 py-3 text-lg rounded-xl border-2 border-zinc-300 focus:border-[#E07B0F] focus:outline-none"
                  />
                </div>

                {/* 전화번호 */}
                <div>
                  <label className="block text-sm font-semibold mb-2">
                    Phone <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="e.g. 021-234-5678"
                    className="w-full px-4 py-3 text-lg rounded-xl border-2 border-zinc-300 focus:border-[#E07B0F] focus:outline-none"
                  />
                </div>

                {/* 주소 */}
                <div>
                  <label className="block text-sm font-semibold mb-2">
                    Address <span className="text-zinc-400">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={address}
                    onChange={e => setAddress(e.target.value)}
                    placeholder="Business address"
                    className="w-full px-4 py-3 text-lg rounded-xl border-2 border-zinc-300 focus:border-[#E07B0F] focus:outline-none"
                  />
                </div>

                {/* RFID 리더 옵션 (depot만) */}
                {role === 'depot' && (
                  <div>
                    <label className="block text-sm font-semibold mb-2">RFID Reader</label>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => setHasRfidReader(true)}
                        className={`flex-1 py-3 rounded-xl text-sm font-bold border-2 transition-colors ${
                          hasRfidReader
                            ? 'border-[#E07B0F] bg-[#E07B0F] text-white'
                            : 'border-zinc-300 text-zinc-500 hover:border-zinc-400'
                        }`}
                      >
                        Yes, I have one
                      </button>
                      <button
                        type="button"
                        onClick={() => setHasRfidReader(false)}
                        className={`flex-1 py-3 rounded-xl text-sm font-bold border-2 transition-colors ${
                          !hasRfidReader
                            ? 'border-zinc-600 bg-zinc-600 text-white'
                            : 'border-zinc-300 text-zinc-500 hover:border-zinc-400'
                        }`}
                      >
                        No
                      </button>
                    </div>
                    <p className="text-xs text-zinc-400 mt-2">
                      {hasRfidReader
                        ? 'Tagging, Receiving, and Lookup features will be enabled.'
                        : 'You can still use Lost Items and Announcements.'}
                    </p>
                  </div>
                )}

                {error && (
                  <p className="text-red-500 text-sm font-medium">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={saving}
                  className={`w-full py-4 text-xl font-bold rounded-xl text-white disabled:opacity-50 transition-colors ${
                    role === 'factory'
                      ? 'bg-[#2563EB] hover:bg-[#1d4ed8]'
                      : 'bg-[#E07B0F] hover:bg-[#c96a0d]'
                  }`}
                >
                  {saving ? 'Registering...' : 'Register'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (role === 'depot') {
                      setStep('invite')
                    } else {
                      setStep('role')
                      setRole('')
                    }
                  }}
                  className="w-full py-2 text-sm text-zinc-400 hover:text-zinc-600"
                >
                  Back
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
