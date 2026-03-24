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

  // SSE 串流發送訊息（即時顯示進度）
  sendMessageStream(
    conversationId: string,
    message: string,
    onStep: (step: any) => void,
    onDone: (result: { message: Message; citations: any[] }) => void,
    onError: (error: string) => void
  ): () => void {
    const controller = new AbortController()

    fetch(`${API_BASE}/chat/conversations/${conversationId}/messages/stream`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ message }),
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error('Stream failed')
        if (!res.body) throw new Error('No response body')

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6))
                if (data.type === 'step') {
                  onStep(data.step)
                } else if (data.type === 'done') {
                  onDone({ message: data.message, citations: data.citations })
                } else if (data.type === 'error') {
                  onError(data.error)
                }
              } catch (e) {
                console.error('Parse SSE error:', e)
              }
            }
          }
        }
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          onError(err.message)
        }
      })

    return () => controller.abort()
  },

  async deleteConversation(conversationId: string): Promise<void> {
    const res = await fetch(`${API_BASE}/chat/conversations/${conversationId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    })
    if (!res.ok) throw new Error('Delete conversation failed')
  },
}
