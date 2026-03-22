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

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  citations?: any[]
}

export interface Conversation {
  id: string
  title: string | null
  created_at: string
  updated_at: string
}

export const chatApi = {
  async createConversation(title?: string): Promise<Conversation> {
    const res = await fetch(`${API_BASE}/chat/conversations`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ title }),
    })
    if (!res.ok) throw new Error('Create conversation failed')
    return res.json()
  },

  async getConversations(): Promise<Conversation[]> {
    const res = await fetch(`${API_BASE}/chat/conversations`, {
      headers: getHeaders(),
    })
    if (!res.ok) throw new Error('Get conversations failed')
    return res.json()
  },

  async getMessages(conversationId: string): Promise<Message[]> {
    const res = await fetch(`${API_BASE}/chat/conversations/${conversationId}/messages`, {
      headers: getHeaders(),
    })
    if (!res.ok) throw new Error('Get messages failed')
    return res.json()
  },

  async sendMessage(conversationId: string, message: string): Promise<{ message: Message; citations: any[] }> {
    const res = await fetch(`${API_BASE}/chat/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ message }),
    })
    if (!res.ok) throw new Error('Send message failed')
    return res.json()
  },

  async deleteConversation(conversationId: string): Promise<void> {
    const res = await fetch(`${API_BASE}/chat/conversations/${conversationId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    })
    if (!res.ok) throw new Error('Delete conversation failed')
  },
}
