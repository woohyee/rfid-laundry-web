import logo from '@/assets/logo.png'
import { signOut } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { useAuth } from '@/context/AuthContext'
import FactoryView from '@/pages/FactoryView'

export default function FactoryLayout() {
  const { shop } = useAuth()

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* 헤더 */}
      <header className="px-4 sm:px-10 py-3 sm:py-4" style={{ background: '#18181B' }}>
        <div className="flex items-center gap-3">
          <img src={logo} alt="RFID Laundry" className="h-10 sm:h-20 w-auto" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-3xl font-bold truncate" style={{ color: '#FAFAFA', letterSpacing: '-0.02em' }}>
                RFID Laundry
              </h1>
              <span className="bg-[#2563EB] text-white text-[10px] sm:text-xs font-bold px-1.5 py-0.5 rounded uppercase tracking-wider flex-shrink-0">
                Factory
              </span>
            </div>
            {shop?.name && (
              <p className="text-xs sm:text-xl font-semibold mt-0.5 truncate" style={{ color: 'rgba(255,255,255,0.75)' }}>{shop.name}</p>
            )}
          </div>
          <button
            onClick={() => signOut(auth)}
            className="text-[11px] sm:text-sm font-bold px-2 py-1 sm:px-3 sm:py-2 rounded-lg border border-white/20 text-white/60 hover:bg-white/10 flex-shrink-0"
          >
            Sign Out
          </button>
        </div>
      </header>

      <main className="flex-1 p-4 sm:p-10 max-w-2xl w-full mx-auto">
        <FactoryView />
      </main>
    </div>
  )
}
