import { useState } from 'react'
import logo from '@/assets/logo.png'
import { signOut } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { useAuth } from '@/context/AuthContext'
import Tagging from '@/pages/Tagging'
import Receiving from '@/pages/Receiving'
import Lookup from '@/pages/Lookup'
import MissingItems from '@/pages/MissingItems'

const TABS = [
  { id: 'tagging', label: 'Tagging' },
  { id: 'receiving', label: 'Receiving' },
  { id: 'lookup', label: 'Lookup' },
  { id: 'missing', label: 'Missing Items' },
]

export default function DepotLayout() {
  const { shop } = useAuth()
  const [activeTab, setActiveTab] = useState('tagging')

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* 헤더 */}
      <header className="px-6 sm:px-10 py-4" style={{ background: '#18181B' }}>
        <div className="flex items-center gap-4">
          <img src={logo} alt="RFID Laundry" className="h-20 w-auto" />
          <div>
            <div className="flex items-center gap-4">
              <h1 className="text-3xl font-bold" style={{ color: '#FAFAFA', letterSpacing: '-0.02em' }}>
                RFID Laundry
              </h1>
              <span className="bg-[#E07B0F] text-white text-xs font-bold px-2 py-1 rounded-md uppercase tracking-wider">
                Depot
              </span>
            </div>
            {shop?.name && (
              <p className="text-xl font-semibold mt-1" style={{ color: 'rgba(255,255,255,0.75)' }}>{shop.name}</p>
            )}
          </div>
        </div>
      </header>

      {/* 탭 + Sign Out */}
      <nav className="px-6 sm:px-10" style={{ background: '#18181B', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex items-center gap-4">
          <div className="flex gap-0">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-3 text-2xl font-bold rounded-t-lg transition-colors ${
                  activeTab === tab.id
                    ? 'text-white'
                    : 'text-white/55 hover:text-white/85 hover:bg-white/10'
                }`}
                style={activeTab === tab.id ? { background: '#E07B0F' } : undefined}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => signOut(auth)}
            className="text-lg font-bold px-4 py-2 rounded-lg transition-colors border border-red-500 text-red-400 hover:bg-red-500 hover:text-white"
          >
            Sign Out
          </button>
        </div>
      </nav>

      {/* 컨텐츠 */}
      <main className="flex-1 p-6 sm:p-10 max-w-4xl w-full">
        {activeTab === 'tagging' && <Tagging />}
        {activeTab === 'receiving' && <Receiving />}
        {activeTab === 'lookup' && <Lookup />}
        {activeTab === 'missing' && <MissingItems />}
      </main>
    </div>
  )
}
