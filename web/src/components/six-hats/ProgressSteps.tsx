/**
 * 進度步驟組件
 *
 * 顯示六帽分析的 4 個步驟進度：
 * 1. 藍帽開場
 * 2. 五帽分析
 * 3. 藍帽檢核
 * 4. 卡內基評估
 */

interface Step {
  id: string;
  label: string;
  status: 'pending' | 'running' | 'done' | 'failed';
  duration?: number;
}

interface Props {
  steps: Step[];
}

export default function ProgressSteps({ steps }: Props) {
  return (
    <div className="px-4 py-6 flex gap-4">
      {/* AI 頭像 */}
      <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm flex-shrink-0">
        🎩
      </div>

      {/* 步驟列表 */}
      <div className="flex-1 space-y-1.5">
        {steps.map((step) => (
          <div key={step.id} className="flex items-center gap-2 text-sm">
            {/* 狀態圖標 */}
            {step.status === 'done' && (
              <span className="text-green-500 w-4 text-center">✓</span>
            )}
            {step.status === 'running' && (
              <span className="w-4 text-center">
                <span className="inline-block w-3.5 h-3.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></span>
              </span>
            )}
            {step.status === 'pending' && (
              <span className="text-gray-300 w-4 text-center">○</span>
            )}
            {step.status === 'failed' && (
              <span className="text-red-500 w-4 text-center">✗</span>
            )}

            {/* 步驟標籤 */}
            <span
              className={
                step.status === 'pending'
                  ? 'text-gray-400'
                  : step.status === 'running'
                  ? 'text-blue-600 font-medium'
                  : step.status === 'failed'
                  ? 'text-red-600'
                  : 'text-gray-600'
              }
            >
              {step.label}
            </span>

            {/* 耗時 */}
            {step.status === 'done' && step.duration != null && (
              <span className="text-gray-400 text-xs">
                {(step.duration / 1000).toFixed(1)}s
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
