import { useState, useCallback, useEffect, useRef } from 'react';
import type { Annotation, AnnotationData, Quality, Character, ActionTag } from '../types';

const STORAGE_KEY = 'animation-annotations';
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

// Load initial data from localStorage synchronously to avoid cascading renders
function loadInitialData(): AnnotationData {
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

export function useAnnotations() {
  // Use lazy initialization to avoid cascading renders
  const [data, setData] = useState<AnnotationData>(loadInitialData);
  const [isLoading] = useState(false);

  // Undo/redo history
  const [undoStack, setUndoStack] = useState<HistoryEntry[]>([]);
  const [redoStack, setRedoStack] = useState<HistoryEntry[]>([]);
  const isUndoRedoAction = useRef(false);

  // Save annotations to localStorage whenever data changes
  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
  }, [data, isLoading]);

  const getAnnotation = useCallback(
    (path: string): Annotation | undefined => {
      return data.annotations[path];
    },
    [data.annotations]
  );

  const setAnnotation = useCallback(
    (path: string, annotation: Partial<Annotation>) => {
      setData((prev) => {
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
            // Limit history size
            if (newStack.length > MAX_HISTORY_SIZE) {
              return newStack.slice(-MAX_HISTORY_SIZE);
            }
            return newStack;
          });
          // Clear redo stack when new action is performed
          setRedoStack([]);
        }

        return {
          ...prev,
          annotations: {
            ...prev.annotations,
            [path]: newAnnotation,
          },
        };
      });
    },
    []
  );

  const undo = useCallback(() => {
    if (undoStack.length === 0) return false;

    const lastAction = undoStack[undoStack.length - 1];
    setUndoStack((stack) => stack.slice(0, -1));
    setRedoStack((stack) => [...stack, lastAction]);

    isUndoRedoAction.current = true;
    setData((prev) => {
      if (lastAction.before === undefined) {
        // Remove the annotation
        const { [lastAction.path]: _, ...rest } = prev.annotations;
        return { ...prev, annotations: rest };
      } else {
        // Restore previous state
        return {
          ...prev,
          annotations: {
            ...prev.annotations,
            [lastAction.path]: lastAction.before,
          },
        };
      }
    });
    isUndoRedoAction.current = false;
    return true;
  }, [undoStack]);

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
    isUndoRedoAction.current = false;
    return true;
  }, [redoStack]);

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
        reader.onload = (e) => {
          try {
            const parsed = JSON.parse(e.target?.result as string);

            // Validate the imported data structure
            if (!isValidAnnotationData(parsed)) {
              alert('Invalid annotation file format. The file must contain valid annotation data.');
              resolve(false);
              return;
            }

            const imported = parsed as AnnotationData;
            const existingCount = Object.keys(data.annotations).length;
            const importedCount = Object.keys(imported.annotations).length;

            // Require confirmation unless explicitly skipped
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

            if (options?.merge) {
              // Merge: imported annotations take precedence over existing
              setData((prev) => ({
                ...prev,
                annotations: {
                  ...prev.annotations,
                  ...imported.annotations,
                },
              }));
            } else {
              // Replace all data
              setData(imported);
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
    [data.annotations]
  );

  return {
    data,
    isLoading,
    getAnnotation,
    setAnnotation,
    setLastReviewedIndex,
    getAnnotationCount,
    exportAnnotations,
    importAnnotations,
    // Undo/redo
    undo,
    redo,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
  };
}
