import { useState, useCallback, useEffect, useRef } from 'react';
import type { Annotation, AnnotationData, Quality, Character, ActionTag } from '../types';
import * as api from '../services/annotationApi';
import { syncQueue } from '../services/syncQueue';

const STORAGE_KEY = 'animation-annotations';
const LAST_SYNC_KEY = 'animation-annotations-last-sync';
const MAX_HISTORY_SIZE = 50;

// History entry for undo/redo
interface HistoryEntry {
  path: string;
  before: Annotation | undefined;
  after: Annotation;
}

const defaultAnnotationData: AnnotationData = {
  version: 1,
  characters: ['sarang', 'yeona', 'other'],
  tags: ['idle', 'greeting', 'reaction', 'conversation', 'locomotion', 'combat'],
  lastReviewedIndex: 0,
  lastReviewedPath: null,
  annotations: {},
};

// Valid values for annotation fields
const VALID_QUALITIES: Quality[] = ['approved', 'rejected', 'maybe'];
const VALID_CHARACTERS: Character[] = ['sarang', 'yeona', 'other', 'none'];
const VALID_TAGS: ActionTag[] = ['idle', 'greeting', 'reaction', 'conversation', 'locomotion', 'combat'];

// Validate a single annotation entry
function isValidAnnotation(annotation: unknown): annotation is Annotation {
  if (typeof annotation !== 'object' || annotation === null) return false;
  const obj = annotation as Record<string, unknown>;

  return (
    typeof obj.quality === 'string' &&
    VALID_QUALITIES.includes(obj.quality as Quality) &&
    typeof obj.character === 'string' &&
    VALID_CHARACTERS.includes(obj.character as Character) &&
    Array.isArray(obj.tags) &&
    obj.tags.every((tag) => typeof tag === 'string' && VALID_TAGS.includes(tag as ActionTag)) &&
    typeof obj.annotatedAt === 'string'
  );
}

// Runtime validation for imported annotation data
function isValidAnnotationData(data: unknown): data is AnnotationData {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;

  // Check basic structure
  if (
    typeof obj.version !== 'number' ||
    typeof obj.annotations !== 'object' ||
    obj.annotations === null ||
    !Array.isArray(obj.characters) ||
    !Array.isArray(obj.tags)
  ) {
    return false;
  }

  // Validate each annotation entry
  const annotations = obj.annotations as Record<string, unknown>;
  for (const [path, annotation] of Object.entries(annotations)) {
    if (typeof path !== 'string' || !isValidAnnotation(annotation)) {
      return false;
    }
  }

  return true;
}

// Load initial data from localStorage synchronously
function loadLocalData(): AnnotationData {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (isValidAnnotationData(parsed)) {
        return parsed;
      }
    }
  } catch {
    // Fall through to default
  }
  return defaultAnnotationData;
}

// Save to localStorage
function saveLocalData(data: AnnotationData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function useAnnotations() {
  const isApiEnabled = api.isApiConfigured();
  const [data, setData] = useState<AnnotationData>(loadLocalData);
  const [isLoading, setIsLoading] = useState(isApiEnabled);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [pendingSyncCount, setPendingSyncCount] = useState(syncQueue.getPendingCount());

  // Undo/redo history (local only)
  const [undoStack, setUndoStack] = useState<HistoryEntry[]>([]);
  const [redoStack, setRedoStack] = useState<HistoryEntry[]>([]);
  const isUndoRedoAction = useRef(false);

  // Subscribe to sync queue changes
  useEffect(() => {
    return syncQueue.subscribe((count) => {
      setPendingSyncCount(count);
      if (count === 0) {
        setSyncError(null);
      } else if (syncQueue.hasFailedItems()) {
        setSyncError(`${count} changes failed to sync. Click to retry.`);
      }
    });
  }, []);

  // Load annotations from API on mount (with incremental sync support)
  useEffect(() => {
    if (!isApiEnabled) return;

    const loadFromApi = async () => {
      try {
        const lastSyncTime = localStorage.getItem(LAST_SYNC_KEY);
        let annotations: Record<string, Annotation>;

        if (lastSyncTime) {
          // Incremental sync: fetch only changes since last sync
          const updatedAnnotations = await api.fetchAnnotationsSince(lastSyncTime);
          // Merge with existing local data (server data takes precedence)
          setData((prev) => ({
            ...prev,
            annotations: {
              ...prev.annotations,
              ...updatedAnnotations,
            },
          }));
          console.log(
            `Incremental sync: ${Object.keys(updatedAnnotations).length} annotations updated since ${lastSyncTime}`
          );
        } else {
          // Full sync for first load or after cache clear
          annotations = await api.fetchAllAnnotations();
          setData((prev) => ({
            ...prev,
            annotations,
          }));
          console.log(`Full sync: ${Object.keys(annotations).length} annotations loaded`);
        }

        // Update last sync time
        localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
        setSyncError(null);
      } catch (error) {
        console.error('Failed to load annotations from API:', error);
        setSyncError('Failed to sync with server. Using local data.');
      } finally {
        setIsLoading(false);
      }
    };

    loadFromApi();
  }, [isApiEnabled]);

  // Save annotations to localStorage as backup (always)
  useEffect(() => {
    if (!isLoading) {
      saveLocalData(data);
    }
  }, [data, isLoading]);

  const getAnnotation = useCallback(
    (path: string): Annotation | undefined => {
      return data.annotations[path];
    },
    [data.annotations]
  );

  const setAnnotation = useCallback(
    async (path: string, annotation: Partial<Annotation>) => {
      const updateLocal = (prev: AnnotationData) => {
        const existing = prev.annotations[path];
        const baseAnnotation = existing || {
          quality: 'maybe' as Quality,
          character: 'none' as Character,
          tags: [] as ActionTag[],
          annotatedAt: new Date().toISOString(),
        };

        const newAnnotation: Annotation = {
          ...baseAnnotation,
          ...annotation,
          annotatedAt: new Date().toISOString(),
        };

        // Track history only for non-undo/redo actions
        if (!isUndoRedoAction.current) {
          const historyEntry: HistoryEntry = {
            path,
            before: existing ? { ...existing } : undefined,
            after: { ...newAnnotation },
          };

          setUndoStack((stack) => {
            const newStack = [...stack, historyEntry];
            if (newStack.length > MAX_HISTORY_SIZE) {
              return newStack.slice(-MAX_HISTORY_SIZE);
            }
            return newStack;
          });
          setRedoStack([]);
        }

        return {
          ...prev,
          annotations: {
            ...prev.annotations,
            [path]: newAnnotation,
          },
        };
      };

      // Optimistic update
      setData((prev) => {
        const updated = updateLocal(prev);

        // Queue sync to API if enabled
        if (isApiEnabled) {
          const newAnnotation = updated.annotations[path];
          syncQueue.enqueueSave(path, newAnnotation);
        }

        return updated;
      });
    },
    [isApiEnabled]
  );

  const undo = useCallback(() => {
    if (undoStack.length === 0) return false;

    const lastAction = undoStack[undoStack.length - 1];
    setUndoStack((stack) => stack.slice(0, -1));
    setRedoStack((stack) => [...stack, lastAction]);

    isUndoRedoAction.current = true;

    const updateData = (prev: AnnotationData) => {
      if (lastAction.before === undefined) {
        const { [lastAction.path]: _, ...rest } = prev.annotations;
        return { ...prev, annotations: rest };
      } else {
        return {
          ...prev,
          annotations: {
            ...prev.annotations,
            [lastAction.path]: lastAction.before,
          },
        };
      }
    };

    setData(updateData);

    // Queue undo sync to API
    if (isApiEnabled) {
      if (lastAction.before === undefined) {
        syncQueue.enqueueDelete(lastAction.path);
      } else {
        syncQueue.enqueueSave(lastAction.path, lastAction.before);
      }
    }

    isUndoRedoAction.current = false;
    return true;
  }, [undoStack, isApiEnabled]);

  const redo = useCallback(() => {
    if (redoStack.length === 0) return false;

    const nextAction = redoStack[redoStack.length - 1];
    setRedoStack((stack) => stack.slice(0, -1));
    setUndoStack((stack) => [...stack, nextAction]);

    isUndoRedoAction.current = true;

    setData((prev) => ({
      ...prev,
      annotations: {
        ...prev.annotations,
        [nextAction.path]: nextAction.after,
      },
    }));

    // Queue redo sync to API
    if (isApiEnabled) {
      syncQueue.enqueueSave(nextAction.path, nextAction.after);
    }

    isUndoRedoAction.current = false;
    return true;
  }, [redoStack, isApiEnabled]);

  const deleteAnnotation = useCallback(
    (path: string) => {
      setData((prev) => {
        const existing = prev.annotations[path];
        if (!existing) return prev;

        // Track history for undo
        if (!isUndoRedoAction.current) {
          const historyEntry: HistoryEntry = {
            path,
            before: { ...existing },
            after: {
              quality: 'maybe' as Quality,
              character: 'none' as Character,
              tags: [] as ActionTag[],
              annotatedAt: new Date().toISOString(),
            },
          };

          setUndoStack((stack) => {
            const newStack = [...stack, historyEntry];
            if (newStack.length > MAX_HISTORY_SIZE) {
              return newStack.slice(-MAX_HISTORY_SIZE);
            }
            return newStack;
          });
          setRedoStack([]);
        }

        // Remove the annotation from the object
        const { [path]: _, ...rest } = prev.annotations;
        return {
          ...prev,
          annotations: rest,
        };
      });

      // Queue delete to API if enabled
      if (isApiEnabled) {
        syncQueue.enqueueDelete(path);
      }
    },
    [isApiEnabled]
  );

  const setLastReviewedIndex = useCallback((index: number, path?: string) => {
    setData((prev) => ({
      ...prev,
      lastReviewedIndex: index,
      lastReviewedPath: path ?? prev.lastReviewedPath,
    }));
  }, []);

  const getAnnotationCount = useCallback(() => {
    return Object.keys(data.annotations).length;
  }, [data.annotations]);

  const exportAnnotations = useCallback(() => {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `annotations-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [data]);

  const importAnnotations = useCallback(
    (file: File, options?: { merge?: boolean; skipConfirmation?: boolean }): Promise<boolean> => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const parsed = JSON.parse(e.target?.result as string);

            if (!isValidAnnotationData(parsed)) {
              alert('Invalid annotation file format. The file must contain valid annotation data.');
              resolve(false);
              return;
            }

            const imported = parsed as AnnotationData;
            const existingCount = Object.keys(data.annotations).length;
            const importedCount = Object.keys(imported.annotations).length;

            if (!options?.skipConfirmation && existingCount > 0) {
              const action = options?.merge ? 'merge with' : 'replace';
              const confirmed = window.confirm(
                `You have ${existingCount} existing annotations. This will ${action} ${importedCount} imported annotations. Continue?`
              );
              if (!confirmed) {
                resolve(false);
                return;
              }
            }

            let newAnnotations: Record<string, Annotation>;
            if (options?.merge) {
              newAnnotations = {
                ...data.annotations,
                ...imported.annotations,
              };
            } else {
              newAnnotations = imported.annotations;
            }

            // Update local state
            if (options?.merge) {
              setData((prev) => ({
                ...prev,
                annotations: newAnnotations,
              }));
            } else {
              setData(imported);
            }

            // Sync to API if enabled
            if (isApiEnabled) {
              try {
                await api.batchImportAnnotations(newAnnotations);
                setSyncError(null);
              } catch (error) {
                console.error('Failed to sync import to API:', error);
                setSyncError('Import saved locally but failed to sync to server.');
              }
            }

            resolve(true);
          } catch {
            alert('Failed to parse annotation file. Please ensure it is valid JSON.');
            resolve(false);
          }
        };
        reader.onerror = () => {
          alert('Failed to read the file.');
          resolve(false);
        };
        reader.readAsText(file);
      });
    },
    [data, isApiEnabled]
  );

  const retrySyncFailures = useCallback(() => {
    syncQueue.retryFailed();
  }, []);

  return {
    data,
    isLoading,
    syncError,
    isApiEnabled,
    pendingSyncCount,
    retrySyncFailures,
    getAnnotation,
    setAnnotation,
    deleteAnnotation,
    setLastReviewedIndex,
    getAnnotationCount,
    exportAnnotations,
    importAnnotations,
    undo,
    redo,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
  };
}
