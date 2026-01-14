import { useEffect, useRef, useState, useCallback } from 'react';
import { AvatarClient } from '@agent-station/avatar-web';
import type { AvatarSDKError } from '@agent-station/avatar-types';

interface AvatarViewerProps {
  animationPath: string | null;
  onAnimationLoaded?: () => void;
  onAnimationCompleted?: () => void;
  onError?: (error: string) => void;
}

const CDN_BASE_URL = 'https://avatars.staging.agsn.ai';
const CDN_ANIMATIONS_BASE = 'https://avatars.staging.agsn.ai/animation-candidates';
const DEFAULT_AVATAR_ID = 'avatar-2025-0001';

// Module-level tracking to handle React StrictMode double-mounting
const activeClients = new WeakMap<HTMLElement, AvatarClient>();
const pendingCleanups = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();
const sdkReadyState = new WeakMap<HTMLElement, boolean>();

export function AvatarViewer({
  animationPath,
  onAnimationLoaded,
  onAnimationCompleted,
  onError,
}: AvatarViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const clientRef = useRef<AvatarClient | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState('Initializing...');
  const [isAnimationLoading, setIsAnimationLoading] = useState(false);
  const [animationLoadingPath, setAnimationLoadingPath] = useState<string | null>(null);

  // Use refs for callbacks to avoid recreating the client when callbacks change
  const callbacksRef = useRef({ onError, onAnimationLoaded, onAnimationCompleted });
  // Ref for internal state setters so they can be called from reused clients
  const setIsReadyRef = useRef(setIsReady);
  const setIsAnimationLoadingRef = useRef(setIsAnimationLoading);

  // Update ref when callbacks change - avoids recreating client while keeping callbacks fresh
  useEffect(() => {
    callbacksRef.current = { onError, onAnimationLoaded, onAnimationCompleted };
    setIsReadyRef.current = setIsReady;
    setIsAnimationLoadingRef.current = setIsAnimationLoading;
  }, [onError, onAnimationLoaded, onAnimationCompleted]);

  // Stable error handler for use in effects
  const handleError = useCallback((message: string) => {
    callbacksRef.current.onError?.(message);
  }, []);

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
      // Only set isReady if SDK was actually ready
      if (sdkReadyState.get(container)) {
        setIsReady(true);
      }
      setIsLoading(false);
      return;
    }

    const client = new AvatarClient({
      container,
      cdnBaseUrl: CDN_BASE_URL,
      onReady: () => {
        // Avatar SDK ready - now safe to load animations
        sdkReadyState.set(container, true);
        setIsReadyRef.current(true);
      },
      onProgress: (progress: number, message?: string) => {
        setLoadingMessage(message ?? `Loading... ${progress}%`);
      },
      onError: (error: AvatarSDKError) => {
        callbacksRef.current.onError?.(error.message);
      },
      onAvatarLoaded: () => {
        // Avatar model loaded - hide loading spinner
        setIsLoading(false);
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
        sdkReadyState.delete(container);
      }, 100);
      pendingCleanups.set(container, cleanupTimeout);
      clientRef.current = null;
    };
  }, []); // Empty deps - client only created once

  // Load animation when path changes
  useEffect(() => {
    if (!isReady || !animationPath || !clientRef.current) return;

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
  }, [isReady, animationPath, handleError]);

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
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-gray-800/90 rounded-lg px-4 py-2 flex items-center gap-3 shadow-lg">
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-gray-200 text-sm">Loading {displayName}...</span>
        </div>
      )}
    </div>
  );
}
