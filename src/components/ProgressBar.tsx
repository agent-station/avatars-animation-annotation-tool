interface ProgressBarProps {
  current: number;
  total: number;
  annotatedInView: number;
  annotatedTotal: number;
}

export function ProgressBar({ current, total, annotatedInView, annotatedTotal }: ProgressBarProps) {
  const percentage = total > 0 ? ((annotatedInView / total) * 100).toFixed(1) : '0';
  const showTotalAnnotated = annotatedTotal !== annotatedInView;

  return (
    <div className="bg-gray-800 rounded-lg p-3">
      <div className="flex justify-between text-sm mb-2">
        <span className="text-gray-400">
          Viewing: <span className="text-white font-mono">{current + 1}</span> / {total}
        </span>
        <span className="text-gray-400">
          Annotated: <span className="text-green-400 font-mono">{annotatedInView}</span>
          {showTotalAnnotated && (
            <span className="text-gray-500"> ({annotatedTotal} total)</span>
          )}
          <span className="text-gray-500 ml-1">({percentage}%)</span>
        </span>
      </div>
      <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-green-500 transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
