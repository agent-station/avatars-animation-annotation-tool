import { useEffect, useRef, useState } from 'react';
import { AvatarClient } from '@agent-station/avatar-web';
import type { AvatarSDKError, ResolvedAvatar } from '@agent-station/avatar-types';

interface AvatarViewerProps {
  animationPath: string | null;
  onAnimationLoaded?: () => void;
  onAnimationCompleted?: () => void;
  onError?: (error: string) => void;
}

const CDN_BASE_URL = 'https://avatars.staging.agsn.ai';
const DEFAULT_AVATAR_ID = 'avatar-2025-0001';

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

  // Initialize avatar client
  useEffect(() => {
    if (!containerRef.current) return;

    const client = new AvatarClient({
      container: containerRef.current,
      cdnBaseUrl: CDN_BASE_URL,
      onReady: () => {
        console.log('Avatar SDK ready');
      },
      onProgress: (progress: number, message?: string) => {
        setLoadingMessage(message ?? `Loading... ${progress}%`);
      },
      onError: (error: AvatarSDKError) => {
        console.error('Avatar SDK error:', error);
        onError?.(error.message);
      },
      onAvatarLoaded: (_avatar: ResolvedAvatar) => {
        setIsReady(true);
        setIsLoading(false);
        console.log('Avatar loaded');
      },
      onAnimationStarted: (animationId: string, animationName: string) => {
        console.log('Animation started:', animationId, animationName);
        onAnimationLoaded?.();
      },
      onAnimationCompleted: (animationId: string) => {
        console.log('Animation completed:', animationId);
        onAnimationCompleted?.();
      },
    });

    clientRef.current = client;

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
        console.error('Failed to initialize avatar:', err);
        onError?.(err.message);
        setIsLoading(false);
      });

    return () => {
      client.destroy();
      clientRef.current = null;
    };
  }, [onError, onAnimationLoaded, onAnimationCompleted]);

  // Load animation when path changes
  useEffect(() => {
    if (!isReady || !animationPath || !clientRef.current) return;

    const loadAnimation = async () => {
      try {
        // Construct the full URL for the animation
        const animationUrl = `/animations/${animationPath}`;
        const animationId = animationPath.replace(/[/\\]/g, '-').replace('.vrma', '');

        await clientRef.current!.loadAnimationFromUrl({
          url: animationUrl,
          animationId,
          animationName: animationPath,
          loop: true,
          autoPlay: true,
          transitionMs: 300,
        });
      } catch (err) {
        console.error('Failed to load animation:', err);
        onError?.(`Failed to load animation: ${err}`);
      }
    };

    loadAnimation();
  }, [isReady, animationPath, onError]);

  return (
    <div className="relative w-full h-full bg-gray-900 rounded-lg overflow-hidden">
      <div ref={containerRef} className="w-full h-full" />

      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-gray-300 text-sm">{loadingMessage}</p>
          </div>
        </div>
      )}
    </div>
  );
}
