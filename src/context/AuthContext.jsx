import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [shop, setShop] = useState(null)
  const [loading, setLoading] = useState(true)
  // 등록 중 플래그: onAuthStateChanged가 shop 조회를 건너뛰게 함
  const [registering, setRegistering] = useState(false)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser)
        // 등록 중이면 shop 조회 스킵 (Onboarding이 직접 setShop 호출)
        if (!registering) {
          const shopDoc = await getDoc(doc(db, 'shops', firebaseUser.uid))
          if (shopDoc.exists()) {
            setShop(shopDoc.data())
          }
        }
      } else {
        setUser(null)
        setShop(null)
      }
      setLoading(false)
    })

    return unsubscribe
  }, [registering])

  return (
    <AuthContext.Provider value={{ user, shop, setShop, loading, setRegistering }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
