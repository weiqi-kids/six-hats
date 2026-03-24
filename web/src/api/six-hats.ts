/**
 * 六帽聊天室 API 客戶端
 */

const API_URL = import.meta.env.VITE_API_URL || '';

function getHeaders(): HeadersInit {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };
}

export interface SixHatsSession {
  id: string;
  topic: string;
  userContext?: Record<string, unknown>;
  currentRound: number;
  status: 'active' | 'concluded';
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  round: number;
  phase?: string;
  role: string;
  content: string;
  keyPoints?: string[];
  referencedHats?: string[];
  toolsUsed?: string[];
  createdAt: string;
}

export interface CarnegieEvaluation {
  id: string;
  sessionId: string;
  round: number;
  problem: {
    statement: string;
    type: 'decision' | 'emotion' | 'resource' | 'information';
  };
  cause: {
    primary: string[];
    controllable: string[];
    uncontrollable: string[];
  };
  method: {
    options: Array<{
      title: string;
      description: string;
      supportedBy: string[];
      opposedBy: string[];
    }>;
  };
  bestProcess: {
    recommendation: string;
    steps: Array<{
      step: number;
      action: string;
      checkpoint: string;
    }>;
  };
  deliverable?: string | null;
  createdAt: string;
}

export interface SSEEvent {
  type: string;
  [key: string]: unknown;
}

export const sixHatsApi = {
  /**
   * 建立新聊天室
   */
  async createSession(topic: string, userContext?: Record<string, unknown>): Promise<{ session: SixHatsSession }> {
    const response = await fetch(`${API_URL}/api/six-hats/sessions`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ topic, userContext }),
    });
    if (!response.ok) throw new Error('Failed to create session');
    return response.json();
  },

  /**
   * 取得聊天室列表
   */
  async listSessions(): Promise<{ sessions: SixHatsSession[] }> {
    const response = await fetch(`${API_URL}/api/six-hats/sessions`, {
      headers: getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to list sessions');
    return response.json();
  },

  /**
   * 取得聊天室詳情
   */
  async getSession(id: string): Promise<{
    session: SixHatsSession;
    messages: ChatMessage[];
    evaluations: CarnegieEvaluation[];
  }> {
    const response = await fetch(`${API_URL}/api/six-hats/sessions/${id}`, {
      headers: getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to get session');
    return response.json();
  },

  /**
   * 發送訊息
   */
  async sendMessage(sessionId: string, content: string): Promise<{
    messages: ChatMessage[];
    evaluation: CarnegieEvaluation;
  }> {
    const response = await fetch(`${API_URL}/api/six-hats/sessions/${sessionId}/messages`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ content }),
    });
    if (!response.ok) throw new Error('Failed to send message');
    return response.json();
  },

  /**
   * 發送訊息（SSE 串流）
   * 使用 fetch + ReadableStream 解析 SSE（支援 POST）
   */
  async sendMessageStream(
    sessionId: string,
    content: string,
    onStep: (step: { role: string; status: string; result?: unknown }) => void,
  ): Promise<void> {
    const response = await fetch(`${API_URL}/api/six-hats/sessions/${sessionId}/messages/stream`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ content }),
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || 'Request failed');
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === 'step') onStep(event.step);
            if (event.type === 'error') throw new Error(event.message || 'Stream failed');
          } catch (e) {
            if (e instanceof SyntaxError) continue;
            throw e;
          }
        }
      }
    }
  },

  /**
   * 結束對話
   */
  async concludeSession(id: string): Promise<{ finalReport: string }> {
    const response = await fetch(`${API_URL}/api/six-hats/sessions/${id}/conclude`, {
      method: 'POST',
      headers: getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to conclude session');
    return response.json();
  },

  /**
   * 刪除對話
   */
  async deleteSession(id: string): Promise<void> {
    const response = await fetch(`${API_URL}/api/six-hats/sessions/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to delete session');
  },
};

/**
 * 帽子顏色配置
 */
// ============ Attachment API ============

export interface Attachment {
  id: string;
  filename: string;
  originalName: string;
  contentType?: string;
  sourceType: 'file' | 'url' | 'text';
  sourceUrl?: string;
  chunkCount: number;
  enabled: boolean;
  status: 'processing' | 'ready' | 'error';
  createdAt: string;
}

export const attachmentApi = {
  async list(): Promise<{ attachments: Attachment[] }> {
    const response = await fetch(`${API_URL}/api/six-hats/attachments`, {
      headers: getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to list attachments');
    return response.json();
  },

  async uploadFile(file: File): Promise<{ attachment: Attachment }> {
    const token = localStorage.getItem('token');
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_URL}/api/six-hats/attachments/upload`, {
      method: 'POST',
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: formData,
    });
    if (!response.ok) throw new Error('Failed to upload file');
    return response.json();
  },

  async addText(text: string, title?: string): Promise<{ attachment: Attachment }> {
    const response = await fetch(`${API_URL}/api/six-hats/attachments/text`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ text, title }),
    });
    if (!response.ok) throw new Error('Failed to add text');
    return response.json();
  },

  async addUrl(url: string): Promise<{ attachment: Attachment }> {
    const response = await fetch(`${API_URL}/api/six-hats/attachments/url`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ url }),
    });
    if (!response.ok) throw new Error('Failed to fetch URL');
    return response.json();
  },

  async toggle(id: string): Promise<{ id: string; enabled: boolean }> {
    const response = await fetch(`${API_URL}/api/six-hats/attachments/${id}/toggle`, {
      method: 'PATCH',
      headers: getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to toggle attachment');
    return response.json();
  },

  async delete(id: string): Promise<void> {
    const response = await fetch(`${API_URL}/api/six-hats/attachments/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to delete attachment');
  },
};

export const HAT_COLORS: Record<string, { name: string; emoji: string; color: string; bgColor: string }> = {
  user: { name: '你', emoji: '👤', color: '#6B7280', bgColor: '#F3F4F6' },
  white: { name: '白帽', emoji: '⚪', color: '#6B7280', bgColor: '#F9FAFB' },
  red: { name: '紅帽', emoji: '🔴', color: '#DC2626', bgColor: '#FEF2F2' },
  black: { name: '黑帽', emoji: '⚫', color: '#1F2937', bgColor: '#F3F4F6' },
  yellow: { name: '黃帽', emoji: '🟡', color: '#D97706', bgColor: '#FFFBEB' },
  green: { name: '綠帽', emoji: '🟢', color: '#059669', bgColor: '#ECFDF5' },
  blue: { name: '藍帽', emoji: '🔵', color: '#2563EB', bgColor: '#EFF6FF' },
  evaluator: { name: '評估', emoji: '📊', color: '#7C3AED', bgColor: '#F5F3FF' },
};
