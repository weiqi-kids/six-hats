const API_BASE = '/api'

function getHeaders(): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  }
  const token = localStorage.getItem('token')
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  return headers
}

export const authApi = {
  async anonymous() {
    const res = await fetch(`${API_BASE}/auth/anonymous`, {
      method: 'POST',
      headers: getHeaders(),
      credentials: 'include',
    })
    if (!res.ok) throw new Error('Anonymous login failed')
    return res.json()
  },

  async me() {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: getHeaders(),
    })
    if (!res.ok) throw new Error('Get user failed')
    return res.json()
  },

  async logout() {
    localStorage.removeItem('token')
    await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      headers: getHeaders(),
    })
  },
}
