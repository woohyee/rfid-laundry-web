import { useState } from 'react'
import { createUserWithEmailAndPassword } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { Button } from '@/components/ui/button'

export default function SignUp({ onBack }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      // Firebase Auth 계정만 생성. shops 문서는 Onboarding에서 생성.
      await createUserWithEmailAndPassword(auth, email, password)
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') setError('Email already in use.')
      else if (err.code === 'auth/weak-password') setError('Password must be at least 6 characters.')
      else setError('Sign up failed. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm p-8 rounded-2xl border border-border shadow-sm bg-card">
        <h1 className="text-2xl font-semibold text-center mb-2">Create Account</h1>
        <p className="text-muted-foreground text-center text-sm mb-6">
          Sign up, then set up your business profile.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="shop@example.com"
              required
              autoFocus
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              required
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full" disabled={loading}>
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
