import { Outlet } from 'react-router';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

/** Pathless layout route that wraps every screen with the shared chrome. */
export function AppLayout() {
  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-content">
        <Topbar />
        <Outlet />
      </main>
    </div>
  );
}