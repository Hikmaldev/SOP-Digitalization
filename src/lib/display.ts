import type { AvatarColor, UserRole, VersionStatus } from '../types';

/* --------------------------- status presentation -------------------------- */

export const STATUS_LABEL: Record<VersionStatus, string> = {
  draft: 'Draft',
  pending_approval: 'Pending review',
  published: 'Published',
  superseded: 'Superseded',
  rejected: 'Rejected',
};

export const STATUS_CLASS: Record<VersionStatus, string> = {
  draft: 'draft',
  pending_approval: 'pending',
  published: 'published',
  superseded: 'superseded',
  rejected: 'rejected',
};

export const ROLE_LABEL: Record<UserRole, string> = {
  author: 'SOP author',
  approver: 'Approver',
  viewer: 'Viewer',
  admin: 'Administrator',
};

/* ------------------------------ presentation ------------------------------ */

export function versionLabel(versionNumber: number): string {
  return `v${versionNumber}`;
}

export function initialsOf(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  const first = parts[0]?.charAt(0) ?? '?';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.charAt(0) ?? '') : '';
  return `${first}${last}`.toUpperCase();
}

const AVATAR_COLORS: AvatarColor[] = ['navy', 'teal', 'orange', 'pink', 'purple'];

export function colorForUser(id: string): AvatarColor {
  let sum = 0;
  for (const char of id) sum += char.charCodeAt(0);
  return AVATAR_COLORS[sum % AVATAR_COLORS.length];
}

const TONES = ['green', 'blue', 'orange', 'purple'] as const;
export type Tone = (typeof TONES)[number];

export function toneFor(id: string): Tone {
  let sum = 0;
  for (const char of id) sum += char.charCodeAt(0);
  return TONES[sum % TONES.length];
}

export const TONE_GLYPH: Record<Tone, string> = {
  green: '↗',
  blue: '⌁',
  orange: '◒',
  purple: '▤',
};

/* --------------------------------- time ---------------------------------- */

export function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '—';

  const diffMinutes = Math.round((Date.now() - then) / 60_000);
  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes} min ago`;

  const hours = Math.round(diffMinutes / 60);
  if (hours < 24) return `${hours} h ago`;

  const days = Math.round(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 14) return `${days} days ago`;

  return formatDate(iso);
}

export function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/* ------------------------------ body content ------------------------------ */

export function splitLines(content: string | null | undefined): string[] {
  if (!content) return [];
  return content.split('\n').map((line) => line.trimEnd());
}
