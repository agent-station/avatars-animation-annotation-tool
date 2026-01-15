export interface AvatarConfig {
  id: string;
  name: string;
}

export const AVAILABLE_AVATARS: AvatarConfig[] = [
  { id: 'avatar-2026-0001', name: 'Avatar 2026-1' },
  { id: 'avatar-2026-0002', name: 'Avatar 2026-2' },
  { id: 'avatar-2025-0001', name: 'Girl 1' },
  { id: 'avatar-2025-0002', name: 'Girl 2' },
  { id: 'avatar-2025-0003', name: 'Girl 3' },
  { id: 'avatar-2025-0004', name: 'Girl 4' },
  { id: 'avatar-2025-0005', name: 'Girl 5' },
];

export const DEFAULT_AVATAR_ID = 'avatar-2026-0001';

export const CDN_BASE_URL = 'https://avatars.staging.agsn.ai';
export const CDN_ANIMATIONS_BASE = 'https://avatars.staging.agsn.ai/animation-candidates';
