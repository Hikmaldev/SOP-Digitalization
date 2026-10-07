import { createContext, useContext } from 'react';
import type { Department, PendingApprovalItem } from '../types';

export interface WorkspaceContextValue {
  departments: Department[];
  departmentsLoading: boolean;
  /** Pending approvals for approvers/admins; empty for everyone else. */
  approvals: PendingApprovalItem[];
  refreshApprovals: () => void;
}

export const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function useWorkspace(): WorkspaceContextValue {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error('useWorkspace must be used inside <WorkspaceProvider>');
  return context;
}
