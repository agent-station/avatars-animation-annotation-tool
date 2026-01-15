import { AVAILABLE_AVATARS } from '../config/avatars';

interface AvatarSelectorProps {
  selectedAvatarId: string;
  onAvatarChange: (avatarId: string) => void;
}

export function AvatarSelector({ selectedAvatarId, onAvatarChange }: AvatarSelectorProps) {
  return (
    <select
      value={selectedAvatarId}
      onChange={(e) => onAvatarChange(e.target.value)}
      className="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 rounded transition-colors border-none outline-none cursor-pointer"
      title="Select avatar ([ / ] to cycle)"
    >
      {AVAILABLE_AVATARS.map((avatar) => (
        <option key={avatar.id} value={avatar.id}>
          {avatar.name}
        </option>
      ))}
    </select>
  );
}
