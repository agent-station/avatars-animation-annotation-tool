import { useState, useEffect, useMemo, useCallback } from 'react';
import type { AnimationManifest, AnimationEntry } from '../types';

import type { Quality, Annotation } from '../types';

export interface AnimationFilter {
  pack?: string;
  category?: string;
  unannotatedOnly?: boolean;
  searchQuery?: string;
  qualityFilter?: Quality | 'all';
}

export function useAnimationList(
  annotatedPaths: Set<string>,
  annotations?: Record<string, Annotation>
) {
  const [manifest, setManifest] = useState<AnimationManifest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<AnimationFilter>({});

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}animation-manifest.json`)
      .then((res) => res.json())
      .then((data: AnimationManifest) => {
        setManifest(data);
        setIsLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setIsLoading(false);
      });
  }, []);

  const filteredAnimations = useMemo(() => {
    if (!manifest) return [];

    const searchLower = filter.searchQuery?.toLowerCase().trim();

    return manifest.animations.filter((anim) => {
      if (filter.pack && anim.pack !== filter.pack) return false;
      if (filter.category && anim.category !== filter.category) return false;
      if (filter.unannotatedOnly && annotatedPaths.has(anim.path)) return false;
      if (searchLower && !anim.filename.toLowerCase().includes(searchLower)) return false;

      // Quality filter
      if (filter.qualityFilter && filter.qualityFilter !== 'all' && annotations) {
        const annotation = annotations[anim.path];
        if (!annotation || annotation.quality !== filter.qualityFilter) return false;
      }

      return true;
    });
  }, [manifest, filter, annotatedPaths, annotations]);

  const categories = useMemo(() => {
    if (!manifest) return [];

    const cats = new Set<string>();
    manifest.animations.forEach((anim) => {
      if (anim.category) cats.add(anim.category);
    });
    return Array.from(cats).sort();
  }, [manifest]);

  const packs = useMemo(() => {
    return manifest?.packs ?? [];
  }, [manifest]);

  const getAnimationByIndex = useCallback(
    (index: number): AnimationEntry | null => {
      return filteredAnimations[index] ?? null;
    },
    [filteredAnimations]
  );

  return {
    manifest,
    isLoading,
    error,
    filter,
    setFilter,
    filteredAnimations,
    categories,
    packs,
    getAnimationByIndex,
    totalCount: manifest?.totalCount ?? 0,
    filteredCount: filteredAnimations.length,
  };
}
