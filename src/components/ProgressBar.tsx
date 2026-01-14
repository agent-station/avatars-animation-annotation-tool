interface QualityStats {
  approved: number;
  rejected: number;
  maybe: number;
}

interface ProgressBarProps {
  current: number;
  total: number;
  annotatedInView: number;
  annotatedTotal: number;
  qualityStats?: QualityStats;
}

export function ProgressBar({
  current,
  total,
  annotatedInView,
  annotatedTotal,
  qualityStats,
}: ProgressBarProps) {
  const percentage = total > 0 ? ((annotatedInView / total) * 100).toFixed(1) : '0';
  const showTotalAnnotated = annotatedTotal !== annotatedInView;
  const remaining = total - annotatedInView;

  return (
    <div className="bg-gray-800 rounded-lg p-3">
      <div className="flex justify-between items-center text-sm mb-2">
        <div className="flex items-center gap-4">
          <span className="text-gray-400">
            Viewing: <span className="text-white font-mono">{current + 1}</span> / {total}
          </span>
          {remaining > 0 && (
            <span className="text-gray-500 text-xs">
              ({remaining} remaining)
            </span>
          )}
        </div>

        <div className="flex items-center gap-4">
          {/* Quality breakdown */}
          {qualityStats && annotatedInView > 0 && (
            <div className="flex items-center gap-2 text-xs">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-green-400 font-mono">{qualityStats.approved}</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                <span className="text-red-400 font-mono">{qualityStats.rejected}</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-yellow-500" />
                <span className="text-yellow-400 font-mono">{qualityStats.maybe}</span>
              </span>
            </div>
          )}

          <span className="text-gray-400">
            Annotated: <span className="text-green-400 font-mono">{annotatedInView}</span>
            {showTotalAnnotated && (
              <span className="text-gray-500"> ({annotatedTotal} total)</span>
            )}
            <span className="text-gray-500 ml-1">({percentage}%)</span>
          </span>
        </div>
      </div>

      {/* Progress bar with quality segments */}
      <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
        {qualityStats && annotatedInView > 0 ? (
          <div className="h-full flex">
            {qualityStats.approved > 0 && (
              <div
                className="h-full bg-green-500 transition-all duration-300"
                style={{ width: `${(qualityStats.approved / total) * 100}%` }}
              />
            )}
            {qualityStats.rejected > 0 && (
              <div
                className="h-full bg-red-500 transition-all duration-300"
                style={{ width: `${(qualityStats.rejected / total) * 100}%` }}
              />
            )}
            {qualityStats.maybe > 0 && (
              <div
                className="h-full bg-yellow-500 transition-all duration-300"
                style={{ width: `${(qualityStats.maybe / total) * 100}%` }}
              />
            )}
          </div>
        ) : (
          <div
            className="h-full bg-green-500 transition-all duration-300"
            style={{ width: `${percentage}%` }}
          />
        )}
      </div>
    </div>
  );
}
