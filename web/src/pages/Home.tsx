import { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import { chatApi, type Message, type Conversation } from '../api/chat'

interface HomeProps {
  user: any
}

export default function Home({ user }: HomeProps) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

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

    try {
      const result = await chatApi.sendMessage(conv.id, input)
      setMessages((msgs) => [...msgs, result.message])
    } catch (error) {
      console.error('Send message error:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <div className="w-64 bg-gray-100 border-r flex flex-col">
        <div className="p-4 border-b">
          <h1 className="text-lg font-bold">six-hats</h1>
          <p className="text-sm text-gray-500">{user?.display_name || '訪客'}</p>
        </div>
        <div className="p-2">
          <button
            onClick={createNewConversation}
            className="w-full py-2 px-4 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            新對話
          </button>
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
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-gray-400 mt-20">
              <p className="text-xl mb-2">歡迎使用 six-hats</p>
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
                  <ReactMarkdown className="prose prose-sm max-w-none">
                    {msg.content}
                  </ReactMarkdown>
                ) : (
                  msg.content
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 p-3 rounded-lg">
                <div className="animate-pulse">思考中...</div>
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
