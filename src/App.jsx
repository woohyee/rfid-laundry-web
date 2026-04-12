import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import Login from '@/pages/Login'
import DepotLayout from '@/components/DepotLayout'
import FactoryPublicView from '@/pages/FactoryPublicView'
import Onboarding from '@/pages/Onboarding'

function AppRoutes() {
  const { user, shop, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (!user) {
    // PWA 홈화면에서 열면 / 로 접속됨 → 저장된 공장 뷰로 리다이렉트
    const savedFactoryUid = localStorage.getItem('factoryViewUid')
    return (
      <Routes>
        <Route path="/view/:depotUid" element={<FactoryPublicView />} />
        {savedFactoryUid
          ? <Route path="/" element={<Navigate to={`/view/${savedFactoryUid}`} />} />
          : null
        }
        <Route path="*" element={<Login />} />
      </Routes>
    )
  }

  if (!shop) {
    return (
      <Routes>
        <Route path="/view/:depotUid" element={<FactoryPublicView />} />
        <Route path="*" element={<Onboarding />} />
      </Routes>
    )
  }

  return (
    <Routes>
      <Route path="/view/:depotUid" element={<FactoryPublicView />} />
      <Route path="/" element={<DepotLayout />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
