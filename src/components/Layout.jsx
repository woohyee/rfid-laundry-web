import { useState } from 'react'
import logo from '@/assets/logo.png'
import { signOut } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { useAuth } from '@/context/AuthContext'
import Tagging from '@/pages/Tagging'
import Receiving from '@/pages/Receiving'
import Lookup from '@/pages/Lookup'

const TABS = [
  { id: 'tagging', label: 'Tagging' },
  { id: 'receiving', label: 'Receiving' },
  { id: 'lookup', label: 'Lookup' },
]

export default function Layout() {
  const [activeTab, setActiveTab] = useState('tagging')
  const { shop } = useAuth()

  async function handleSignOut() {
    await signOut(auth)
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* 상단 헤더 */}
      <header className="px-6 sm:px-10 py-4" style={{ background: '#18181B' }}>
        <div className="flex items-center gap-4">
          <img src={logo} alt="RFID Laundry" className="h-16 w-auto" />
          <div>
            <h1 className="text-3xl font-bold" style={{ color: '#FAFAFA', letterSpacing: '-0.02em' }}>
              RFID Laundry
            </h1>
            {shop?.name && (
              <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.45)' }}>{shop.name}</p>
            )}
          </div>
        </div>
      </header>

      {/* 탭 네비게이션 + Sign Out */}
      <nav className="px-6 sm:px-10" style={{ background: '#18181B', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex items-center justify-between">
          <div className="flex gap-0">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-4 text-xl font-semibold border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-[#E07B0F] text-[#E07B0F]'
                    : 'border-transparent text-white/50 hover:text-white/80'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <button
            onClick={handleSignOut}
            className="text-sm font-semibold px-3 py-2 rounded-lg transition-colors text-white/35 hover:text-red-300 hover:bg-red-500/10"
          >
            Sign Out
          </button>
        </div>
      </nav>

      {/* 탭 컨텐츠 */}
      <main className="flex-1 p-6 sm:p-10 max-w-4xl w-full">
        {activeTab === 'tagging' && <Tagging />}
        {activeTab === 'receiving' && <Receiving />}
        {activeTab === 'lookup' && <Lookup />}
      </main>
    </div>
  )
}
