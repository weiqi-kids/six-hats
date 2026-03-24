import { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import { chatApi, type Message, type Conversation } from '../api/chat'
import { authApi } from '../api/auth'

interface HomeProps {
  user: any
  setUser: (user: any) => void
}

// 步驟名稱對照（對應 llm.ts 中的 node 名稱）
const STEP_LABELS: Record<string, { label: string; role?: string }> = {
  // 基本流程步驟
  check_scope: { label: '檢查問題是否屬於服務範疇', role: '範疇守門員' },
  embed_query: { label: '將問題轉換為向量', role: '向量化引擎' },
  vector_search: { label: '搜尋相關知識', role: '知識檢索員' },
  build_context: { label: '彙整參考資料' },
  knowledge_gap: { label: '檢測知識缺口' },
  gen_workflow: { label: '規劃回答策略' },
  out_of_scope: { label: '問題超出服務範疇' },

  // LLM 相關
  llm_call: { label: '整合知識庫資料，生成回答', role: '回答生成專家' },
  self_check: { label: '檢核回答品質與正確性', role: '品質檢核專家' },
  retry: { label: '品質未達標準，重新生成回答' },
  format: { label: '優化回答排版，提升可讀性', role: '排版優化專家' },
}

interface FlowStep {
  node: string
  status: 'success' | 'failed' | 'skipped'
  duration: number
  detail?: string
}

export default function Home({ user, setUser }: HomeProps) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [flowSteps, setFlowSteps] = useState<FlowStep[]>([])
  const [warning, setWarning] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const handleDemoLogin = async (admin: boolean = false) => {
    try {
      const result = await authApi.demo(admin ? 'Admin' : 'Demo User', admin)
      localStorage.setItem('token', result.token)
      setUser(result.user)
      loadConversations()
    } catch (error) {
      console.error('Demo login error:', error)
    }
  }

  const handleLogout = async () => {
    await authApi.logout()
    const result = await authApi.anonymous()
    localStorage.setItem('token', result.token)
    setUser(result.user)
    setConversations([])
    setCurrentConversation(null)
    setMessages([])
  }

  useEffect(() => {
    loadConversations()
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const loadConversations = async () => {
    try {
      const list = await chatApi.getConversations()
      setConversations(list)
    } catch (error) {
      console.error('Load conversations error:', error)
    }
  }

  const selectConversation = async (conv: Conversation) => {
    setCurrentConversation(conv)
    try {
      const msgs = await chatApi.getMessages(conv.id)
      setMessages(msgs)
    } catch (error) {
      console.error('Load messages error:', error)
    }
  }

  const createNewConversation = async () => {
    try {
      const conv = await chatApi.createConversation()
      setConversations([conv, ...conversations])
      setCurrentConversation(conv)
      setMessages([])
    } catch (error) {
      console.error('Create conversation error:', error)
    }
  }

  const sendMessage = async () => {
    if (!input.trim() || loading) return

    let conv = currentConversation
    if (!conv) {
      conv = await chatApi.createConversation()
      setConversations([conv, ...conversations])
      setCurrentConversation(conv)
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
    }
    setMessages([...messages, userMessage])
    setInput('')
    setLoading(true)
    setFlowSteps([])
    setWarning(null)

    // 使用 SSE 串流來即時顯示進度
    chatApi.sendMessageStream(
      conv.id,
      input,
      // onStep: 收到步驟進度
      (step: FlowStep) => {
        setFlowSteps((prev) => [...prev, step])
      },
      // onDone: 完成
      (result: any) => {
        setMessages((msgs) => [...msgs, result.message])
        if (result.warning) {
          setWarning(result.warning)
        }
        setLoading(false)
        setTimeout(() => setFlowSteps([]), 2000)
      },
      // onError: 錯誤
      (error) => {
        console.error('Send message error:', error)
        setLoading(false)
        setFlowSteps([])
      }
    )
  }

  return (
    <div className="min-h-screen flex">
      {/* Sidebar - 固定位置 */}
      <div className="w-64 bg-gray-100 border-r flex flex-col fixed top-0 left-0 h-screen">
        <div className="p-4 border-b">
          <h1 className="text-lg font-bold">six-hats</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-sm text-gray-500">{user?.display_name || '訪客'}</span>
            {user?.role === 'admin' && (
              <span className="px-1.5 py-0.5 text-xs bg-purple-100 text-purple-700 rounded">
                管理員
              </span>
            )}
          </div>
        </div>
        <div className="p-2 space-y-2">
          <button
            onClick={createNewConversation}
            className="w-full py-2 px-4 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            新對話
          </button>

          {/* 登入按鈕 */}
          {user?.provider === 'anonymous' ? (
            <div className="space-y-1">
              <button
                onClick={() => handleDemoLogin(false)}
                className="w-full py-1.5 px-3 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
              >
                Demo 登入
              </button>
              <button
                onClick={() => handleDemoLogin(true)}
                className="w-full py-1.5 px-3 text-sm bg-purple-100 text-purple-700 rounded hover:bg-purple-200"
              >
                管理員登入
              </button>
            </div>
          ) : (
            <button
              onClick={handleLogout}
              className="w-full py-1.5 px-3 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
            >
              登出
            </button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => selectConversation(conv)}
              className={`w-full text-left p-3 hover:bg-gray-200 ${
                currentConversation?.id === conv.id ? 'bg-gray-200' : ''
              }`}
            >
              <div className="text-sm truncate">
                {conv.title || '新對話'}
              </div>
              <div className="text-xs text-gray-400">
                {new Date(conv.updated_at).toLocaleDateString()}
              </div>
            </button>
          ))}
        </div>
        <div className="border-t bg-gray-50">
          <div className="p-2">
            <div className="text-xs text-gray-400 leading-relaxed">
              Six Thinking Hats Knowledge Base
            </div>
          </div>
        </div>
      </div>

      {/* Main - 加上左邊 margin 避免被側邊欄遮住 */}
      <div className="flex-1 flex flex-col ml-64">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-gray-400 mt-20">
              <p className="text-xl mb-2">歡迎使用 six-hats 知識庫</p>
              <p>輸入您的問題開始對話</p>
            </div>
          )}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-2xl p-3 rounded-lg ${
                  msg.role === 'user'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100'
                }`}
              >
                {msg.role === 'assistant' ? (
                  <div className="prose prose-sm max-w-none">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  msg.content
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 p-4 rounded-lg max-w-xl">
                {flowSteps.length === 0 ? (
                  <div className="animate-pulse text-gray-600">準備分析中...</div>
                ) : (
                  <div className="space-y-3">
                    {flowSteps.map((step, index) => {
                      const stepInfo = STEP_LABELS[step.node] || { label: step.node }
                      const statusIcon = step.status === 'success' ? '✓' : step.status === 'failed' ? '✗' : '⋯'
                      const statusColor = step.status === 'success' ? 'text-green-600' : step.status === 'failed' ? 'text-red-600' : 'text-blue-500'

                      return (
                        <div key={index} className="text-sm border-l-2 border-gray-300 pl-3">
                          <div className="flex items-center gap-2">
                            <span className={`${statusColor} font-bold`}>{statusIcon}</span>
                            {stepInfo.role ? (
                              <span className="text-purple-700 font-semibold">{stepInfo.role}</span>
                            ) : (
                              <span className="text-gray-700 font-medium">{stepInfo.label}</span>
                            )}
                            <span className="text-gray-400 text-xs ml-auto">{step.duration}ms</span>
                          </div>
                          <div className="text-gray-600 mt-1 ml-5">
                            {stepInfo.role ? (
                              <>
                                <span>{stepInfo.label}</span>
                                {step.detail && <span className="text-gray-500"> → {step.detail}</span>}
                              </>
                            ) : (
                              step.detail && <span className="text-gray-500">{step.detail}</span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                    <div className="text-sm text-gray-500 animate-pulse pl-3 border-l-2 border-blue-400">
                      <span className="text-blue-500">⋯</span> 下一步處理中...
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t p-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              placeholder="輸入您的問題..."
              className="flex-1 border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            />
            <button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
            >
              發送
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
