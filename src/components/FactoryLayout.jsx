import logo from '@/assets/logo.png'
import { signOut } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { useAuth } from '@/context/AuthContext'
import FactoryView from '@/pages/FactoryView'

export default function FactoryLayout() {
  const { shop } = useAuth()

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* 헤더 — 모바일 퍼스트 */}
      <header className="px-4 sm:px-10 py-3 sm:py-4" style={{ background: '#18181B' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt="RFID Laundry" className="h-12 sm:h-20 w-auto" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-3xl font-bold" style={{ color: '#FAFAFA', letterSpacing: '-0.02em' }}>
                  RFID Laundry
                </h1>
                <span className="bg-[#2563EB] text-white text-xs font-bold px-2 py-1 rounded-md uppercase tracking-wider">
                  Factory
                </span>
              </div>
              {shop?.name && (
                <p className="text-sm sm:text-xl font-semibold mt-0.5" style={{ color: 'rgba(255,255,255,0.75)' }}>{shop.name}</p>
              )}
            </div>
          </div>
          <button
            onClick={() => signOut(auth)}
            className="text-sm sm:text-lg font-bold px-3 py-2 rounded-lg transition-colors border border-red-500 text-red-400 hover:bg-red-500 hover:text-white"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* 컨텐츠 — 단일 뷰, 탭 없음 */}
      <main className="flex-1 p-4 sm:p-10 max-w-2xl w-full mx-auto">
        <FactoryView />
      </main>
    </div>
  )
}
