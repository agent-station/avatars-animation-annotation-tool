import type { Annotation } from '../types';
import * as api from './annotationApi';

const QUEUE_KEY = 'animation-annotations-sync-queue';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;

export type SyncStatus = 'synced' | 'pending' | 'syncing' | 'failed';

interface QueueItem {
  id: string;
  type: 'save' | 'delete';
  animationPath: string;
  annotation?: Annotation;
  retryCount: number;
  createdAt: string;
}

// Load queue from localStorage
function loadQueue(): QueueItem[] {
  try {
    const saved = localStorage.getItem(QUEUE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

// Save queue to localStorage
function saveQueue(queue: QueueItem[]): void {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

// Generate unique ID
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

class SyncQueue {
  private queue: QueueItem[] = [];
  private isProcessing = false;
  private currentlySyncing: string | null = null;
  private listeners: Set<(pending: number) => void> = new Set();
  private statusListeners: Set<() => void> = new Set();

  constructor() {
    this.queue = loadQueue();
    // Start processing any pending items
    if (this.queue.length > 0) {
      this.processQueue();
    }
  }

  // Get sync status for a specific animation path
  getStatus(animationPath: string): SyncStatus {
    if (this.currentlySyncing === animationPath) {
      return 'syncing';
    }
    const item = this.queue.find((i) => i.animationPath === animationPath);
    if (!item) {
      return 'synced';
    }
    if (item.retryCount >= MAX_RETRIES) {
      return 'failed';
    }
    return 'pending';
  }

  // Get all paths with their sync status
  getAllStatuses(): Map<string, SyncStatus> {
    const statuses = new Map<string, SyncStatus>();
    for (const item of this.queue) {
      if (this.currentlySyncing === item.animationPath) {
        statuses.set(item.animationPath, 'syncing');
      } else if (item.retryCount >= MAX_RETRIES) {
        statuses.set(item.animationPath, 'failed');
      } else {
        statuses.set(item.animationPath, 'pending');
      }
    }
    return statuses;
  }

  // Subscribe to status changes (for per-item updates)
  subscribeToStatus(listener: () => void): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  private notifyStatusListeners(): void {
    this.statusListeners.forEach((listener) => listener());
  }

  // Add a save operation to the queue
  enqueueSave(animationPath: string, annotation: Annotation): void {
    // Remove any existing operations for this path (dedup)
    this.queue = this.queue.filter((item) => item.animationPath !== animationPath);

    this.queue.push({
      id: generateId(),
      type: 'save',
      animationPath,
      annotation,
      retryCount: 0,
      createdAt: new Date().toISOString(),
    });

    saveQueue(this.queue);
    this.notifyListeners();
    this.notifyStatusListeners();
    this.processQueue();
  }

  // Add a delete operation to the queue
  enqueueDelete(animationPath: string): void {
    // Remove any existing operations for this path
    this.queue = this.queue.filter((item) => item.animationPath !== animationPath);

    this.queue.push({
      id: generateId(),
      type: 'delete',
      animationPath,
      retryCount: 0,
      createdAt: new Date().toISOString(),
    });

    saveQueue(this.queue);
    this.notifyListeners();
    this.notifyStatusListeners();
    this.processQueue();
  }

  // Process the queue
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) return;

    this.isProcessing = true;

    while (this.queue.length > 0) {
      const item = this.queue[0];
      this.currentlySyncing = item.animationPath;
      this.notifyStatusListeners();

      try {
        if (item.type === 'save' && item.annotation) {
          await api.saveAnnotation(item.animationPath, item.annotation);
        } else if (item.type === 'delete') {
          await api.deleteAnnotation(item.animationPath);
        }

        // Success - remove from queue
        this.currentlySyncing = null;
        this.queue.shift();
        saveQueue(this.queue);
        this.notifyListeners();
        this.notifyStatusListeners();
      } catch (error) {
        console.error(`Sync failed for ${item.animationPath}:`, error);

        item.retryCount++;
        this.currentlySyncing = null;
        saveQueue(this.queue);
        this.notifyStatusListeners();

        if (item.retryCount >= MAX_RETRIES) {
          // Give up after max retries - keep in queue but stop processing
          console.error(`Max retries reached for ${item.animationPath}`);
          break;
        }

        // Wait before retrying
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      }
    }

    this.isProcessing = false;
    this.currentlySyncing = null;
    this.notifyStatusListeners();
  }

  // Get pending count
  getPendingCount(): number {
    return this.queue.length;
  }

  // Check if there are failed items (max retries reached)
  hasFailedItems(): boolean {
    return this.queue.some((item) => item.retryCount >= MAX_RETRIES);
  }

  // Retry failed items
  retryFailed(): void {
    this.queue = this.queue.map((item) => ({
      ...item,
      retryCount: 0,
    }));
    saveQueue(this.queue);
    this.processQueue();
  }

  // Subscribe to queue changes
  subscribe(listener: (pending: number) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    const count = this.getPendingCount();
    this.listeners.forEach((listener) => listener(count));
  }

  // Clear the queue (use with caution)
  clear(): void {
    this.queue = [];
    saveQueue(this.queue);
    this.notifyListeners();
  }
}

// Singleton instance
export const syncQueue = new SyncQueue();
