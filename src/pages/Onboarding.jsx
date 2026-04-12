import { useState } from 'react'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { createUserWithEmailAndPassword } from 'firebase/auth'
import { auth, db } from '@/lib/firebase'
import { useAuth } from '@/context/AuthContext'
import logo from '@/assets/logo.png'

export default function Onboarding({ onBack }) {
  const { setShop, setRegistering } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email.trim()) return setError('Email is required')
    if (password.length < 6) return setError('Password must be at least 6 characters')
    if (!name.trim()) return setError('Business name is required')
    if (!phone.trim()) return setError('Phone number is required')

    setSaving(true)
    setError('')
    setRegistering(true)
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password)
      const uid = cred.user.uid

      const shopData = {
        name: name.trim(),
        phone: phone.trim(),
        role: 'depot',
        address: address.trim() || null,
        hasRfidReader: true,
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
        <div className="flex items-center gap-4 mb-8">
          <img src={logo} alt="RFID Laundry" className="h-16 w-auto" />
          <h1 className="text-2xl font-bold">RFID Laundry</h1>
        </div>

        <div className="bg-white rounded-2xl p-8 shadow-sm border border-zinc-200">
          <h2 className="text-xl font-bold mb-1">Create Account</h2>
          <p className="text-zinc-500 mb-6">Set up your laundry shop.</p>

          <form onSubmit={handleSubmit} className="space-y-5">
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

            {error && <p className="text-red-500 text-sm font-medium">{error}</p>}

            <button
              type="submit"
              disabled={saving}
              className="w-full py-4 text-xl font-bold rounded-xl text-white bg-[#E07B0F] hover:bg-[#c96a0d] disabled:opacity-50 transition-colors"
            >
              {saving ? 'Registering...' : 'Register'}
            </button>

            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="w-full py-2 text-sm text-zinc-400 hover:text-zinc-600"
              >
                Back to Sign In
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  )
}
