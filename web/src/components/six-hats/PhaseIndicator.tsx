/**
 * 執行階段指示器元件
 */

interface Props {
  phase: string;
}

const PHASE_LABELS: Record<string, { label: string; color: string }> = {
  sending: { label: '發送中', color: 'bg-gray-400' },
  opening: { label: '藍帽開場', color: 'bg-blue-500' },
  analysis: { label: '五帽分析', color: 'bg-purple-500' },
  review: { label: '藍帽檢核', color: 'bg-blue-500' },
  rerun: { label: '補充分析', color: 'bg-yellow-500' },
  evaluation: { label: '評估中', color: 'bg-green-500' },
};

export default function PhaseIndicator({ phase }: Props) {
  const config = PHASE_LABELS[phase] || { label: phase, color: 'bg-gray-400' };

  return (
    <div className="flex items-center gap-2 text-sm">
      <div className={`w-2 h-2 rounded-full ${config.color} animate-pulse`} />
      <span className="text-gray-600">{config.label}</span>
    </div>
  );
}
