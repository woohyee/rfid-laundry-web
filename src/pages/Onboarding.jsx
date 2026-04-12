import { useState } from 'react'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { createUserWithEmailAndPassword } from 'firebase/auth'
import { auth, db } from '@/lib/firebase'
import { useAuth } from '@/context/AuthContext'
import logo from '@/assets/logo.png'

export default function Onboarding({ onBack }) {
  const { setShop, setRegistering } = useAuth()

  // 스텝: 'role' → 'profile'
  const [step, setStep] = useState('role')
  const [role, setRole] = useState('')

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

  function handleRoleSelect(r) {
    setRole(r)
    setStep('profile')
  }

  // Auth 계정 생성 + shop 문서 생성
  async function handleSubmit(e) {
    e.preventDefault()
    if (!email.trim()) return setError('Email is required')
    if (password.length < 6) return setError('Password must be at least 6 characters')
    if (!name.trim()) return setError('Business name is required')
    if (!phone.trim()) return setError('Phone number is required')

    setSaving(true)
    setError('')
    setRegistering(true) // onAuthStateChanged가 shop 조회를 건너뛰게 함
    try {
      // 1. Firebase Auth 계정 생성
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password)
      const uid = cred.user.uid

      // 2. shop 문서 생성
      const shopData = {
        name: name.trim(),
        phone: phone.trim(),
        role,
        address: address.trim() || null,
        ...(role === 'depot' && { hasRfidReader }),
        shopId: uid,
        createdAt: serverTimestamp(),
      }
      await setDoc(doc(db, 'shops', uid), shopData)

      setRegistering(false)
      setShop(shopData)
    } catch (err) {
      setRegistering(false)
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

          {/* 스텝 2: 프로필 입력 */}
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
                        : 'You can still use Missing Items.'}
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
                  onClick={() => { setStep('role'); setRole('') }}
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
