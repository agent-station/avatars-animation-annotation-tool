import { useState, useMemo, useCallback, useEffect } from 'react';
import { AvatarViewer } from './components/AvatarViewer';
import { AnnotationPanel } from './components/AnnotationPanel';
import { ProgressBar } from './components/ProgressBar';
import { AnimationList } from './components/AnimationList';
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal';
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
    undo,
    redo,
    canUndo,
    canRedo,
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
  } = useAnimationList(annotatedPaths, annotationData.annotations);

  // Compute quality stats for filtered animations
  const qualityStats = useMemo(() => {
    const stats = { approved: 0, rejected: 0, maybe: 0 };
    filteredAnimations.forEach((anim) => {
      const annotation = annotationData.annotations[anim.path];
      if (annotation) {
        stats[annotation.quality]++;
      }
    });
    return stats;
  }, [filteredAnimations, annotationData.annotations]);

  const [replayKey, setReplayKey] = useState(0);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  // Global keyboard shortcuts for help modal and undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Undo: Ctrl+Z (or Cmd+Z on Mac)
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }

      // Redo: Ctrl+Shift+Z (or Cmd+Shift+Z on Mac) or Ctrl+Y
      if ((e.ctrlKey || e.metaKey) && (e.key === 'Z' || (e.key === 'z' && e.shiftKey) || e.key === 'y')) {
        e.preventDefault();
        redo();
        return;
      }

      // Help modal
      if (e.key === '?' && !showShortcutsModal) {
        e.preventDefault();
        setShowShortcutsModal(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showShortcutsModal, undo, redo]);

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

  const handleTogglePause = useCallback(() => {
    setIsPaused((prev) => !prev);
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
    // Clear ALL localStorage (SDK stores manifest and version info here)
    localStorage.clear();

    // Clear ALL Cache API caches
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((name) => caches.delete(name)));

    // Clear ALL IndexedDB databases
    const databases = await indexedDB.databases();
    await Promise.all(
      databases.map(
        (db) =>
          new Promise<void>((resolve) => {
            if (db.name) {
              const req = indexedDB.deleteDatabase(db.name);
              req.onsuccess = () => resolve();
              req.onerror = () => resolve();
              req.onblocked = () => resolve();
            } else {
              resolve();
            }
          })
      )
    );

    // Force reload bypassing cache
    window.location.href = window.location.href + '?cacheBust=' + Date.now();
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
            {/* Undo/Redo buttons */}
            <div className="flex items-center border-r border-gray-700 pr-2 mr-1">
              <button
                onClick={undo}
                disabled={!canUndo}
                className={`p-1.5 rounded transition-colors ${
                  canUndo
                    ? 'text-gray-400 hover:text-white hover:bg-gray-700'
                    : 'text-gray-600 cursor-not-allowed'
                }`}
                title="Undo (Ctrl+Z)"
                aria-label="Undo"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                </svg>
              </button>
              <button
                onClick={redo}
                disabled={!canRedo}
                className={`p-1.5 rounded transition-colors ${
                  canRedo
                    ? 'text-gray-400 hover:text-white hover:bg-gray-700'
                    : 'text-gray-600 cursor-not-allowed'
                }`}
                title="Redo (Ctrl+Shift+Z)"
                aria-label="Redo"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
                </svg>
              </button>
            </div>

            <button
              onClick={() => setShowShortcutsModal(true)}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
              title="Keyboard shortcuts (?)"
              aria-label="Show keyboard shortcuts"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
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
            qualityStats={qualityStats}
          />

          {/* Viewer and annotation panel */}
          <div className="flex-1 flex gap-4 min-h-0">
            {/* Avatar viewer */}
            <div className="flex-1">
              {currentAnimation ? (
                <AvatarViewer
                  key={replayKey}
                  animationPath={currentAnimation.path}
                  isPaused={isPaused}
                  onError={(err) => console.error(err)}
                />
              ) : (
                <div className="w-full h-full bg-gray-800 rounded-lg flex items-center justify-center">
                  <p className="text-gray-500">No animation selected</p>
                </div>
              )}
            </div>

            {/* Annotation panel */}
            <div className="w-72 flex-shrink-0">
              {currentAnimation ? (
                <AnnotationPanel
                  animationPath={currentAnimation.path}
                  annotation={getAnnotation(currentAnimation.path)}
                  onAnnotationChange={setAnnotation}
                  onNext={goToNext}
                  onPrevious={goToPrevious}
                  onReplay={handleReplay}
                  isPaused={isPaused}
                  onTogglePause={handleTogglePause}
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

      {/* Keyboard shortcuts modal */}
      <KeyboardShortcutsModal
        isOpen={showShortcutsModal}
        onClose={() => setShowShortcutsModal(false)}
      />
    </div>
  );
}

export default App;
