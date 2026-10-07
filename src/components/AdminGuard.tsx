import type { ReactNode } from 'react';
import { useAuth } from '../context/auth-context';
import { EmptyPanel } from './StatePanels';

/**
 * Role gate for the management screens (Departments, People & roles).
 * Admin users see the page; everyone else gets a clear notice instead of a
 * dead link — and the sidebar hides these entries entirely for non-admins.
 */
export function AdminGuard({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  if (user?.role !== 'admin') {
    return (
      <div className="page-wrap">
        <div className="screen-title">
          <div>
            <p className="eyebrow">MANAGE · RESTRICTED</p>
            <h1>Administrator access only</h1>
            <p>Departments and people management are limited to admin users.</p>
          </div>
        </div>
        <EmptyPanel>You need the admin role to view this section.</EmptyPanel>
      </div>
    );
  }

  return children;
}