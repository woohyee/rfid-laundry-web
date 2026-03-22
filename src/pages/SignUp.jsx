import { useState } from 'react'
import { createUserWithEmailAndPassword } from 'firebase/auth'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { Button } from '@/components/ui/button'

export default function SignUp({ onBack }) {
  const [form, setForm] = useState({
    shopName: '',
    ownerName: '',
    bizPhone: '',
    personalPhone: '',
    email: '',
    password: '',
    address: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { user } = await createUserWithEmailAndPassword(auth, form.email, form.password)
      // Firestore에 상호 정보 저장
      await setDoc(doc(db, 'shops', user.uid), {
        name: form.shopName,
        ownerName: form.ownerName,
        bizPhone: form.bizPhone,
        personalPhone: form.personalPhone,
        email: form.email,
        address: form.address,
        createdAt: serverTimestamp(),
      })
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') setError('Email already in use.')
      else if (err.code === 'auth/weak-password') setError('Password must be at least 6 characters.')
      else setError('Sign up failed: ' + err.message)
      setLoading(false)
    }
  }

  const fields = [
    { name: 'shopName', label: 'Shop Name', type: 'text', placeholder: 'Dodo Cleaners' },
    { name: 'ownerName', label: 'Owner Name', type: 'text', placeholder: 'John Doe' },
    { name: 'bizPhone', label: 'Business Phone', type: 'tel', placeholder: '02-1234-5678' },
    { name: 'personalPhone', label: 'Personal Phone', type: 'tel', placeholder: '010-1234-5678' },
    { name: 'address', label: 'Address', type: 'text', placeholder: '123 Main St, Seoul' },
    { name: 'email', label: 'Email', type: 'email', placeholder: 'shop@example.com' },
    { name: 'password', label: 'Password', type: 'password', placeholder: '••••••••' },
  ]

  return (
    <div className="min-h-screen flex items-center justify-center bg-background py-10">
      <div className="w-full max-w-sm p-8 rounded-2xl border border-border shadow-sm bg-card">
        <h1 className="text-2xl font-semibold text-center mb-2">Create Account</h1>
        <p className="text-muted-foreground text-center text-sm mb-6">Register your laundry shop</p>

        <form onSubmit={handleSubmit} className="space-y-3">
          {fields.map(({ name, label, type, placeholder }) => (
            <div key={name}>
              <label className="block text-sm font-medium mb-1">{label}</label>
              <input
                type={type}
                name={name}
                value={form[name]}
                onChange={handleChange}
                placeholder={placeholder}
                required
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          ))}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full mt-2" disabled={loading}>
            {loading ? 'Creating account...' : 'Sign Up'}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground mt-4">
          Already have an account?{' '}
          <button onClick={onBack} className="text-foreground font-medium hover:underline">
            Sign In
          </button>
        </p>
      </div>
    </div>
  )
}
