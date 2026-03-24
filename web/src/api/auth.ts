const API_BASE = '/api'

// Token 管理
let authToken: string | null = localStorage.getItem('token')

function setToken(token: string | null) {
  authToken = token
  if (token) {
    localStorage.setItem('token', token)
  } else {
    localStorage.removeItem('token')
  }
}

export function getToken(): string | null {
  return authToken
}

export function isAuthenticated(): boolean {
  return !!authToken
}

function getHeaders(): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  }
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`
  }
  return headers
}

export interface User {
  id: string
  provider: string
  provider_id?: string
  email: string | null
  display_name: string | null
  avatar_url: string | null
  role: string
  created_at?: string
  last_login_at?: string | null
}

export interface AuthResponse {
  token: string
  user: User
}

export const authApi = {
  async loginAnonymous(): Promise<AuthResponse> {
    const res = await fetch(`${API_BASE}/auth/anonymous`, {
      method: 'POST',
      headers: getHeaders(),
      credentials: 'include',
    })
    if (!res.ok) throw new Error('Anonymous login failed')
    const data = await res.json()
    setToken(data.token)
    return data
  },

  async loginDemo(displayName?: string, admin?: boolean): Promise<AuthResponse> {
    const res = await fetch(`${API_BASE}/auth/demo`, {
      method: 'POST',
      headers: getHeaders(),
      credentials: 'include',
      body: JSON.stringify({ displayName, admin }),
    })
    if (!res.ok) throw new Error('Demo login failed')
    const data = await res.json()
    setToken(data.token)
    return data
  },

  async me(): Promise<{ user: User }> {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: getHeaders(),
      credentials: 'include',
    })
    if (!res.ok) throw new Error('Get user failed')
    return res.json()
  },

  logout() {
    setToken(null)
    fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      headers: getHeaders(),
      credentials: 'include',
    }).catch(() => {})
  },

  isAnonymous(user: User | null): boolean {
    return user?.role === 'anonymous'
  },
}
