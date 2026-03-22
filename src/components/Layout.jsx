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
      <header className="border-border bg-card px-6 sm:px-10 py-4">
        <div className="flex items-center gap-4">
          <img src={logo} alt="RFID Laundry" className="h-20 w-auto" />
          <h1 className="text-4xl font-semibold">RFID Laundry</h1>
        </div>
      </header>

      {/* 탭 네비게이션 + Sign Out */}
      <nav className="border-b border-t border-border bg-card px-6 sm:px-10">
        <div className="flex items-center gap-10">
          <div className="flex gap-0">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-4 text-2xl font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-foreground text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            {shop && <span className="hidden sm:inline text-sm text-muted-foreground">{shop.name}</span>}
            <button
              onClick={handleSignOut}
              className="text-2xl font-medium text-red-500 hover:text-red-700 transition-colors"
            >
              Sign Out
            </button>
          </div>
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
