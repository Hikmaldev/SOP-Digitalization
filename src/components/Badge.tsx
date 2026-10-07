import { STATUS_CLASS, STATUS_LABEL } from '../lib/display';
import type { VersionStatus } from '../types';

/** Colored status badge. Always rendered in the same visual position
 *  so a reader never wonders which state a version is in (design doc §9). */
export function StatusBadge({ status }: { status: VersionStatus }) {
  return <span className={`status ${STATUS_CLASS[status]}`}>{STATUS_LABEL[status]}</span>;
}

interface VersionBadgeProps {
  status: VersionStatus;
  version: string;
}

export function VersionBadge({ status, version }: VersionBadgeProps) {
  return (
    <span className="version-badge">
      <i aria-hidden="true" />
      {STATUS_LABEL[status]} · {version}
    </span>
  );
}
