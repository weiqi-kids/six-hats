/**
 * 聊天室元件
 *
 * 按輪次分組，每輪結尾顯示該輪的卡內基評估卡片
 */

import { useRef, useEffect } from 'react';
import type { ChatMessage, CarnegieEvaluation } from '../../api/six-hats';
import MessageBubble from './MessageBubble';
import BlueHatCard from './BlueHatCard';
import CarnegieCard from './CarnegieCard';

interface Props {
  messages: ChatMessage[];
  evaluations: CarnegieEvaluation[];
  isLoading: boolean;
}

export default function ChatRoom({ messages, evaluations, isLoading }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  // 自動滾動到底部
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages, evaluations]);

  // 按輪次分組訊息
  const groupedMessages: { round: number; messages: ChatMessage[] }[] = [];
  let currentRound = 0;

  for (const msg of messages) {
    if (msg.round !== currentRound) {
      currentRound = msg.round;
      groupedMessages.push({ round: msg.round, messages: [] });
    }
    if (groupedMessages.length > 0) {
      groupedMessages[groupedMessages.length - 1].messages.push(msg);
    }
  }

  // 建立 round → evaluation 對照
  const evalByRound = new Map<number, CarnegieEvaluation>();
  for (const ev of evaluations) {
    evalByRound.set(ev.round, ev);
  }

  return (
    <div
      ref={containerRef}
      className="p-4 space-y-6 min-w-0"
    >
      {groupedMessages.map((group) => {
        const evaluation = evalByRound.get(group.round);

        return (
          <div key={group.round} className="space-y-4">
            {/* 輪次分隔線 */}
            {group.round > 1 && (
              <div className="flex items-center gap-4 my-6">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-xs text-gray-400">
                  第 {group.round} 輪
                </span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>
            )}

            {/* 訊息列表 */}
            {group.messages.map((msg) => {
              // Blue Hat 開場和檢核用特殊卡片
              if (msg.role === 'blue' && (msg.phase === 'opening' || msg.phase === 'review')) {
                return (
                  <BlueHatCard
                    key={msg.id}
                    phase={msg.phase as 'opening' | 'review'}
                    content={msg.content}
                    keyPoints={msg.keyPoints}
                  />
                );
              }

              // 其他訊息用一般氣泡
              return (
                <MessageBubble
                  key={msg.id}
                  id={msg.id}
                  role={msg.role}
                  content={msg.content}
                  keyPoints={msg.keyPoints}
                  phase={msg.phase}
                />
              );
            })}

            {/* 該輪的卡內基評估 */}
            {evaluation && (
              <CarnegieCard evaluation={evaluation} />
            )}
          </div>
        );
      })}

      {/* 載入指示 */}
      {isLoading && (
        <div className="flex items-center gap-2 text-gray-500">
          <div className="animate-spin w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full" />
          <span>思考中...</span>
        </div>
      )}
    </div>
  );
}
