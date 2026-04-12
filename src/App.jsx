import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import Login from '@/pages/Login'
import DepotLayout from '@/components/DepotLayout'
import FactoryLayout from '@/components/FactoryLayout'
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
    return (
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    )
  }

  // 로그인 됐지만 shop 문서 없음 → 온보딩
  if (!shop) {
    return (
      <Routes>
        <Route path="*" element={<Onboarding />} />
      </Routes>
    )
  }

  // 역할별 레이아웃 분리
  const LayoutComponent = shop.role === 'factory' ? FactoryLayout : DepotLayout

  return (
    <Routes>
      <Route path="/" element={<LayoutComponent />} />
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
