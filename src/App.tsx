import { useState, useMemo, useCallback, useEffect } from 'react';
import { AvatarViewer } from './components/AvatarViewer';
import { AnnotationPanel } from './components/AnnotationPanel';
import { ProgressBar } from './components/ProgressBar';
import { AnimationList } from './components/AnimationList';
import { useAnnotations } from './hooks/useAnnotations';
import { useAnimationList } from './hooks/useAnimationList';

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

  const [currentIndex, setCurrentIndex] = useState(0);
  const [replayKey, setReplayKey] = useState(0);

  // Initialize current index from last reviewed
  useEffect(() => {
    if (!annotationsLoading && annotationData.lastReviewedIndex > 0) {
      setCurrentIndex(Math.min(annotationData.lastReviewedIndex, filteredCount - 1));
    }
  }, [annotationsLoading, annotationData.lastReviewedIndex, filteredCount]);

  const currentAnimation = getAnimationByIndex(currentIndex);

  const goToNext = useCallback(() => {
    if (currentIndex < filteredCount - 1) {
      const newIndex = currentIndex + 1;
      setCurrentIndex(newIndex);
      setLastReviewedIndex(newIndex);
    }
  }, [currentIndex, filteredCount, setLastReviewedIndex]);

  const goToPrevious = useCallback(() => {
    if (currentIndex > 0) {
      const newIndex = currentIndex - 1;
      setCurrentIndex(newIndex);
      setLastReviewedIndex(newIndex);
    }
  }, [currentIndex, setLastReviewedIndex]);

  const handleReplay = useCallback(() => {
    setReplayKey((k) => k + 1);
  }, []);

  const handleSelectAnimation = useCallback(
    (index: number) => {
      setCurrentIndex(index);
      setLastReviewedIndex(index);
    },
    [setLastReviewedIndex]
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
          <h1 className="text-lg font-semibold">Animation Evaluator</h1>
          <div className="flex items-center gap-2">
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
            currentIndex={currentIndex}
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
            current={currentIndex}
            total={filteredCount}
            annotated={getAnnotationCount()}
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
