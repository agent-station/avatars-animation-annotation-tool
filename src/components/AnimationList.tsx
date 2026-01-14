import { useEffect, useRef } from 'react';
import type { AnimationEntry } from '../types';
import type { AnimationFilter } from '../hooks/useAnimationList';

interface AnimationListProps {
  animations: AnimationEntry[];
  currentIndex: number;
  annotatedPaths: Set<string>;
  filter: AnimationFilter;
  packs: string[];
  categories: string[];
  onSelect: (index: number) => void;
  onFilterChange: (filter: AnimationFilter) => void;
}

export function AnimationList({
  animations,
  currentIndex,
  annotatedPaths,
  filter,
  packs,
  categories,
  onSelect,
  onFilterChange,
}: AnimationListProps) {
  const currentItemRef = useRef<HTMLButtonElement>(null);

  // Scroll current item into view when index changes
  useEffect(() => {
    if (currentItemRef.current) {
      currentItemRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [currentIndex]);

  return (
    <div className="flex flex-col h-full bg-gray-800 rounded-lg overflow-hidden">
      {/* Filters */}
      <div className="p-3 border-b border-gray-700 space-y-2">
        <select
          value={filter.pack ?? ''}
          onChange={(e) => onFilterChange({ ...filter, pack: e.target.value || undefined })}
          className="w-full bg-gray-700 text-white text-sm rounded px-2 py-1.5"
          aria-label="Filter by animation pack"
        >
          <option value="">All Packs</option>
          {packs.map((pack) => (
            <option key={pack} value={pack}>
              {pack}
            </option>
          ))}
        </select>

        <select
          value={filter.category ?? ''}
          onChange={(e) => onFilterChange({ ...filter, category: e.target.value || undefined })}
          className="w-full bg-gray-700 text-white text-sm rounded px-2 py-1.5"
          aria-label="Filter by animation category"
        >
          <option value="">All Categories</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>

        <label className="flex items-center gap-2 text-sm text-gray-300">
          <input
            type="checkbox"
            checked={filter.unannotatedOnly ?? false}
            onChange={(e) => onFilterChange({ ...filter, unannotatedOnly: e.target.checked })}
            className="rounded bg-gray-700 border-gray-600"
          />
          Unannotated only
        </label>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto" role="listbox" aria-label="Animation list">
        {animations.length === 0 ? (
          <div className="p-4 text-center text-gray-500 text-sm">
            <p>No animations match the current filters</p>
            {(filter.pack || filter.category || filter.unannotatedOnly) && (
              <button
                onClick={() => onFilterChange({})}
                className="mt-2 text-blue-400 hover:text-blue-300 underline"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          animations.map((anim, index) => {
            const isAnnotated = annotatedPaths.has(anim.path);
            const isCurrent = index === currentIndex;

            return (
              <button
                key={anim.path}
                ref={isCurrent ? currentItemRef : undefined}
                onClick={() => onSelect(index)}
                role="option"
                aria-selected={isCurrent}
                aria-label={`${anim.filename}${isAnnotated ? ' (annotated)' : ''}`}
                className={`w-full text-left px-3 py-2 text-sm border-b border-gray-700/50 transition-colors ${
                  isCurrent
                    ? 'bg-blue-600 text-white'
                    : isAnnotated
                      ? 'bg-gray-700/50 text-gray-300 hover:bg-gray-700'
                      : 'text-gray-400 hover:bg-gray-700/50'
                }`}
              >
                <div className="flex items-center gap-2">
                  {isAnnotated && (
                    <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                  )}
                  <span className="truncate">{anim.filename}</span>
                </div>
                {anim.category && (
                  <p className="text-xs text-gray-500 truncate mt-0.5">{anim.category}</p>
                )}
              </button>
            );
          })
        )}
      </div>

      {/* Count */}
      <div className="p-2 border-t border-gray-700 text-xs text-gray-500 text-center">
        {animations.length} animations
      </div>
    </div>
  );
}
