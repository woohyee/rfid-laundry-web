import { useState, useEffect } from 'react'
import logo from '@/assets/logo.png'
import { signOut } from 'firebase/auth'
import { auth, db } from '@/lib/firebase'
import { doc, getDoc } from 'firebase/firestore'
import { useAuth } from '@/context/AuthContext'
import Tagging from '@/pages/Tagging'
import Receiving from '@/pages/Receiving'
import Lookup from '@/pages/Lookup'
import FactoryLostItems from '@/pages/FactoryLostItems'
import LostItems from '@/pages/LostItems'
import Announcements from '@/pages/Announcements'

// RFID 리더 있는 디포
const DEPOT_RFID_TABS = [
  { id: 'tagging', label: 'Tagging' },
  { id: 'receiving', label: 'Receiving' },
  { id: 'lookup', label: 'Lookup' },
  { id: 'lostItems', label: 'Lost Items' },
  { id: 'announcements', label: 'Notice' },
]

// RFID 리더 없는 디포
const DEPOT_BASIC_TABS = [
  { id: 'lostItems', label: 'Lost Items' },
  { id: 'announcements', label: 'Notice' },
]

const FACTORY_TABS = [
  { id: 'lostItems', label: 'Lost Items' },
  { id: 'announcements', label: 'Notice' },
]

// 역할별 테마
const THEME = {
  depot: {
    accent: '#E07B0F',
    accentHover: '#c96a0d',
    badge: 'Depot',
    badgeClass: 'bg-[#E07B0F]',
    headerBorder: '1px solid rgba(255,255,255,0.08)',
  },
  factory: {
    accent: '#2563EB',
    accentHover: '#1d4ed8',
    badge: 'Factory',
    badgeClass: 'bg-[#2563EB]',
    headerBorder: '1px solid rgba(37,99,235,0.3)',
  },
}

export default function Layout() {
  const { user, shop } = useAuth()
  const role = shop?.role || 'depot'
  const hasRfid = shop?.hasRfidReader !== false // 기존 유저는 true 기본
  const tabs = role === 'factory'
    ? FACTORY_TABS
    : hasRfid ? DEPOT_RFID_TABS : DEPOT_BASIC_TABS
  const theme = THEME[role]
  const [activeTab, setActiveTab] = useState(tabs[0]?.id || 'tagging')
  const [codeCopied, setCodeCopied] = useState(false)

  // 디포: 연결된 공장명 조회
  const [connectedFactory, setConnectedFactory] = useState(null)
  useEffect(() => {
    if (role !== 'depot' || !shop?.factoryUid) return
    getDoc(doc(db, 'shops', shop.factoryUid)).then(snap => {
      if (snap.exists()) setConnectedFactory(snap.data().name)
    }).catch(() => { /* 공장명 조회 실패는 UI에 표시 안 함 */ })
  }, [role, shop?.factoryUid])

  async function handleSignOut() {
    await signOut(auth)
  }

  function handleCopyCode() {
    if (!shop?.factoryCode) return
    navigator.clipboard.writeText(shop.factoryCode)
    setCodeCopied(true)
    setTimeout(() => setCodeCopied(false), 2000)
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* 상단 헤더 */}
      <header className="px-6 sm:px-10 py-4" style={{ background: '#18181B' }}>
        <div className="flex items-center gap-4">
          <img src={logo} alt="RFID Laundry" className="h-20 w-auto" />
          <div>
            <div className="flex items-center gap-4">
              <h1 className="text-3xl font-bold" style={{ color: '#FAFAFA', letterSpacing: '-0.02em' }}>
                RFID Laundry
              </h1>
              <span className={`${theme.badgeClass} text-white text-xs font-bold px-2 py-1 rounded-md uppercase tracking-wider`}>
                {theme.badge}
              </span>
            </div>
            {shop?.name && (
              <p className="text-xl font-semibold mt-1" style={{ color: 'rgba(255,255,255,0.75)' }}>{shop.name}</p>
            )}
          </div>
        </div>
      </header>

      {/* 탭 네비게이션 + Sign Out */}
      <nav className="px-6 sm:px-10" style={{ background: '#18181B', borderBottom: theme.headerBorder }}>
        <div className="flex items-center gap-4">
          <div className="flex gap-0">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-3 text-2xl font-bold rounded-t-lg transition-colors ${
                  activeTab === tab.id
                    ? 'text-white'
                    : 'text-white/55 hover:text-white/85 hover:bg-white/10'
                }`}
                style={activeTab === tab.id ? { background: theme.accent } : undefined}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {/* Factory: 공장코드 표시 */}
          {role === 'factory' && shop?.factoryCode && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/50">Code:</span>
              <span className="text-lg font-mono font-bold tracking-widest text-white bg-white/20 px-3 py-1 rounded-lg">
                {shop.factoryCode}
              </span>
              <button
                onClick={handleCopyCode}
                className="text-xs text-white/60 hover:text-white transition-colors"
              >
                {codeCopied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          )}
          {/* Depot: 연결된 공장 표시 */}
          {role === 'depot' && connectedFactory && (
            <span className="text-sm text-white/50">
              Connected to <span className="text-white/80 font-medium">{connectedFactory}</span>
            </span>
          )}
          <button
            onClick={handleSignOut}
            className="text-lg font-bold px-4 py-2 rounded-lg transition-colors border border-red-500 text-red-400 hover:bg-red-500 hover:text-white"
          >
            Sign Out
          </button>
        </div>
      </nav>

      {/* 탭 컨텐츠 */}
      <main className="flex-1 p-6 sm:p-10 max-w-4xl w-full">
        {role === 'depot' && (
          <>
            {activeTab === 'tagging' && <Tagging />}
            {activeTab === 'receiving' && <Receiving />}
            {activeTab === 'lookup' && <Lookup />}
          </>
        )}
        {activeTab === 'lostItems' && role === 'depot' && <LostItems />}
        {activeTab === 'lostItems' && role === 'factory' && <FactoryLostItems />}
        {activeTab === 'announcements' && <Announcements />}
      </main>
    </div>
  )
}
