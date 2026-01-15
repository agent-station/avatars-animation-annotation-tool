import { useEffect } from 'react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SHORTCUT_GROUPS = [
  {
    title: 'Quality Rating',
    shortcuts: [
      { key: '1', description: 'Approved' },
      { key: '2', description: 'Rejected' },
      { key: '3', description: 'Maybe' },
      { key: '0', description: 'Clear annotation' },
    ],
  },
  {
    title: 'Character',
    shortcuts: [
      { key: 'S', description: 'Sarang' },
      { key: 'Y', description: 'Yeona' },
      { key: 'O', description: 'Other' },
      { key: 'N', description: 'None' },
    ],
  },
  {
    title: 'Action Tags',
    shortcuts: [
      { key: 'I', description: 'Toggle Idle' },
      { key: 'G', description: 'Toggle Greeting' },
      { key: 'R', description: 'Toggle Reaction' },
      { key: 'C', description: 'Toggle Conversation' },
      { key: 'L', description: 'Toggle Locomotion' },
      { key: 'X', description: 'Toggle Combat' },
    ],
  },
  {
    title: 'Navigation',
    shortcuts: [
      { key: 'Enter', description: 'Next animation' },
      { key: '→', description: 'Next animation' },
      { key: '←', description: 'Previous animation' },
      { key: 'Space', description: 'Replay animation' },
      { key: 'P', description: 'Pause/Play' },
    ],
  },
  {
    title: 'Avatar',
    shortcuts: [
      { key: '[', description: 'Previous avatar' },
      { key: ']', description: 'Next avatar' },
    ],
  },
  {
    title: 'General',
    shortcuts: [
      { key: '?', description: 'Toggle this help' },
      { key: 'Ctrl+Z', description: 'Undo' },
      { key: 'Ctrl+Shift+Z', description: 'Redo' },
    ],
  },
];

export function KeyboardShortcutsModal({ isOpen, onClose }: KeyboardShortcutsModalProps) {
  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === '?') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={onClose}
    >
      <div
        className="bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white">Keyboard Shortcuts</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
            aria-label="Close"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.title}>
              <h3 className="text-sm font-medium text-gray-400 mb-3">{group.title}</h3>
              <div className="space-y-2">
                {group.shortcuts.map((shortcut) => (
                  <div key={shortcut.key} className="flex items-center gap-3">
                    <kbd className="min-w-[2.5rem] px-2 py-1 text-sm font-mono bg-gray-700 text-gray-200 rounded text-center">
                      {shortcut.key}
                    </kbd>
                    <span className="text-gray-300">{shortcut.description}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 pt-4 border-t border-gray-700 text-center">
          <p className="text-sm text-gray-500">
            Press <kbd className="px-1.5 py-0.5 bg-gray-700 text-gray-300 rounded text-xs">?</kbd> or{' '}
            <kbd className="px-1.5 py-0.5 bg-gray-700 text-gray-300 rounded text-xs">Esc</kbd> to close
          </p>
        </div>
      </div>
    </div>
  );
}
