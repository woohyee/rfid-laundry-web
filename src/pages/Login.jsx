import { useState } from 'react'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { Button } from '@/components/ui/button'
import Onboarding from '@/pages/Onboarding'

// 공장 아이디 → 내부 이메일 변환
function factoryIdToEmail(id) {
  return `${id.trim().toLowerCase()}@factory.rfidlaundry.app`
}

export default function Login() {
  const [mode, setMode] = useState('depot') // 'depot' | 'factory'
  const [email, setEmail] = useState('')
  const [factoryId, setFactoryId] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showSignUp, setShowSignUp] = useState(false)

  if (showSignUp) return <Onboarding onBack={() => setShowSignUp(false)} />

  async function handleLogin(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const loginEmail = mode === 'factory' ? factoryIdToEmail(factoryId) : email
      await signInWithEmailAndPassword(auth, loginEmail, password)
    } catch {
      setError(mode === 'factory' ? 'Invalid ID or password' : 'Invalid email or password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm p-6 sm:p-8 rounded-2xl border border-border shadow-sm bg-card">
        <h1 className="text-2xl font-semibold text-center mb-2">RFID Laundry</h1>
        <p className="text-muted-foreground text-center text-sm mb-6">Sign in to continue</p>

        {/* 역할 토글 */}
        <div className="flex rounded-lg bg-zinc-100 p-1 mb-6">
          <button
            type="button"
            onClick={() => { setMode('depot'); setError('') }}
            className={`flex-1 py-2 text-sm font-bold rounded-md transition-colors ${
              mode === 'depot' ? 'bg-white text-[#E07B0F] shadow-sm' : 'text-zinc-500'
            }`}
          >
            Depot
          </button>
          <button
            type="button"
            onClick={() => { setMode('factory'); setError('') }}
            className={`flex-1 py-2 text-sm font-bold rounded-md transition-colors ${
              mode === 'factory' ? 'bg-white text-[#2563EB] shadow-sm' : 'text-zinc-500'
            }`}
          >
            Factory
          </button>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          {mode === 'depot' ? (
            <div>
              <label className="block text-sm font-medium mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="shop@example.com"
                required
                autoFocus
              />
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium mb-1.5">Factory ID</label>
              <input
                type="text"
                value={factoryId}
                onChange={e => setFactoryId(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="e.g. tophat"
                required
                autoFocus
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="••••••••"
              required
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button
            type="submit"
            className={`w-full ${mode === 'factory' ? 'bg-[#2563EB] hover:bg-[#1d4ed8]' : ''}`}
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground mt-4">
          New shop?{' '}
          <button onClick={() => setShowSignUp(true)} className="text-foreground font-medium hover:underline">
            Create Account
          </button>
        </p>
      </div>
    </div>
  )
}
