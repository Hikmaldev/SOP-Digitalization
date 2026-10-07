import type { AvatarColor } from '../types';

const COLOR_CLASS: Record<AvatarColor, string> = {
  navy: 'avatar-navy',
  teal: 'avatar-teal',
  orange: 'avatar-orange',
  pink: 'avatar-pink',
  purple: 'avatar-purple',
};

interface AvatarProps {
  initials: string;
  color: AvatarColor;
}

export function Avatar({ initials, color }: AvatarProps) {
  return <span className={`avatar ${COLOR_CLASS[color]}`}>{initials}</span>;
}