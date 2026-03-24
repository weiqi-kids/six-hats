/**
 * 藍帽卡片元件（開場/檢核）
 */

interface Props {
  phase: 'opening' | 'review';
  content: string;
  keyPoints?: string[];
}

export default function BlueHatCard({ phase, content, keyPoints }: Props) {
  const isOpening = phase === 'opening';

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 overflow-hidden break-words">
      {/* 標題 */}
      <div className="flex items-center gap-2 mb-3">
        <span>🔵</span>
        <span className="font-medium text-blue-800">
          {isOpening ? '藍帽開場' : '藍帽檢核'}
        </span>
      </div>

      {/* 內容 */}
      <div className="text-gray-700 whitespace-pre-wrap">{content}</div>

      {/* 重點（開場：問題定義和目標；檢核：檢核結果） */}
      {keyPoints && keyPoints.length > 0 && (
        <div className="mt-3 pt-3 border-t border-blue-200">
          {isOpening ? (
            <div className="space-y-2">
              {keyPoints[0] && (
                <div className="flex items-start gap-2">
                  <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">
                    問題
                  </span>
                  <span className="text-sm text-gray-700">{keyPoints[0]}</span>
                </div>
              )}
              {keyPoints[1] && (
                <div className="flex items-start gap-2">
                  <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">
                    目標
                  </span>
                  <span className="text-sm text-gray-700">{keyPoints[1]}</span>
                </div>
              )}
            </div>
          ) : (
            <ul className="space-y-1">
              {keyPoints.map((point, i) => (
                <li
                  key={i}
                  className="text-sm text-gray-600 flex items-start gap-2"
                >
                  <span className="text-blue-400">•</span>
                  {point}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
