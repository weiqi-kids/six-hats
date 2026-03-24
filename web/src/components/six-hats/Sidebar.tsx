/**
 * 左側邊欄組件
 *
 * 功能：
 * - 新對話按鈕
 * - 對話列表（按日期分組）
 * - 刪除對話
 * - 用戶資訊 + 登入/登出
 */

import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { SixHatsSession } from '../../api/six-hats';

interface Props {
  sessions: SixHatsSession[];
  currentSessionId?: string;
  user: any;
  isOpen: boolean;
  onToggle: () => void;
  onNewSession: () => void;
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onLogout: () => void;
}

// 日期分組函數
function groupByDate(sessions: SixHatsSession[]): Map<string, SixHatsSession[]> {
  const groups = new Map<string, SixHatsSession[]>();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const thisWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  for (const session of sessions) {
    const date = new Date(session.updatedAt);
    let group: string;

    if (date >= today) {
      group = '今天';
    } else if (date >= yesterday) {
      group = '昨天';
    } else if (date >= thisWeek) {
      group = '本週';
    } else if (date >= thisMonth) {
      group = '本月';
    } else {
      group = '更早';
    }

    if (!groups.has(group)) {
      groups.set(group, []);
    }
    groups.get(group)!.push(session);
  }

  return groups;
}

export default function Sidebar({
  sessions,
  currentSessionId,
  user,
  isOpen,
  onToggle: _onToggle,
  onNewSession,
  onSelectSession,
  onDeleteSession,
  onLogout,
}: Props) {
  const navigate = useNavigate();
  const groupedSessions = useMemo(() => groupByDate(sessions), [sessions]);
  const isAnonymous = user?.role === 'anonymous';

  return (
    <div
      className={`${
        isOpen ? 'w-64' : 'w-0'
      } transition-all duration-300 bg-gray-50 border-r border-gray-200 flex flex-col overflow-hidden`}
    >
      {/* 新對話按鈕 */}
      <div className="p-4">
        <button
          onClick={onNewSession}
          className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition flex items-center justify-center gap-2"
        >
          + 新對話
        </button>
      </div>

      {/* 對話列表標題 */}
      <div className="px-4 pb-2">
        <h3 className="text-sm font-medium text-gray-500">最近對話</h3>
      </div>

      {/* 對話列表 */}
      <div className="flex-1 overflow-y-auto">
        {sessions.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-gray-400">
            還沒有對話
          </div>
        ) : (
          Array.from(groupedSessions.entries()).map(([group, items]) => (
            <div key={group} className="mb-2">
              <div className="px-4 py-1 text-xs text-gray-400">{group}</div>
              {items.map((session) => (
                <div
                  key={session.id}
                  className={`group relative px-4 py-2 cursor-pointer hover:bg-gray-100 ${
                    currentSessionId === session.id ? 'bg-gray-200' : ''
                  }`}
                  onClick={() => onSelectSession(session.id)}
                >
                  <div className="pr-6">
                    <p className="text-sm text-gray-800 truncate">
                      {session.topic}
                    </p>
                    <p className="text-xs text-gray-400">
                      第 {session.currentRound} 輪
                      {session.status === 'concluded' && ' · 已結束'}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm('確定要刪除這個對話嗎？')) {
                        onDeleteSession(session.id);
                      }
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="刪除"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      {/* 用戶資訊 */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 ${isAnonymous ? 'bg-gray-400' : 'bg-blue-600'} rounded-full flex items-center justify-center text-white text-sm`}>
            {isAnonymous ? '?' : (user?.display_name?.[0] || 'U')}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-900 truncate">
              {isAnonymous ? '訪客' : (user?.display_name || 'User')}
            </p>
            <p className="text-xs text-gray-500">
              {isAnonymous ? '未登入' : user?.role}
            </p>
          </div>
          {!isAnonymous && (
            <button
              onClick={onLogout}
              className="text-gray-400 hover:text-gray-600"
              title="登出"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          )}
        </div>

        {/* 匿名用戶提示 */}
        {isAnonymous && (
          <button
            onClick={() => navigate('/login')}
            className="mt-3 w-full py-2 text-center text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
          >
            登入以保存對話
          </button>
        )}
      </div>
    </div>
  );
}
