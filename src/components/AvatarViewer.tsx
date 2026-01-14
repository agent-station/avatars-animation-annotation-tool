import { useEffect, useRef, useState, useCallback } from 'react';
import { AvatarClient } from '@agent-station/avatar-web';
import type { AvatarSDKError } from '@agent-station/avatar-types';

interface AvatarViewerProps {
  animationPath: string | null;
  onAnimationLoaded?: () => void;
  onAnimationCompleted?: () => void;
  onError?: (error: string) => void;
}

const SPEED_OPTIONS = [
  { value: 0.25, label: '0.25x' },
  { value: 0.5, label: '0.5x' },
  { value: 1, label: '1x' },
  { value: 1.5, label: '1.5x' },
  { value: 2, label: '2x' },
];

const CDN_BASE_URL = 'https://avatars.staging.agsn.ai';
const CDN_ANIMATIONS_BASE = 'https://avatars.staging.agsn.ai/animation-candidates';
const DEFAULT_AVATAR_ID = 'avatar-2025-0001';

// Module-level tracking to handle React StrictMode double-mounting
const activeClients = new WeakMap<HTMLElement, AvatarClient>();
const pendingCleanups = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();
const avatarLoadedState = new WeakMap<HTMLElement, boolean>();

export function AvatarViewer({
  animationPath,
  onAnimationLoaded,
  onAnimationCompleted,
  onError,
}: AvatarViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const clientRef = useRef<AvatarClient | null>(null);
  const [isAvatarLoaded, setIsAvatarLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState('Initializing...');
  const [isAnimationLoading, setIsAnimationLoading] = useState(false);
  const [animationLoadingPath, setAnimationLoadingPath] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  // Use refs for callbacks to avoid recreating the client when callbacks change
  const callbacksRef = useRef({ onError, onAnimationLoaded, onAnimationCompleted });
  // Ref for internal state setters so they can be called from reused clients
  const setIsAvatarLoadedRef = useRef(setIsAvatarLoaded);
  const setIsAnimationLoadingRef = useRef(setIsAnimationLoading);

  // Update ref when callbacks change - avoids recreating client while keeping callbacks fresh
  useEffect(() => {
    callbacksRef.current = { onError, onAnimationLoaded, onAnimationCompleted };
    setIsAvatarLoadedRef.current = setIsAvatarLoaded;
    setIsAnimationLoadingRef.current = setIsAnimationLoading;
  }, [onError, onAnimationLoaded, onAnimationCompleted]);

  // Stable error handler for use in effects
  const handleError = useCallback((message: string) => {
    callbacksRef.current.onError?.(message);
  }, []);

  // Playback control handlers
  const togglePause = useCallback(() => {
    if (!clientRef.current) return;
    const newPaused = !isPaused;
    setIsPaused(newPaused);
    try {
      if (newPaused) {
        clientRef.current.pauseAnimation?.();
      } else {
        clientRef.current.resumeAnimation?.();
      }
    } catch {
      // SDK may not support these methods
    }
  }, [isPaused]);

  const handleSpeedChange = useCallback((speed: number) => {
    if (!clientRef.current) return;
    setPlaybackSpeed(speed);
    try {
      clientRef.current.setAnimationSpeed?.(speed);
    } catch {
      // SDK may not support this method
    }
  }, []);

  // Keyboard shortcut for pause (P key)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.key.toLowerCase() === 'p') {
        e.preventDefault();
        togglePause();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePause]);

  // Initialize avatar client - only on mount
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Cancel any pending cleanup for this container (StrictMode remount)
    const pendingCleanup = pendingCleanups.get(container);
    if (pendingCleanup) {
      clearTimeout(pendingCleanup);
      pendingCleanups.delete(container);
    }

    // Reuse existing client if available (StrictMode remount)
    const existingClient = activeClients.get(container);
    if (existingClient) {
      clientRef.current = existingClient;
      // Only set isAvatarLoaded if avatar was actually loaded
      if (avatarLoadedState.get(container)) {
        setIsAvatarLoaded(true);
        setIsLoading(false);
      }
      return;
    }

    const client = new AvatarClient({
      container,
      cdnBaseUrl: CDN_BASE_URL,
      onProgress: (progress: number, message?: string) => {
        setLoadingMessage(message ?? `Loading... ${progress}%`);
      },
      onError: (error: AvatarSDKError) => {
        callbacksRef.current.onError?.(error.message);
      },
      onAvatarLoaded: () => {
        // Avatar model loaded - hide loading spinner and mark as ready for animations
        avatarLoadedState.set(container, true);
        setIsLoading(false);
        setIsAvatarLoadedRef.current(true);
      },
      onAnimationStarted: () => {
        setIsAnimationLoadingRef.current(false);
        callbacksRef.current.onAnimationLoaded?.();
      },
      onAnimationCompleted: () => {
        callbacksRef.current.onAnimationCompleted?.();
      },
    });

    clientRef.current = client;
    activeClients.set(container, client);

    // Initialize and load avatar
    client
      .initialize()
      .then(() => client.loadAvatar(DEFAULT_AVATAR_ID))
      .then(() => {
        // Set camera to full body view
        client.setCameraPreset('full-body', 500);
        client.setOrbitControlsEnabled(true);
      })
      .catch((err: Error) => {
        callbacksRef.current.onError?.(err.message);
        setIsLoading(false);
      });

    return () => {
      // Delay cleanup to allow StrictMode remount to cancel it
      const cleanupTimeout = setTimeout(() => {
        client.destroy();
        activeClients.delete(container);
        pendingCleanups.delete(container);
        avatarLoadedState.delete(container);
      }, 100);
      pendingCleanups.set(container, cleanupTimeout);
      clientRef.current = null;
    };
  }, []); // Empty deps - client only created once

  // Load animation when path changes - must wait for avatar to be loaded
  useEffect(() => {
    if (!isAvatarLoaded || !animationPath || !clientRef.current) return;

    const loadAnimation = async () => {
      const animationUrl = `${CDN_ANIMATIONS_BASE}/${animationPath}`;
      const animationId = animationPath.replace(/[/\\]/g, '-').replace('.vrma', '');

      // Show loading indicator
      setIsAnimationLoading(true);
      setAnimationLoadingPath(animationPath);

      try {
        await clientRef.current!.loadAnimationFromUrl({
          url: animationUrl,
          animationId,
          animationName: animationPath,
          loop: true,
          autoPlay: true,
          transitionMs: 300,
        });
      } catch (err) {
        setIsAnimationLoading(false);
        handleError(`Failed to load animation: ${err}`);
      }
    };

    loadAnimation();
  }, [isAvatarLoaded, animationPath, handleError]);

  // Extract filename from path for display
  const displayName = animationLoadingPath
    ? animationLoadingPath.split('/').pop()?.replace('.vrma', '') ?? animationLoadingPath
    : '';

  return (
    <div className="relative w-full h-full bg-gray-900 rounded-lg overflow-hidden">
      <div ref={containerRef} className="w-full h-full" />

      {/* Initial SDK/avatar loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-gray-300 text-sm">{loadingMessage}</p>
          </div>
        </div>
      )}

      {/* Animation loading indicator - shown at bottom when loading new animation */}
      {!isLoading && isAnimationLoading && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 bg-gray-800/90 rounded-lg px-4 py-2 flex items-center gap-3 shadow-lg">
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-gray-200 text-sm">Loading {displayName}...</span>
        </div>
      )}

      {/* Playback controls - shown when avatar is loaded */}
      {!isLoading && isAvatarLoaded && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-gray-800/90 rounded-lg px-3 py-2 flex items-center gap-3 shadow-lg">
          {/* Play/Pause button */}
          <button
            onClick={togglePause}
            className="p-1.5 text-white hover:bg-gray-700 rounded transition-colors"
            title={isPaused ? 'Play (P)' : 'Pause (P)'}
            aria-label={isPaused ? 'Play animation' : 'Pause animation'}
          >
            {isPaused ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            )}
          </button>

          {/* Speed selector */}
          <div className="flex items-center gap-1">
            <span className="text-gray-400 text-xs">Speed:</span>
            <select
              value={playbackSpeed}
              onChange={(e) => handleSpeedChange(Number(e.target.value))}
              className="bg-gray-700 text-white text-xs rounded px-2 py-1 border-none outline-none"
              aria-label="Playback speed"
            >
              {SPEED_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
