import { createBrowserRouter } from 'react-router';
import { AdminGuard } from './components/AdminGuard';
import { AppLayout } from './components/layout/AppLayout';
import { ProtectedShell } from './components/ProtectedShell';
import { ApprovalQueuePage } from './pages/ApprovalQueuePage';
import { DepartmentsPage } from './pages/DepartmentsPage';
import { DiagramEditorPage } from './pages/DiagramEditorPage';
import { DraftEditorPage } from './pages/DraftEditorPage';
import { LoginPage } from './pages/LoginPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { OverviewPage } from './pages/OverviewPage';
import { PeoplePage } from './pages/PeoplePage';
import { SearchPage } from './pages/SearchPage';
import { SopDetailPage } from './pages/SopDetailPage';
import { VersionHistoryPage } from './pages/VersionHistoryPage';

/**
 * Route table. /login is public; everything else sits behind ProtectedShell
 * (session restore + redirect) and the shared AppLayout chrome.
 */
export const router = createBrowserRouter([
  { path: '/login', Component: LoginPage },
  {
    Component: ProtectedShell,
    children: [
      {
        path: '/',
        Component: AppLayout,
        children: [
          { index: true, Component: OverviewPage },
          { path: 'search', Component: SearchPage },
          { path: 'sops/new', Component: DraftEditorPage },
          { path: 'sops/:sopId', Component: SopDetailPage },
          { path: 'sops/:sopId/edit', Component: DraftEditorPage },
          { path: 'sops/:sopId/diagram', Component: DiagramEditorPage },
          { path: 'approvals', Component: ApprovalQueuePage },
          { path: 'history', Component: VersionHistoryPage },
          {
            path: 'departments',
            element: (
              <AdminGuard>
                <DepartmentsPage />
              </AdminGuard>
            ),
          },
          {
            path: 'people',
            element: (
              <AdminGuard>
                <PeoplePage />
              </AdminGuard>
            ),
          },
          { path: '*', Component: NotFoundPage },
        ],
      },
    ],
  },
]);
