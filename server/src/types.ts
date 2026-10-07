/** Shared API types. Mirrors the frontend's src/types.ts where practical. */

export type VersionStatus =
  | 'draft'
  | 'pending_approval'
  | 'published'
  | 'superseded'
  | 'rejected';

export type UserRole = 'author' | 'approver' | 'viewer' | 'admin';

export type ApprovalDecision = 'approved' | 'rejected';

export interface Department {
  id: string;
  name: string;
}

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  departmentId: string | null;
  createdAt: string;
}

/** The authenticated caller, derived from the JWT. */
export interface Actor {
  id: string;
  role: UserRole;
  departmentId: string | null;
}

export interface Sop {
  id: string;
  departmentId: string;
  title: string;
  currentPublishedVersionId: string | null;
  createdBy: string;
  createdAt: string;
}

export interface SopVersion {
  id: string;
  sopId: string;
  versionNumber: number;
  status: VersionStatus;
  bodyContent: string | null;
  diagramData: unknown | null;
  diagramFileUrl: string | null;
  annotationText: string | null;
  changeSummary: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChangeLogEntry {
  id: string;
  sopVersionId: string;
  changedBy: string;
  changeSummary: string;
  createdAt: string;
}

export interface ApprovalRecord {
  id: string;
  sopVersionId: string;
  approverId: string;
  decision: ApprovalDecision;
  comment: string | null;
  decidedAt: string;
}
