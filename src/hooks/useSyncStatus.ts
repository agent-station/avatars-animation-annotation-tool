import { useState, useEffect, useCallback } from 'react';
import { syncQueue, type SyncStatus } from '../services/syncQueue';
import { isApiConfigured } from '../services/annotationApi';

export type { SyncStatus };

export function useSyncStatus() {
  const isApiEnabled = isApiConfigured();
  const [statuses, setStatuses] = useState<Map<string, SyncStatus>>(new Map());
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (!isApiEnabled) return;

    // Initial load
    setStatuses(syncQueue.getAllStatuses());
    setPendingCount(syncQueue.getPendingCount());

    // Subscribe to status changes
    const unsubscribeStatus = syncQueue.subscribeToStatus(() => {
      setStatuses(syncQueue.getAllStatuses());
    });

    const unsubscribeCount = syncQueue.subscribe((count) => {
      setPendingCount(count);
    });

    return () => {
      unsubscribeStatus();
      unsubscribeCount();
    };
  }, [isApiEnabled]);

  const getStatus = useCallback(
    (path: string): SyncStatus => {
      if (!isApiEnabled) return 'synced';
      return statuses.get(path) || 'synced';
    },
    [isApiEnabled, statuses]
  );

  const hasFailures = useCallback(() => {
    return syncQueue.hasFailedItems();
  }, []);

  const retry = useCallback(() => {
    syncQueue.retryFailed();
  }, []);

  return {
    isApiEnabled,
    getStatus,
    statuses,
    pendingCount,
    hasFailures,
    retry,
  };
}
