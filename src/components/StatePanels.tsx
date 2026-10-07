import type { ReactNode } from 'react';

export function LoadingPanel({ label = 'Loading…' }: { label?: string }) {
  return <div className="detail-card state-panel">{label}</div>;
}

interface ErrorPanelProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorPanel({ message, onRetry }: ErrorPanelProps) {
  return (
    <div className="detail-card state-panel">
      <p style={{ margin: 0 }}>{message}</p>
      {onRetry && (
        <button className="button button-secondary" type="button" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyPanel({ children }: { children: ReactNode }) {
  return <div className="detail-card state-panel">{children}</div>;
}
