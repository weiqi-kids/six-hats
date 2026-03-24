/**
 * 歡迎頁面組件
 *
 * 當沒有選中對話時顯示：
 * - 歡迎標題
 * - 六帽說明
 * - 個人背景設定（可收合）
 * - 建議提問範例
 */

import { useState } from 'react';
import { HAT_COLORS } from '../../api/six-hats';

export interface UserContext {
  [key: string]: unknown;
  role?: string;
  industry?: string;
  expertise?: string;
}

interface Props {
  onStart: (question: string, userContext?: UserContext) => void;
}

const SUGGESTED_QUESTIONS = [
  '我想離職創業，但擔心風險',
  '團隊溝通有問題，想改善合作',
  '要不要接受這個工作 offer',
];

export default function WelcomePage({ onStart }: Props) {
  const [showBackground, setShowBackground] = useState(false);
  const [userContext, setUserContext] = useState<UserContext>({});

  const handleQuestion = (question: string) => {
    const ctx = Object.values(userContext).some((v) => v?.trim())
      ? userContext
      : undefined;
    onStart(question, ctx);
  };

  return (
    <div className="h-full flex items-center justify-center p-8">
      <div className="text-center max-w-lg">
        {/* 圖標 */}
        <div className="text-6xl mb-4">
          <span role="img" aria-label="thinking">🎩</span>
        </div>

        {/* 標題 */}
        <h2 className="text-2xl font-bold text-gray-800 mb-2">
          歡迎使用六頂思考帽
        </h2>
        <p className="text-gray-600 mb-6">
          使用 Edward de Bono 的六頂思考帽方法論，<br />
          從多角度全面分析問題，做出更好的決策
        </p>

        {/* 個人背景（可收合） */}
        <div className="mb-6 text-left">
          <button
            onClick={() => setShowBackground(!showBackground)}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition mb-2"
          >
            <svg
              className={`w-4 h-4 transition-transform ${showBackground ? 'rotate-90' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            個人背景（選填，讓分析更貼近你的情境）
          </button>

          {showBackground && (
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">角色 / 職稱</label>
                <input
                  type="text"
                  value={userContext.role || ''}
                  onChange={(e) => setUserContext({ ...userContext, role: e.target.value })}
                  placeholder="例如：產品經理、急診醫師、大學生"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">產業</label>
                <input
                  type="text"
                  value={userContext.industry || ''}
                  onChange={(e) => setUserContext({ ...userContext, industry: e.target.value })}
                  placeholder="例如：科技業、醫療、教育、金融"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">專業背景</label>
                <input
                  type="text"
                  value={userContext.expertise || ''}
                  onChange={(e) => setUserContext({ ...userContext, expertise: e.target.value })}
                  placeholder="例如：10年軟體開發經驗、專長急診醫學"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* 建議提問 */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
          <p className="text-sm font-medium text-gray-700 mb-3">試試問我：</p>
          <ul className="space-y-2">
            {SUGGESTED_QUESTIONS.map((question) => (
              <li key={question}>
                <button
                  onClick={() => handleQuestion(question)}
                  className="text-left text-gray-600 hover:text-blue-600 hover:underline transition text-sm"
                >
                  • {question}
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* 六帽說明 */}
        <div className="grid grid-cols-3 gap-2 text-xs">
          {Object.entries(HAT_COLORS)
            .filter(([key]) => !['user', 'evaluator'].includes(key))
            .map(([key, config]) => (
              <div
                key={key}
                className="p-2 rounded"
                style={{ backgroundColor: config.bgColor }}
              >
                <span className="text-lg">{config.emoji}</span>
                <div className="font-medium" style={{ color: config.color }}>
                  {config.name}
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
