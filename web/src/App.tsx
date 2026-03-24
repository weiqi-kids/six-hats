import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useState, useEffect } from 'react'
import SixHats from './pages/SixHats'
import Home from './pages/Home'
import Knowledge from './pages/Knowledge'
import { authApi } from './api/auth'

export default function App() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 自動匿名登入
    const init = async () => {
      try {
        const token = localStorage.getItem('token')
        if (token) {
          const result = await authApi.me()
          setUser(result.user)
        } else {
          const result = await authApi.anonymous()
          localStorage.setItem('token', result.token)
          setUser(result.user)
        }
      } catch (error) {
        console.error('Auth error:', error)
        // 清除可能過期的 token
        localStorage.removeItem('token')
        const result = await authApi.anonymous()
        localStorage.setItem('token', result.token)
        setUser(result.user)
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">載入中...</div>
      </div>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<SixHats user={user} />} />
        <Route path="/six-hats/:sessionId" element={<SixHats user={user} />} />
        <Route path="/chat" element={<Home user={user} setUser={setUser} />} />
        <Route path="/knowledge" element={<Knowledge />} />
      </Routes>
    </BrowserRouter>
  )
}
