import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import SixHats from './pages/SixHats'
import Login from './pages/Login'
import Knowledge from './pages/Knowledge'
import { authApi, isAuthenticated, type User } from './api/auth'

async function initAuth(): Promise<User | null> {
  if (isAuthenticated()) {
    try {
      const { user } = await authApi.me()
      return user
    } catch {
      authApi.logout()
      return null
    }
  }
  return null
}

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    initAuth()
      .then(setUser)
      .finally(() => setLoading(false))
  }, [])

  const handleLogin = (user: User) => {
    setUser(user)
  }

  const handleLogout = () => {
    authApi.logout()
    setUser(null)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* 登入頁面 */}
        <Route
          path="/login"
          element={
            user && !authApi.isAnonymous(user)
              ? <Navigate to="/" replace />
              : <Login onLogin={handleLogin} />
          }
        />

        {/* 主頁面 - 需登入 */}
        <Route
          path="/"
          element={
            user
              ? <SixHats user={user} onLogout={handleLogout} />
              : <Navigate to="/login" replace />
          }
        />
        <Route
          path="/six-hats/:sessionId"
          element={
            user
              ? <SixHats user={user} onLogout={handleLogout} />
              : <Navigate to="/login" replace />
          }
        />

        {/* 知識庫 */}
        <Route
          path="/knowledge"
          element={
            user
              ? <Knowledge />
              : <Navigate to="/login" replace />
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
