import { useState, useMemo, useCallback } from 'react';
import { AvatarViewer } from './components/AvatarViewer';
import { AnnotationPanel } from './components/AnnotationPanel';
import { ProgressBar } from './components/ProgressBar';
import { AnimationList } from './components/AnimationList';
import { useAnnotations } from './hooks/useAnnotations';
import { useAnimationList } from './hooks/useAnimationList';
import type { AnimationEntry } from './types';

// Helper to compute initial index from saved state
function computeInitialIndex(
  lastReviewedPath: string | null,
  lastReviewedIndex: number,
  filteredAnimations: AnimationEntry[],
  filteredCount: number
): number {
  // Try to find by path first (filter-aware)
  if (lastReviewedPath) {
    const pathIndex = filteredAnimations.findIndex((anim) => anim.path === lastReviewedPath);
    if (pathIndex >= 0) {
      return pathIndex;
    }
  }
  // Fall back to index
  if (lastReviewedIndex > 0) {
    return Math.min(lastReviewedIndex, Math.max(0, filteredCount - 1));
  }
  return 0;
}

function App() {
  const {
    data: annotationData,
    isLoading: annotationsLoading,
    getAnnotation,
    setAnnotation,
    setLastReviewedIndex,
    getAnnotationCount,
    exportAnnotations,
    importAnnotations,
  } = useAnnotations();

  const annotatedPaths = useMemo(
    () => new Set(Object.keys(annotationData.annotations)),
    [annotationData.annotations]
  );

  const {
    isLoading: manifestLoading,
    error: manifestError,
    filter,
    setFilter,
    filteredAnimations,
    categories,
    packs,
    getAnimationByIndex,
    filteredCount,
  } = useAnimationList(annotatedPaths);

  const [replayKey, setReplayKey] = useState(0);
  const [hasInitialized, setHasInitialized] = useState(false);

  // Compute initial index synchronously - only calculated once when data first becomes available
  const initialIndex = useMemo(() => {
    if (annotationsLoading || manifestLoading) {
      return 0;
    }
    return computeInitialIndex(
      annotationData.lastReviewedPath,
      annotationData.lastReviewedIndex,
      filteredAnimations,
      filteredCount
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [annotationsLoading, manifestLoading]); // Only recompute when loading state changes

  // Use initialIndex until user makes their first interaction
  const [userSelectedIndex, setUserSelectedIndex] = useState<number | null>(null);

  // The effective index is either the user's selection or the computed initial
  const effectiveIndex = hasInitialized ? (userSelectedIndex ?? initialIndex) : initialIndex;

  // Wrapper that tracks user interaction
  const setCurrentIndex = useCallback(
    (index: number) => {
      setHasInitialized(true);
      setUserSelectedIndex(index);
    },
    []
  );

  const currentAnimation = getAnimationByIndex(effectiveIndex);

  const goToNext = useCallback(() => {
    if (effectiveIndex < filteredCount - 1) {
      const newIndex = effectiveIndex + 1;
      const nextAnim = filteredAnimations[newIndex];
      setCurrentIndex(newIndex);
      setLastReviewedIndex(newIndex, nextAnim?.path);
    }
  }, [effectiveIndex, filteredCount, filteredAnimations, setCurrentIndex, setLastReviewedIndex]);

  const goToPrevious = useCallback(() => {
    if (effectiveIndex > 0) {
      const newIndex = effectiveIndex - 1;
      const prevAnim = filteredAnimations[newIndex];
      setCurrentIndex(newIndex);
      setLastReviewedIndex(newIndex, prevAnim?.path);
    }
  }, [effectiveIndex, filteredAnimations, setCurrentIndex, setLastReviewedIndex]);

  const handleReplay = useCallback(() => {
    setReplayKey((k) => k + 1);
  }, []);

  const handleSelectAnimation = useCallback(
    (index: number) => {
      const anim = filteredAnimations[index];
      setCurrentIndex(index);
      setLastReviewedIndex(index, anim?.path);
    },
    [filteredAnimations, setCurrentIndex, setLastReviewedIndex]
  );

  const handleImport = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        importAnnotations(file);
      }
    };
    input.click();
  }, [importAnnotations]);

  const handleClearCache = useCallback(async () => {
    // Clear SDK-related localStorage
    const keysToRemove = Object.keys(localStorage).filter(
      (k) => k.includes('agsn') || k.includes('avatar')
    );
    keysToRemove.forEach((k) => localStorage.removeItem(k));

    // Clear Cache API
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((name) => caches.delete(name)));

    // Clear IndexedDB
    const databases = await indexedDB.databases();
    databases.forEach((db) => {
      if (db.name) indexedDB.deleteDatabase(db.name);
    });

    // Fetch fresh manifest to bust HTTP cache
    const cdnBase = 'https://avatars.staging.agsn.ai';
    await fetch(`${cdnBase}/manifest.json`, { cache: 'reload' });

    // Also fetch the webview with cache bust
    const manifestResp = await fetch(`${cdnBase}/manifest.json`, { cache: 'no-store' });
    const manifest = await manifestResp.json();
    const webviewVersion = manifest.webview?.version;
    if (webviewVersion) {
      await fetch(`${cdnBase}/webview/${webviewVersion}/index.html`, { cache: 'reload' });
    }

    // Reload to fetch fresh SDK
    window.location.reload();
  }, []);

  if (annotationsLoading || manifestLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-gray-300">Loading...</p>
        </div>
      </div>
    );
  }

  if (manifestError) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-2">Failed to load animation manifest</p>
          <p className="text-gray-500 text-sm">{manifestError}</p>
          <p className="text-gray-500 text-sm mt-2">
            Run <code className="bg-gray-800 px-1 rounded">npm run generate-manifest</code> first
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-3">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">Avatars Animation Reviewer</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={handleClearCache}
              className="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 rounded transition-colors"
              title="Clear SDK cache and reload"
            >
              Clear Cache
            </button>
            <button
              onClick={handleImport}
              className="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 rounded transition-colors"
            >
              Import
            </button>
            <button
              onClick={exportAnnotations}
              className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 rounded transition-colors"
            >
              Export
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="flex h-[calc(100vh-57px)]">
        {/* Sidebar */}
        <aside className="w-64 border-r border-gray-700 p-2">
          <AnimationList
            animations={filteredAnimations}
            currentIndex={effectiveIndex}
            annotatedPaths={annotatedPaths}
            filter={filter}
            packs={packs}
            categories={categories}
            onSelect={handleSelectAnimation}
            onFilterChange={setFilter}
          />
        </aside>

        {/* Main area */}
        <main className="flex-1 flex flex-col p-4 gap-4">
          {/* Progress */}
          <ProgressBar
            current={effectiveIndex}
            total={filteredCount}
            annotatedInView={filteredAnimations.filter((a) => annotatedPaths.has(a.path)).length}
            annotatedTotal={getAnnotationCount()}
          />

          {/* Viewer and annotation panel */}
          <div className="flex-1 flex gap-4 min-h-0">
            {/* Avatar viewer */}
            <div className="flex-1">
              {currentAnimation ? (
                <AvatarViewer
                  key={`${currentAnimation.path}-${replayKey}`}
                  animationPath={currentAnimation.path}
                  onError={(err) => console.error(err)}
                />
              ) : (
                <div className="w-full h-full bg-gray-800 rounded-lg flex items-center justify-center">
                  <p className="text-gray-500">No animation selected</p>
                </div>
              )}
            </div>

            {/* Annotation panel */}
            <div className="w-80 flex-shrink-0">
              {currentAnimation ? (
                <AnnotationPanel
                  animationPath={currentAnimation.path}
                  annotation={getAnnotation(currentAnimation.path)}
                  onAnnotationChange={setAnnotation}
                  onNext={goToNext}
                  onPrevious={goToPrevious}
                  onReplay={handleReplay}
                />
              ) : (
                <div className="bg-gray-800 rounded-lg p-4 text-gray-500">
                  Select an animation to annotate
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
