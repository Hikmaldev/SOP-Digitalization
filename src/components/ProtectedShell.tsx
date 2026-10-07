import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from '../context/auth-context';
import { WorkspaceProvider } from '../context/WorkspaceProvider';

/**
 * Auth gate for every workspace screen: shows a splash while the session is
 * restored, redirects to /login when signed out, and provides workspace-wide
 * reference data (departments, approval count) to the pages below.
 */
export function ProtectedShell() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="splash">Loading your workspace…</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }

  return (
    <WorkspaceProvider>
      <Outlet />
    </WorkspaceProvider>
  );
}
