/**
 * 卡內基評估卡片組件
 *
 * 在聊天訊息最後顯示評估結果，取代右側面板
 */

import type { CarnegieEvaluation } from '../../api/six-hats';

interface Props {
  evaluation: CarnegieEvaluation;
}

// 問題類型標籤
const PROBLEM_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  decision: { label: '決策問題', color: 'bg-blue-100 text-blue-700' },
  emotion: { label: '情緒問題', color: 'bg-red-100 text-red-700' },
  resource: { label: '資源問題', color: 'bg-yellow-100 text-yellow-700' },
  information: { label: '資訊問題', color: 'bg-green-100 text-green-700' },
};

export default function CarnegieCard({ evaluation }: Props) {
  const problemType = PROBLEM_TYPE_LABELS[evaluation.problem.type] || {
    label: evaluation.problem.type,
    color: 'bg-gray-100 text-gray-700',
  };

  return (
    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 my-4 overflow-hidden break-words">
      {/* 標題 */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xl">📊</span>
        <h3 className="font-semibold text-purple-800">卡內基評估</h3>
        <span className={`px-2 py-0.5 text-xs rounded ${problemType.color}`}>
          {problemType.label}
        </span>
      </div>

      {/* 問題陳述 */}
      <div className="mb-4">
        <p className="text-sm text-gray-700">{evaluation.problem.statement}</p>
      </div>

      {/* 原因分析 */}
      <div className="mb-4">
        <h4 className="text-sm font-medium text-gray-700 mb-2">🔍 原因分析</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
          <div className="bg-white rounded p-2">
            <p className="font-medium text-gray-600 mb-1">主要原因</p>
            <ul className="space-y-0.5">
              {evaluation.cause.primary.map((item, i) => (
                <li key={i} className="text-gray-700">• {item}</li>
              ))}
            </ul>
          </div>
          <div className="bg-white rounded p-2">
            <p className="font-medium text-green-600 mb-1">✓ 可控因素</p>
            <ul className="space-y-0.5">
              {evaluation.cause.controllable.map((item, i) => (
                <li key={i} className="text-gray-700">• {item}</li>
              ))}
            </ul>
          </div>
          <div className="bg-white rounded p-2">
            <p className="font-medium text-red-600 mb-1">✗ 不可控因素</p>
            <ul className="space-y-0.5">
              {evaluation.cause.uncontrollable.map((item, i) => (
                <li key={i} className="text-gray-700">• {item}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* 方案選項 */}
      <div className="mb-4">
        <h4 className="text-sm font-medium text-gray-700 mb-2">💡 方案選項</h4>
        <div className="space-y-2">
          {evaluation.method.options.map((option, i) => (
            <div key={i} className="bg-white rounded p-3 text-sm">
              <p className="font-medium text-gray-800">{option.title}</p>
              <p className="text-gray-600 text-xs mt-1">{option.description}</p>
              <div className="flex gap-4 mt-2 text-xs">
                {option.supportedBy.length > 0 && (
                  <span className="text-green-600">
                    👍 {option.supportedBy.join(', ')}
                  </span>
                )}
                {option.opposedBy.length > 0 && (
                  <span className="text-red-600">
                    👎 {option.opposedBy.join(', ')}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 成果物（email、範本等） */}
      {evaluation.deliverable && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">📝 成果物</h4>
          <div className="bg-white rounded p-4 text-sm text-gray-800 whitespace-pre-wrap border-l-4 border-purple-400">
            {evaluation.deliverable}
          </div>
        </div>
      )}

      {/* 建議流程 */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-2">🎯 建議流程</h4>
        <div className="bg-white rounded p-3">
          <p className="text-sm font-medium text-purple-700 mb-2">
            {evaluation.bestProcess.recommendation}
          </p>
          <ol className="space-y-1.5">
            {evaluation.bestProcess.steps.map((step) => (
              <li key={step.step} className="flex gap-2 text-xs">
                <span className="flex-shrink-0 w-5 h-5 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center font-medium">
                  {step.step}
                </span>
                <div>
                  <p className="text-gray-800">{step.action}</p>
                  <p className="text-gray-500">✓ {step.checkpoint}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
