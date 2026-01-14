import { useState, useCallback, useEffect } from 'react';
import type { Annotation, AnnotationData, Quality, Character, ActionTag } from '../types';

const STORAGE_KEY = 'animation-annotations';

const defaultAnnotationData: AnnotationData = {
  version: 1,
  characters: ['sarang', 'yeona', 'other'],
  tags: ['idle', 'greeting', 'reaction', 'conversation', 'locomotion', 'combat'],
  lastReviewedIndex: 0,
  annotations: {},
};

export function useAnnotations() {
  const [data, setData] = useState<AnnotationData>(defaultAnnotationData);
  const [isLoading, setIsLoading] = useState(true);

  // Load annotations from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as AnnotationData;
        setData(parsed);
      } catch (e) {
        console.error('Failed to parse saved annotations:', e);
      }
    }
    setIsLoading(false);
  }, []);

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
        const existing = prev.annotations[path] || {
          quality: 'maybe' as Quality,
          character: 'none' as Character,
          tags: [] as ActionTag[],
          annotatedAt: new Date().toISOString(),
        };

        return {
          ...prev,
          annotations: {
            ...prev.annotations,
            [path]: {
              ...existing,
              ...annotation,
              annotatedAt: new Date().toISOString(),
            },
          },
        };
      });
    },
    []
  );

  const setLastReviewedIndex = useCallback((index: number) => {
    setData((prev) => ({
      ...prev,
      lastReviewedIndex: index,
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

  const importAnnotations = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target?.result as string) as AnnotationData;
        setData(imported);
      } catch (err) {
        console.error('Failed to import annotations:', err);
      }
    };
    reader.readAsText(file);
  }, []);

  return {
    data,
    isLoading,
    getAnnotation,
    setAnnotation,
    setLastReviewedIndex,
    getAnnotationCount,
    exportAnnotations,
    importAnnotations,
  };
}
