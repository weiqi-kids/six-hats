/**
 * 六帽思考帽主頁面
 *
 * 佈局：左側邊欄（對話列表）+ 右側聊天區域
 * 參考 tax-ai 的 Chat.tsx 實現
 */

import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  sixHatsApi,
  type SixHatsSession,
  type ChatMessage,
  type CarnegieEvaluation,
} from '../api/six-hats';
import Sidebar from '../components/six-hats/Sidebar';
import ChatRoom from '../components/six-hats/ChatRoom';
import InputBar from '../components/six-hats/InputBar';
import WelcomePage, { type UserContext } from '../components/six-hats/WelcomePage';
import ProgressSteps from '../components/six-hats/ProgressSteps';

interface Props {
  user: any;
}

// 八個分析步驟（對應後端 onStep 的 role）
const STEP_CONFIG = [
  { id: 'blue-opening', label: '藍帽開場' },
  { id: 'white', label: '白帽（事實）' },
  { id: 'red', label: '紅帽（情感）' },
  { id: 'black', label: '黑帽（風險）' },
  { id: 'yellow', label: '黃帽（機會）' },
  { id: 'green', label: '綠帽（創意）' },
  { id: 'blue-review', label: '藍帽檢核' },
  { id: 'evaluator', label: '卡內基評估' },
];

export default function SixHats({ user }: Props) {
  const { sessionId } = useParams<{ sessionId?: string }>();
  const navigate = useNavigate();
  const sendingRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 對話列表
  const [sessions, setSessions] = useState<SixHatsSession[]>([]);
  const [currentSession, setCurrentSession] = useState<SixHatsSession | null>(null);

  // 聊天訊息
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [evaluations, setEvaluations] = useState<CarnegieEvaluation[]>([]);

  // UI 狀態
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 用戶背景（WelcomePage 收集）
  const [pendingUserContext, setPendingUserContext] = useState<UserContext | undefined>();

  // 進度步驟
  const [progressSteps, setProgressSteps] = useState<
    Array<{ id: string; label: string; status: 'pending' | 'running' | 'done' | 'failed' }>
  >([]);

  // 載入對話列表
  useEffect(() => {
    loadSessions();
  }, []);

  // 當 sessionId 變化時載入對話
  useEffect(() => {
    if (sessionId) {
      loadSession(sessionId);
    } else {
      setCurrentSession(null);
      setMessages([]);
      setEvaluations([]);
    }
  }, [sessionId]);

  // 自動捲動到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, progressSteps]);

  const loadSessions = async () => {
    try {
      const data = await sixHatsApi.listSessions();
      setSessions(data.sessions);
    } catch (err) {
      console.error('載入對話列表失敗:', err);
    }
  };

  const loadSession = async (id: string) => {
    try {
      const data = await sixHatsApi.getSession(id);
      setCurrentSession(data.session);
      setMessages(data.messages);
      setEvaluations(data.evaluations);
    } catch (err) {
      setError('無法載入對話');
      console.error(err);
    }
  };

  // 建立新對話
  const handleNewSession = async () => {
    navigate('/');
  };

  // 選擇對話
  const handleSelectSession = (id: string) => {
    navigate(`/six-hats/${id}`);
  };

  // 刪除對話
  const handleDeleteSession = async (id: string) => {
    try {
      await sixHatsApi.deleteSession(id);
      setSessions(sessions.filter((s) => s.id !== id));
      if (currentSession?.id === id) {
        navigate('/');
      }
    } catch (err) {
      console.error('刪除對話失敗:', err);
    }
  };

  // 發送訊息（SSE 串流）
  const sendMessage = async (content: string, userContext?: UserContext) => {
    if (isLoading || sendingRef.current) return;
    sendingRef.current = true;

    let activeSessionId = currentSession?.id;

    // 如果沒有當前對話，先建立一個
    if (!activeSessionId) {
      try {
        const ctx = userContext || pendingUserContext;
        const data = await sixHatsApi.createSession(content, ctx as Record<string, unknown>);
        activeSessionId = data.session.id;
        setPendingUserContext(undefined);
        setCurrentSession(data.session);
        setSessions([data.session, ...sessions]);
        navigate(`/six-hats/${activeSessionId}`);
      } catch (err) {
        setError('建立對話失敗');
        console.error(err);
        sendingRef.current = false;
        return;
      }
    }

    setIsLoading(true);
    setError(null);

    // 初始化進度步驟
    setProgressSteps(
      STEP_CONFIG.map((s, i) => ({
        ...s,
        status: i === 0 ? ('running' as const) : ('pending' as const),
      }))
    );

    // 先顯示用戶訊息（立即回饋）
    const tempUserMessage: ChatMessage = {
      id: 'temp-user',
      sessionId: activeSessionId,
      round: (currentSession?.currentRound || 0) + 1,
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMessage]);

    try {
      await sixHatsApi.sendMessageStream(activeSessionId, content, (step) => {
        setProgressSteps((prev) => {
          const updated = [...prev];
          const idx = updated.findIndex((s) => s.id === step.role);
          if (idx >= 0) {
            if (step.status === 'done') {
              updated[idx] = { ...updated[idx], status: 'done' };
              // 將下一個 pending 步驟設為 running
              const nextPending = updated.findIndex((s) => s.status === 'pending');
              if (nextPending >= 0) {
                updated[nextPending] = { ...updated[nextPending], status: 'running' };
              }
            } else if (step.status === 'running') {
              updated[idx] = { ...updated[idx], status: 'running' };
            } else if (step.status === 'rerun') {
              updated[idx] = { ...updated[idx], status: 'running' };
            }
          }
          return updated;
        });
      });

      // 串流結束，重新載入完整資料
      await loadSession(activeSessionId);
      loadSessions();

      // 標記所有步驟完成
      setProgressSteps((prev) => prev.map((s) => ({ ...s, status: 'done' as const })));
    } catch (err) {
      setError('發送訊息失敗');
      console.error(err);
      // 移除 temp 訊息
      setMessages((prev) => prev.filter((m) => m.id !== 'temp-user'));
      setProgressSteps((prev) =>
        prev.map((s) =>
          s.status === 'running' ? { ...s, status: 'failed' as const } : s
        )
      );
    } finally {
      setIsLoading(false);
      sendingRef.current = false;
      // 延遲清除進度
      setTimeout(() => setProgressSteps([]), 1500);
    }
  };

  // 處理從 WelcomePage 開始的分析
  const handleStart = (question: string, userContext?: UserContext) => {
    sendMessage(question, userContext);
  };

  return (
    <div className="h-screen flex bg-gray-100 overflow-hidden">
      {/* 左側邊欄 */}
      <Sidebar
        sessions={sessions}
        currentSessionId={currentSession?.id}
        user={user}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        onNewSession={handleNewSession}
        onSelectSession={handleSelectSession}
        onDeleteSession={handleDeleteSession}
      />

      {/* 主內容區 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="h-14 bg-white border-b border-gray-200 flex items-center px-4 gap-4 flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <h1 className="font-medium flex-1 truncate">
            {currentSession?.topic || '六頂思考帽'}
          </h1>
          <button
            onClick={() => navigate('/knowledge')}
            className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            我的知識庫
          </button>
          {currentSession?.status === 'active' && (
            <button
              onClick={async () => {
                if (currentSession) {
                  try {
                    await sixHatsApi.concludeSession(currentSession.id);
                    setCurrentSession((prev) =>
                      prev ? { ...prev, status: 'concluded' } : prev
                    );
                    loadSessions();
                  } catch (err) {
                    console.error('結束對話失敗:', err);
                  }
                }
              }}
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              結束對話
            </button>
          )}
        </div>

        {/* 聊天區域 */}
        <div className="flex-1 overflow-y-auto">
          {!currentSession && messages.length === 0 ? (
            <WelcomePage onStart={handleStart} />
          ) : (
            <div className="max-w-3xl mx-auto py-4 px-4 min-w-0">
              <ChatRoom messages={messages} evaluations={evaluations} isLoading={false} />

              {/* 即時進度顯示 */}
              {isLoading && progressSteps.length > 0 && (
                <ProgressSteps steps={progressSteps} />
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* 輸入區域 */}
        <div className="border-t border-gray-200 bg-white p-4 flex-shrink-0">
          <div className="max-w-3xl mx-auto">
            <InputBar
              onSend={sendMessage}
              disabled={isLoading || currentSession?.status === 'concluded'}
              placeholder={
                currentSession?.status === 'concluded'
                  ? '對話已結束'
                  : '輸入你的問題或想法...'
              }
            />
            <p className="mt-2 text-xs text-gray-400 text-center">
              ⚠️ AI 分析僅供參考，重大決策請諮詢專業人士。
            </p>
          </div>
        </div>
      </div>

      {/* 錯誤提示 */}
      {error && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg z-50">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-2 text-white/80 hover:text-white"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
