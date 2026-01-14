import { useEffect, useCallback, useMemo, useState, useRef } from 'react';
import type { Annotation, Quality, Character, ActionTag } from '../types';

// Flash feedback type
type FlashSection = 'quality' | 'character' | 'tags' | null;

interface AnnotationPanelProps {
  animationPath: string;
  annotation: Annotation | undefined;
  onAnnotationChange: (path: string, annotation: Partial<Annotation>) => void;
  onNext: () => void;
  onPrevious: () => void;
  onReplay: () => void;
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
  onNext,
  onPrevious,
  onReplay,
}: AnnotationPanelProps) {
  const currentQuality = annotation?.quality ?? 'maybe';
  const currentCharacter = annotation?.character ?? 'none';
  // Use useMemo to avoid creating a new array reference on every render
  const currentTags = useMemo(() => annotation?.tags ?? [], [annotation?.tags]);
  const currentNotes = annotation?.notes ?? '';

  // UI state
  const [showInfo, setShowInfo] = useState(false);
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
    onAnnotationChange(animationPath, {
      quality: 'maybe',
      character: 'none',
      tags: [],
      notes: undefined,
    });
    setNotesInput('');
  }, [animationPath, onAnnotationChange]);

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

      // Navigation
      if (key === 'enter') {
        onNext();
      } else if (key === 'arrowleft') {
        onPrevious();
      } else if (key === 'arrowright') {
        onNext();
      } else if (key === ' ') {
        e.preventDefault();
        onReplay();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setQuality, setCharacter, toggleTag, onNext, onPrevious, onReplay]);

  // Parse animation path for display with fallbacks for malformed paths
  const pathParts = animationPath ? animationPath.split('/').filter(Boolean) : [];
  const pack = pathParts[0] ?? 'Unknown';
  const category = pathParts.length > 2 ? pathParts.slice(1, -1).join('/') : null;
  const filename = pathParts.length > 0 ? pathParts[pathParts.length - 1] : animationPath || 'Unknown';

  return (
    <div className="bg-gray-800 rounded-lg p-4 space-y-4">
      {/* Animation info (collapsible) */}
      <div className="border-b border-gray-700 pb-3">
        <button
          onClick={() => setShowInfo(!showInfo)}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors w-full text-left"
        >
          <svg
            className={`w-4 h-4 transition-transform ${showInfo ? 'rotate-90' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-white font-mono text-sm truncate flex-1">{filename}</span>
        </button>
        {showInfo && (
          <div className="mt-2 pl-6 text-sm text-gray-400">
            <p>Pack: {pack}</p>
            {category && <p>Category: {category}</p>}
          </div>
        )}
      </div>

      {/* Quality */}
      <div className={`p-2 -m-2 rounded-lg transition-all duration-300 ${flashSection === 'quality' ? 'ring-2 ring-green-500/50 bg-green-500/10' : ''}`}>
        <p className="text-xs text-gray-400 mb-2">Quality</p>
        <div className="flex gap-2">
          {QUALITY_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => setQuality(option.value)}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                currentQuality === option.value
                  ? option.value === 'approved'
                    ? 'bg-green-600 text-white'
                    : option.value === 'rejected'
                      ? 'bg-red-600 text-white'
                      : 'bg-yellow-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              [{option.key}] {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Character */}
      <div className={`p-2 -m-2 rounded-lg transition-all duration-300 ${flashSection === 'character' ? 'ring-2 ring-blue-500/50 bg-blue-500/10' : ''}`}>
        <p className="text-xs text-gray-400 mb-2">Character</p>
        <div className="flex gap-2 flex-wrap">
          {CHARACTER_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => setCharacter(option.value)}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                currentCharacter === option.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              [{option.key.toUpperCase()}] {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tags */}
      <div className={`p-2 -m-2 rounded-lg transition-all duration-300 ${flashSection === 'tags' ? 'ring-2 ring-purple-500/50 bg-purple-500/10' : ''}`}>
        <p className="text-xs text-gray-400 mb-2">Tags</p>
        <div className="flex gap-2 flex-wrap">
          {TAG_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => toggleTag(option.value)}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                currentTags.includes(option.value)
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              [{option.key.toUpperCase()}] {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div>
        <p className="text-xs text-gray-400 mb-2">Notes (optional)</p>
        <textarea
          value={notesInput}
          onChange={(e) => setNotesInput(e.target.value)}
          onBlur={handleNotesBlur}
          placeholder="Add notes about this animation..."
          className="w-full bg-gray-700 text-white text-sm rounded px-3 py-2 placeholder-gray-500 resize-none h-16"
          aria-label="Annotation notes"
        />
      </div>

      {/* Clear button */}
      {annotation && (
        <button
          onClick={handleClearAnnotation}
          className="w-full px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors"
        >
          Clear Annotation
        </button>
      )}

      {/* Navigation hint */}
      <div className="border-t border-gray-700 pt-3 text-xs text-gray-500">
        <p>
          <span className="text-gray-400">[Enter]</span> Next &nbsp;
          <span className="text-gray-400">[Arrows]</span> Navigate &nbsp;
          <span className="text-gray-400">[Space]</span> Replay
        </p>
      </div>
    </div>
  );
}
