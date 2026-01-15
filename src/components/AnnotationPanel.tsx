import { useEffect, useCallback, useMemo, useState, useRef } from 'react';
import type { Annotation, Quality, Character, ActionTag } from '../types';

// Flash feedback type
type FlashSection = 'quality' | 'character' | 'tags' | null;

interface AnnotationPanelProps {
  animationPath: string;
  annotation: Annotation | undefined;
  onAnnotationChange: (path: string, annotation: Partial<Annotation>) => void;
  onClearAnnotation: (path: string) => void;
  onNext: () => void;
  onPrevious: () => void;
  onReplay: () => void;
  isPaused: boolean;
  onTogglePause: () => void;
}

const QUALITY_OPTIONS: { value: Quality; label: string; key: string }[] = [
  { value: 'approved', label: 'Approved', key: '1' },
  { value: 'rejected', label: 'Rejected', key: '2' },
  { value: 'maybe', label: 'Maybe', key: '3' },
];

const CHARACTER_OPTIONS: { value: Character; label: string; key: string }[] = [
  { value: 'sarang', label: 'Sarang', key: 's' },
  { value: 'yeona', label: 'Yeona', key: 'y' },
  { value: 'other', label: 'Other', key: 'o' },
  { value: 'none', label: 'None', key: 'n' },
];

const TAG_OPTIONS: { value: ActionTag; label: string; key: string }[] = [
  { value: 'idle', label: 'Idle', key: 'i' },
  { value: 'greeting', label: 'Greeting', key: 'g' },
  { value: 'reaction', label: 'Reaction', key: 'r' },
  { value: 'conversation', label: 'Conversation', key: 'c' },
  { value: 'locomotion', label: 'Locomotion', key: 'l' },
  { value: 'combat', label: 'Combat', key: 'x' },
];

export function AnnotationPanel({
  animationPath,
  annotation,
  onAnnotationChange,
  onClearAnnotation,
  onNext,
  onPrevious,
  onReplay,
  isPaused,
  onTogglePause,
}: AnnotationPanelProps) {
  const currentQuality = annotation?.quality ?? 'maybe';
  const currentCharacter = annotation?.character ?? 'none';
  // Use useMemo to avoid creating a new array reference on every render
  const currentTags = useMemo(() => annotation?.tags ?? [], [annotation?.tags]);
  const currentNotes = annotation?.notes ?? '';

  // UI state
  const [notesInput, setNotesInput] = useState(currentNotes);

  // Sync notes input when animation changes
  useEffect(() => {
    setNotesInput(currentNotes);
  }, [currentNotes, animationPath]);

  // Flash feedback state
  const [flashSection, setFlashSection] = useState<FlashSection>(null);
  const flashTimeoutRef = useRef<number | null>(null);

  const triggerFlash = useCallback((section: FlashSection) => {
    if (flashTimeoutRef.current) {
      clearTimeout(flashTimeoutRef.current);
    }
    setFlashSection(section);
    flashTimeoutRef.current = window.setTimeout(() => {
      setFlashSection(null);
    }, 300);
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (flashTimeoutRef.current) {
        clearTimeout(flashTimeoutRef.current);
      }
    };
  }, []);

  const setQuality = useCallback(
    (quality: Quality) => {
      onAnnotationChange(animationPath, { quality });
      triggerFlash('quality');
    },
    [animationPath, onAnnotationChange, triggerFlash]
  );

  const setCharacter = useCallback(
    (character: Character) => {
      onAnnotationChange(animationPath, { character });
      triggerFlash('character');
    },
    [animationPath, onAnnotationChange, triggerFlash]
  );

  const toggleTag = useCallback(
    (tag: ActionTag) => {
      const newTags = currentTags.includes(tag)
        ? currentTags.filter((t) => t !== tag)
        : [...currentTags, tag];
      onAnnotationChange(animationPath, { tags: newTags });
      triggerFlash('tags');
    },
    [animationPath, currentTags, onAnnotationChange, triggerFlash]
  );

  const handleNotesBlur = useCallback(() => {
    if (notesInput !== currentNotes) {
      onAnnotationChange(animationPath, { notes: notesInput || undefined });
    }
  }, [animationPath, notesInput, currentNotes, onAnnotationChange]);

  const handleClearAnnotation = useCallback(() => {
    onClearAnnotation(animationPath);
    setNotesInput('');
  }, [animationPath, onClearAnnotation]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const key = e.key.toLowerCase();

      // Quality shortcuts (1, 2, 3)
      const qualityOption = QUALITY_OPTIONS.find((q) => q.key === key);
      if (qualityOption) {
        setQuality(qualityOption.value);
        return;
      }

      // Character shortcuts (s, y, o, n)
      const characterOption = CHARACTER_OPTIONS.find((c) => c.key === key);
      if (characterOption) {
        setCharacter(characterOption.value);
        return;
      }

      // Tag shortcuts (i, g, r, c, l, x)
      const tagOption = TAG_OPTIONS.find((t) => t.key === key);
      if (tagOption) {
        toggleTag(tagOption.value);
        return;
      }

      // Playback control
      if (key === 'p') {
        e.preventDefault();
        onTogglePause();
        return;
      }

      // Navigation
      if (key === 'enter') {
        onNext();
      } else if (key === 'arrowleft') {
        e.preventDefault();
        onPrevious();
      } else if (key === 'arrowright') {
        e.preventDefault();
        onNext();
      } else if (key === ' ') {
        e.preventDefault();
        onReplay();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setQuality, setCharacter, toggleTag, onNext, onPrevious, onReplay, onTogglePause]);

  // Parse animation path for display with fallbacks for malformed paths
  const pathParts = animationPath ? animationPath.split('/').filter(Boolean) : [];
  const pack = pathParts[0] ?? 'Unknown';
  const category = pathParts.length > 2 ? pathParts.slice(1, -1).join('/') : null;
  const filename = pathParts.length > 0 ? pathParts[pathParts.length - 1] : animationPath || 'Unknown';

  // Helper to get quality button styles
  const getQualityButtonStyles = (option: typeof QUALITY_OPTIONS[0], isSelected: boolean) => {
    const baseStyles = 'flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-gray-800';

    if (isSelected) {
      switch (option.value) {
        case 'approved':
          return `${baseStyles} bg-green-600 text-white focus:ring-green-500`;
        case 'rejected':
          return `${baseStyles} bg-red-600 text-white focus:ring-red-500`;
        case 'maybe':
          return `${baseStyles} bg-amber-500 text-gray-900 focus:ring-amber-500`;
      }
    }
    return `${baseStyles} bg-gray-700/50 text-gray-300 border border-gray-600 hover:bg-gray-600 hover:border-gray-500 focus:ring-gray-500`;
  };

  return (
    <div className="bg-gray-800 rounded-lg p-3 space-y-3">
      {/* Animation info header */}
      <div className="pb-2 border-b border-gray-700">
        <h3 className="font-medium text-white text-xs truncate mb-1" title={filename}>
          {filename}
        </h3>
        <div className="flex items-center gap-2 text-[10px] text-gray-500">
          <span className="flex items-center gap-1 truncate">
            <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            <span className="truncate">{pack}</span>
          </span>
          {category && (
            <span className="flex items-center gap-1 truncate">
              <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
              <span className="truncate">{category}</span>
            </span>
          )}
        </div>
      </div>

      {/* Quality */}
      <div className={`p-2.5 rounded-lg transition-all duration-300 ${
        flashSection === 'quality'
          ? 'ring-2 ring-green-400/60 bg-green-400/15'
          : 'bg-gray-700/30'
      }`}>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">
          Quality
        </p>
        <div className="grid grid-cols-3 gap-1.5">
          {QUALITY_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => setQuality(option.value)}
              className={getQualityButtonStyles(option, currentQuality === option.value)}
            >
              <kbd className="inline-flex items-center justify-center w-4 h-4 text-[10px] bg-black/20 rounded">
                {option.key}
              </kbd>
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Character */}
      <div className={`p-2.5 rounded-lg transition-all duration-300 ${
        flashSection === 'character'
          ? 'ring-2 ring-blue-400/60 bg-blue-400/15'
          : 'bg-gray-700/30'
      }`}>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">
          Character
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          {CHARACTER_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => setCharacter(option.value)}
              className={`flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-gray-800 ${
                currentCharacter === option.value
                  ? 'bg-blue-600 text-white focus:ring-blue-500'
                  : 'bg-gray-700/50 text-gray-300 border border-gray-600 hover:bg-gray-600 hover:border-gray-500 focus:ring-gray-500'
              }`}
            >
              <kbd className="inline-flex items-center justify-center w-4 h-4 text-[10px] bg-black/20 rounded">
                {option.key.toUpperCase()}
              </kbd>
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tags */}
      <div className={`p-2.5 rounded-lg transition-all duration-300 ${
        flashSection === 'tags'
          ? 'ring-2 ring-purple-400/60 bg-purple-400/15'
          : 'bg-gray-700/30'
      }`}>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">
          Tags
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          {TAG_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => toggleTag(option.value)}
              className={`flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-gray-800 ${
                currentTags.includes(option.value)
                  ? 'bg-purple-600 text-white focus:ring-purple-500'
                  : 'bg-gray-700/50 text-gray-300 border border-gray-600 hover:bg-gray-600 hover:border-gray-500 focus:ring-gray-500'
              }`}
            >
              <kbd className="inline-flex items-center justify-center w-4 h-4 text-[10px] bg-black/20 rounded">
                {option.key.toUpperCase()}
              </kbd>
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div className="pt-1 border-t border-gray-700">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">
          Notes <span className="font-normal text-gray-500">(optional)</span>
        </p>
        <textarea
          value={notesInput}
          onChange={(e) => setNotesInput(e.target.value)}
          onBlur={handleNotesBlur}
          placeholder="Add notes about this animation..."
          className="w-full bg-gray-700/50 text-white text-xs rounded-lg px-2.5 py-2 placeholder-gray-500 resize-none h-16 border border-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 focus:outline-none transition-colors"
          aria-label="Annotation notes"
        />
      </div>

      {/* Clear button - always rendered to prevent layout shift */}
      <button
        onClick={handleClearAnnotation}
        disabled={!annotation}
        className={`w-full px-2.5 py-1.5 text-xs rounded-md border transition-colors ${
          annotation
            ? 'bg-gray-700/50 hover:bg-red-900/30 text-gray-400 hover:text-red-400 border-gray-600 hover:border-red-800'
            : 'invisible'
        }`}
      >
        Clear Annotation
      </button>

      {/* Navigation hint */}
      <div className="border-t border-gray-700 pt-2.5">
        <div className="flex items-center justify-between text-[9px]">
          <div className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 bg-gray-700 rounded text-gray-400 font-medium">Enter</kbd>
            <span className="text-gray-500">Next</span>
          </div>
          <div className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 bg-gray-700 rounded text-gray-400 font-medium">←→</kbd>
            <span className="text-gray-500">Nav</span>
          </div>
          <div className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 bg-gray-700 rounded text-gray-400 font-medium">Space</kbd>
            <span className="text-gray-500">Replay</span>
          </div>
          <button
            onClick={onTogglePause}
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors ${
              isPaused
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-400 hover:text-gray-300'
            }`}
            title={isPaused ? 'Resume (P)' : 'Pause (P)'}
          >
            {isPaused ? (
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            )}
            <kbd className="font-medium">P</kbd>
          </button>
        </div>
      </div>
    </div>
  );
}
