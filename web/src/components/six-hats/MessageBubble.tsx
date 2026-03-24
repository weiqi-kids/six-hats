/**
 * 訊息氣泡元件
 */

import { useState } from 'react';
import { HAT_COLORS } from '../../api/six-hats';

interface Props {
  id?: string;
  role: string;
  content: string;
  keyPoints?: string[];
  phase?: string;
  onFeedback?: (messageId: string, feedback: 'up' | 'down') => void;
}

export default function MessageBubble({
  id,
  role,
  content,
  keyPoints,
  phase,
  onFeedback,
}: Props) {
  const config = HAT_COLORS[role] || HAT_COLORS.user;
  const isUser = role === 'user';
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);

  const handleFeedback = (type: 'up' | 'down') => {
    if (feedback === type) {
      setFeedback(null);
    } else {
      setFeedback(type);
      if (id && onFeedback) {
        onFeedback(id, type);
      }
    }
  };

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} min-w-0`}>
      <div
        className={`max-w-[80%] rounded-lg p-4 overflow-hidden break-words ${
          isUser
            ? 'bg-blue-600 text-white'
            : 'border'
        }`}
        style={
          !isUser
            ? {
                backgroundColor: config.bgColor,
                borderColor: config.color + '40',
              }
            : undefined
        }
      >
        {/* 帽子標籤 */}
        {!isUser && (
          <div className="flex items-center gap-2 mb-2">
            <span>{config.emoji}</span>
            <span
              className="text-sm font-medium"
              style={{ color: config.color }}
            >
              {config.name}
            </span>
            {phase === 'rerun' && (
              <span className="text-xs px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded">
                補充
              </span>
            )}
          </div>
        )}

        {/* 內容 */}
        <div
          className={`whitespace-pre-wrap ${
            isUser ? 'text-white' : 'text-gray-700'
          }`}
        >
          {content}
        </div>

        {/* 重點列表 */}
        {keyPoints && keyPoints.length > 0 && !isUser && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <div className="text-xs text-gray-500 mb-1">重點</div>
            <ul className="space-y-1">
              {keyPoints.map((point, i) => (
                <li
                  key={i}
                  className="text-sm text-gray-600 flex items-start gap-2"
                >
                  <span className="text-gray-400">•</span>
                  {point}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 反饋按鈕 */}
        {!isUser && (
          <div className="mt-2 pt-2 border-t border-gray-200 flex gap-2">
            <button
              onClick={() => handleFeedback('up')}
              className={`p-1 rounded hover:bg-gray-100 transition-colors ${
                feedback === 'up' ? 'text-green-600' : 'text-gray-400'
              }`}
              title="有幫助"
            >
              👍
            </button>
            <button
              onClick={() => handleFeedback('down')}
              className={`p-1 rounded hover:bg-gray-100 transition-colors ${
                feedback === 'down' ? 'text-red-600' : 'text-gray-400'
              }`}
              title="沒幫助"
            >
              👎
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
