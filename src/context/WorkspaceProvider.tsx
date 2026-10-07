import { useMemo, type ReactNode } from 'react';
import { listDepartments, pendingApprovals } from '../api/endpoints';
import { useApi } from '../api/hooks';
import { useAuth } from './auth-context';
import { WorkspaceContext, type WorkspaceContextValue } from './workspace-context';

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const canReview = user?.role === 'approver' || user?.role === 'admin';

  const departmentsState = useApi(() => listDepartments(), []);
  const approvalsState = useApi(
    () => (canReview ? pendingApprovals() : Promise.resolve([])),
    [canReview],
  );

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      departments: departmentsState.data ?? [],
      departmentsLoading: departmentsState.status === 'loading',
      approvals: approvalsState.data ?? [],
      refreshApprovals: approvalsState.reload,
    }),
    [departmentsState.data, departmentsState.status, approvalsState.data, approvalsState.reload],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}
