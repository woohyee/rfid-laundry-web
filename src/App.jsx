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
    return (
      <Routes>
        <Route path="/view/:depotUid" element={<FactoryPublicView />} />
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
