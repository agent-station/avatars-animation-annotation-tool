import { useSyncStatus } from '../hooks/useSyncStatus';

export function SyncStatusBar() {
  const { isApiEnabled, pendingCount, hasFailures, retry } = useSyncStatus();

  // Don't show anything if API is not enabled or everything is synced
  if (!isApiEnabled || pendingCount === 0) {
    return null;
  }

  const hasFailed = hasFailures();

  return (
    <div
      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm ${
        hasFailed
          ? 'bg-red-900/50 text-red-200 border border-red-700'
          : 'bg-yellow-900/50 text-yellow-200 border border-yellow-700'
      }`}
    >
      {hasFailed ? (
        <>
          <svg className="w-4 h-4 text-red-400" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          <span>{pendingCount} sync failed</span>
          <button
            onClick={retry}
            className="ml-1 px-2 py-0.5 bg-red-700 hover:bg-red-600 rounded text-xs font-medium transition-colors"
          >
            Retry
          </button>
        </>
      ) : (
        <>
          <svg className="w-4 h-4 text-yellow-400 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span>Syncing {pendingCount} change{pendingCount !== 1 ? 's' : ''}...</span>
        </>
      )}
    </div>
  );
}
