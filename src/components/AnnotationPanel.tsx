import { useEffect, useCallback, useMemo } from 'react';
import type { Annotation, Quality, Character, ActionTag } from '../types';

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

  const setQuality = useCallback(
    (quality: Quality) => {
      onAnnotationChange(animationPath, { quality });
    },
    [animationPath, onAnnotationChange]
  );

  const setCharacter = useCallback(
    (character: Character) => {
      onAnnotationChange(animationPath, { character });
    },
    [animationPath, onAnnotationChange]
  );

  const toggleTag = useCallback(
    (tag: ActionTag) => {
      const newTags = currentTags.includes(tag)
        ? currentTags.filter((t) => t !== tag)
        : [...currentTags, tag];
      onAnnotationChange(animationPath, { tags: newTags });
    },
    [animationPath, currentTags, onAnnotationChange]
  );

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
      {/* Animation info */}
      <div className="border-b border-gray-700 pb-3">
        <p className="text-sm text-gray-400">Pack: {pack}</p>
        {category && <p className="text-sm text-gray-400">Category: {category}</p>}
        <p className="text-white font-mono text-sm mt-1">{filename}</p>
      </div>

      {/* Quality */}
      <div>
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
      <div>
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
      <div>
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
