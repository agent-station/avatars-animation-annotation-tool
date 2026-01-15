import { useEffect, useRef, useState, useCallback } from 'react';
import { AvatarClient } from '@agent-station/avatar-web';
import type { AvatarSDKError } from '@agent-station/avatar-types';
import { CDN_BASE_URL, CDN_ANIMATIONS_BASE, DEFAULT_AVATAR_ID } from '../config/avatars';

// Parse SDK error messages into user-friendly text
function parseErrorMessage(error: string): string {
  if (error.includes('INVALID_ANIMATION')) {
    if (error.includes('zero or negative duration')) {
      return 'This animation file has no duration data and cannot be played.';
    }
    return 'This animation file is invalid or corrupted.';
  }
  if (error.includes('NetworkError') || error.includes('Failed to fetch')) {
    return 'Could not download the animation file. Check your internet connection.';
  }
  if (error.includes('404') || error.includes('Not Found')) {
    return 'Animation file not found on the server.';
  }
  // Fallback: truncate if too long
  const maxLength = 100;
  return error.length > maxLength ? error.slice(0, maxLength) + '...' : error;
}

interface AvatarViewerProps {
  animationPath: string | null;
  isPaused: boolean;
  avatarId?: string;
  onAnimationLoaded?: () => void;
  onAnimationCompleted?: () => void;
  onError?: (error: string) => void;
}

// Module-level tracking to handle React StrictMode double-mounting
const activeClients = new WeakMap<HTMLElement, AvatarClient>();
const pendingCleanups = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();
const avatarLoadedState = new WeakMap<HTMLElement, boolean>();

export function AvatarViewer({
  animationPath,
  isPaused,
  avatarId = DEFAULT_AVATAR_ID,
  onAnimationLoaded,
  onAnimationCompleted,
  onError,
}: AvatarViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const clientRef = useRef<AvatarClient | null>(null);
  const loadedAvatarRef = useRef<string | null>(null);
  const [isAvatarLoaded, setIsAvatarLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState('Initializing...');
  const [isAnimationLoading, setIsAnimationLoading] = useState(false);
  const [animationLoadingPath, setAnimationLoadingPath] = useState<string | null>(null);
  const [isAvatarSwitching, setIsAvatarSwitching] = useState(false);
  const [animationError, setAnimationError] = useState<string | null>(null);

  // Clear error when animation path changes
  useEffect(() => {
    setAnimationError(null);
  }, [animationPath]);

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

  // Retry loading the current animation
  const handleRetry = useCallback(() => {
    if (!animationPath || !clientRef.current || !isAvatarLoaded) return;

    setAnimationError(null);
    setIsAnimationLoading(true);
    setAnimationLoadingPath(animationPath);

    const animationUrl = `${CDN_ANIMATIONS_BASE}/${animationPath}`;
    const animationId = animationPath.replace(/[/\\]/g, '-').replace('.vrma', '');

    clientRef.current.loadAnimationFromUrl({
      url: animationUrl,
      animationId,
      animationName: animationPath,
      loop: true,
      autoPlay: true,
      transitionMs: 300,
    }).catch((err) => {
      setIsAnimationLoading(false);
      const errorMessage = `Failed to load animation: ${err}`;
      setAnimationError(errorMessage);
      handleError(errorMessage);
    });
  }, [animationPath, isAvatarLoaded, handleError]);

  // Sync pause state with SDK (uses pauseRendering/resumeRendering as SDK doesn't have animation-specific pause)
  useEffect(() => {
    if (!clientRef.current || !isAvatarLoaded) return;
    try {
      if (isPaused) {
        clientRef.current.pauseRendering();
      } else {
        clientRef.current.resumeRendering();
      }
    } catch {
      // SDK may not support these methods
    }
  }, [isPaused, isAvatarLoaded]);

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
      .then(() => client.loadAvatar(avatarId, { skipAnimations: true }))
      .then(() => {
        loadedAvatarRef.current = avatarId;
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
        const errorMessage = `Failed to load animation: ${err}`;
        setAnimationError(errorMessage);
        handleError(errorMessage);
      }
    };

    loadAnimation();
  }, [isAvatarLoaded, animationPath, handleError]);

  // Switch avatar when avatarId changes (after initial load)
  useEffect(() => {
    if (!isAvatarLoaded || !clientRef.current) return;
    if (loadedAvatarRef.current === avatarId) return; // Already loaded

    const switchAvatar = async () => {
      setIsAvatarSwitching(true);
      const currentAnimPath = animationPath;

      try {
        await clientRef.current!.loadAvatar(avatarId, { skipAnimations: true });
        loadedAvatarRef.current = avatarId;

        // Reload current animation on new avatar
        if (currentAnimPath) {
          const animationUrl = `${CDN_ANIMATIONS_BASE}/${currentAnimPath}`;
          const animationId = currentAnimPath.replace(/[/\\]/g, '-').replace('.vrma', '');
          await clientRef.current!.loadAnimationFromUrl({
            url: animationUrl,
            animationId,
            animationName: currentAnimPath,
            loop: true,
            autoPlay: true,
            transitionMs: 300,
          });
        }
      } catch (err) {
        handleError(`Failed to switch avatar: ${err}`);
      } finally {
        setIsAvatarSwitching(false);
      }
    };

    switchAvatar();
  }, [avatarId, isAvatarLoaded, animationPath, handleError]);

  // Extract filename from path for display
  const displayName = animationLoadingPath
    ? animationLoadingPath.split('/').pop()?.replace('.vrma', '') ?? animationLoadingPath
    : '';

  // Prevent iframe from stealing keyboard focus
  // This ensures keyboard shortcuts continue to work after interacting with the 3D viewer
  // We listen at window level because cross-origin iframe focus events don't bubble
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWindowBlur = () => {
      // When window loses focus (often due to iframe getting focus),
      // check if an iframe inside our container is now focused
      setTimeout(() => {
        const activeEl = document.activeElement;
        if (activeEl?.tagName === 'IFRAME' && container.contains(activeEl)) {
          // Blur the iframe to return focus to main document
          (activeEl as HTMLElement).blur();
          window.focus();
        }
      }, 0);
    };

    window.addEventListener('blur', handleWindowBlur);
    return () => window.removeEventListener('blur', handleWindowBlur);
  }, []);

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

      {/* Animation loading indicator - shown at top-center when loading new animation */}
      {!isLoading && isAnimationLoading && !isAvatarSwitching && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-gray-800/90 backdrop-blur-sm rounded-full px-4 py-2 flex items-center gap-2 shadow-lg">
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-gray-200 text-xs">Loading {displayName}...</span>
        </div>
      )}

      {/* Avatar switching indicator */}
      {!isLoading && isAvatarSwitching && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-gray-800/90 backdrop-blur-sm rounded-full px-4 py-2 flex items-center gap-2 shadow-lg">
          <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-gray-200 text-xs">Switching avatar...</span>
        </div>
      )}

      {/* Animation error indicator */}
      {!isLoading && animationError && !isAnimationLoading && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-900/90 backdrop-blur-sm rounded-lg px-4 py-3 shadow-lg max-w-md">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <div className="flex-1 min-w-0">
              <p className="text-red-200 text-sm font-medium">Failed to load animation</p>
              <p className="text-red-300/80 text-xs mt-1 break-words">{parseErrorMessage(animationError)}</p>
            </div>
            <button
              onClick={handleRetry}
              className="flex-shrink-0 px-2 py-1 bg-red-700 hover:bg-red-600 text-red-100 text-xs rounded transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
