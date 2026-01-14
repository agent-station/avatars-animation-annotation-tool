import { useEffect, useRef, useState, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { AnimationEntry } from '../types';
import type { AnimationFilter } from '../hooks/useAnimationList';
import { useSyncStatus, type SyncStatus } from '../hooks/useSyncStatus';

// Debounce hook for search input
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

// Sync status indicator component
function SyncStatusIcon({ status }: { status: SyncStatus }) {
  if (status === 'synced') return null;

  const config = {
    pending: {
      color: 'text-yellow-400',
      title: 'Pending sync',
      icon: (
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
          <circle cx="10" cy="10" r="6" />
        </svg>
      ),
    },
    syncing: {
      color: 'text-blue-400',
      title: 'Syncing...',
      icon: (
        <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      ),
    },
    failed: {
      color: 'text-red-400',
      title: 'Sync failed',
      icon: (
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
      ),
    },
  };

  const { color, title, icon } = config[status];

  return (
    <span className={`flex-shrink-0 ${color}`} title={title}>
      {icon}
    </span>
  );
}

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

const ITEM_HEIGHT = 52; // Approximate height of each list item

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
  const parentRef = useRef<HTMLDivElement>(null);
  const [searchInput, setSearchInput] = useState(filter.searchQuery ?? '');
  const debouncedSearch = useDebounce(searchInput, 300);
  const { getStatus, isApiEnabled } = useSyncStatus();

  // Update filter when debounced search changes
  useEffect(() => {
    // Normalize both to handle '' vs undefined comparison
    const normalizedSearch = debouncedSearch || undefined;
    if (normalizedSearch !== filter.searchQuery) {
      onFilterChange({ ...filter, searchQuery: normalizedSearch });
    }
  }, [debouncedSearch, filter, onFilterChange]);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchInput(e.target.value);
  }, []);

  const handleClearSearch = useCallback(() => {
    setSearchInput('');
  }, []);

  const virtualizer = useVirtualizer({
    count: animations.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ITEM_HEIGHT,
    overscan: 10,
  });

  // Scroll current item into view when index changes
  useEffect(() => {
    if (currentIndex >= 0 && currentIndex < animations.length) {
      virtualizer.scrollToIndex(currentIndex, { align: 'auto', behavior: 'smooth' });
    }
  }, [currentIndex, animations.length, virtualizer]);

  return (
    <div className="flex flex-col h-full bg-gray-800 rounded-lg overflow-hidden">
      {/* Search and Filters */}
      <div className="p-3 border-b border-gray-700 space-y-2">
        {/* Search Input */}
        <div className="relative">
          <input
            type="text"
            value={searchInput}
            onChange={handleSearchChange}
            placeholder="Search animations..."
            className="w-full bg-gray-700 text-white text-sm rounded px-3 py-1.5 pr-8 placeholder-gray-500"
            aria-label="Search animations by name"
          />
          {searchInput && (
            <button
              onClick={handleClearSearch}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              aria-label="Clear search"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

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

        {/* Quality filter chips */}
        <div className="flex gap-1 flex-wrap">
          {[
            { value: 'all' as const, label: 'All', color: 'gray' as const },
            { value: 'approved' as const, label: 'Approved', color: 'green' as const },
            { value: 'rejected' as const, label: 'Rejected', color: 'red' as const },
            { value: 'maybe' as const, label: 'Maybe', color: 'yellow' as const },
          ].map((option) => {
            const isActive = (filter.qualityFilter ?? 'all') === option.value;
            const colorClasses = {
              gray: isActive ? 'bg-gray-600 text-white' : 'bg-gray-700/50 text-gray-400',
              green: isActive ? 'bg-green-600 text-white' : 'bg-gray-700/50 text-gray-400',
              red: isActive ? 'bg-red-600 text-white' : 'bg-gray-700/50 text-gray-400',
              yellow: isActive ? 'bg-yellow-600 text-white' : 'bg-gray-700/50 text-gray-400',
            };
            return (
              <button
                key={option.value}
                onClick={() =>
                  onFilterChange({
                    ...filter,
                    qualityFilter: option.value === 'all' ? undefined : option.value,
                  })
                }
                className={`px-2 py-0.5 text-xs rounded transition-colors ${colorClasses[option.color]}`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Virtualized List */}
      <div
        ref={parentRef}
        className="flex-1 overflow-y-auto"
        role="listbox"
        aria-label="Animation list"
      >
        {animations.length === 0 ? (
          <div className="p-4 text-center text-gray-500 text-sm">
            <p>No animations match the current filters</p>
            {(filter.pack || filter.category || filter.unannotatedOnly || filter.searchQuery) && (
              <button
                onClick={() => {
                  setSearchInput('');
                  onFilterChange({});
                }}
                className="mt-2 text-blue-400 hover:text-blue-300 underline"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {virtualizer.getVirtualItems().map((virtualItem) => {
              const anim = animations[virtualItem.index];
              const isAnnotated = annotatedPaths.has(anim.path);
              const isCurrent = virtualItem.index === currentIndex;
              const syncStatus = isApiEnabled ? getStatus(anim.path) : 'synced';

              return (
                <button
                  key={anim.path}
                  onClick={() => onSelect(virtualItem.index)}
                  role="option"
                  aria-selected={isCurrent}
                  aria-label={`${anim.filename}${isAnnotated ? ' (annotated)' : ''}`}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${virtualItem.size}px`,
                    transform: `translateY(${virtualItem.start}px)`,
                  }}
                  className={`text-left px-3 py-2 text-sm border-b border-gray-700/50 transition-colors ${
                    isAnnotated ? 'border-l-3 border-l-green-500' : 'border-l-3 border-l-transparent'
                  } ${
                    isCurrent
                      ? 'bg-blue-600 text-white'
                      : isAnnotated
                        ? 'bg-gray-700/50 text-gray-300 hover:bg-gray-700'
                        : 'text-gray-400 hover:bg-gray-700/50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {isAnnotated && (
                      <span className="w-3 h-3 rounded-full bg-green-500 flex-shrink-0 flex items-center justify-center">
                        <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </span>
                    )}
                    <span className="truncate flex-1">{anim.filename}</span>
                    <SyncStatusIcon status={syncStatus} />
                  </div>
                  {anim.category && (
                    <p className="text-xs text-gray-500 truncate mt-0.5">{anim.category}</p>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Count */}
      <div className="p-2 border-t border-gray-700 text-xs text-gray-500 text-center">
        {animations.length} animations
      </div>
    </div>
  );
}
