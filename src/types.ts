/**
 * API-aligned types. These mirror the JSON shapes returned by the backend
 * (server/src/types.ts) so the UI and the API speak the same language.
 */

export type VersionStatus =
  | 'draft'
  | 'pending_approval'
  | 'published'
  | 'superseded'
  | 'rejected';

export type UserRole = 'author' | 'approver' | 'viewer' | 'admin';

export type ApprovalDecision = 'approved' | 'rejected';

export type AvatarColor = 'navy' | 'teal' | 'orange' | 'pink' | 'purple';

export interface Department {
  id: string;
  name: string;
}

export interface ApiUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  departmentId: string | null;
  createdAt: string;
}

/** Admin view of a user: adds the resolved department name (GET /api/users). */
export interface AdminUser extends ApiUser {
  departmentName: string | null;
}

export type DiagramNodeKind = 'start' | 'task' | 'decision' | 'end';

export type DiagramSlot =
  | 'start'
  | 'task-one'
  | 'decision'
  | 'task-two'
  | 'task-three'
  | 'end';

export interface DiagramNode {
  id: string;
  kind: DiagramNodeKind;
  label: string;
  slot: DiagramSlot;
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
  changedByName: string;
  changeSummary: string;
  createdAt: string;
}

export interface ApprovalRecord {
  id: string;
  sopVersionId: string;
  approverId: string;
  approverName: string;
  decision: ApprovalDecision;
  comment: string | null;
  decidedAt: string;
}

export interface SopListItem {
  id: string;
  title: string;
  departmentId: string;
  departmentName: string;
  publishedVersion: { id: string; versionNumber: number } | null;
  latestVersion: {
    id: string;
    versionNumber: number;
    status: VersionStatus;
    changeSummary: string | null;
    updatedAt: string;
  } | null;
}

export interface SopDetailResponse {
  sop: Sop & { departmentName: string; ownerName: string };
  versions: SopVersion[];
  changeLog: ChangeLogEntry[];
  approvals: ApprovalRecord[];
}

export interface SearchResult {
  versionId: string;
  sopId: string;
  title: string;
  departmentId: string;
  departmentName: string;
  versionNumber: number;
  status: VersionStatus;
  bodyExcerpt: string;
  updatedAt: string;
}

export interface PendingApprovalItem {
  versionId: string;
  sopId: string;
  title: string;
  departmentId: string;
  departmentName: string;
  versionNumber: number;
  changeSummary: string | null;
  submittedById: string;
  submittedByName: string;
  submittedAt: string;
}

export interface DecidedApprovalItem {
  id: string;
  versionId: string;
  sopId: string;
  title: string;
  departmentId: string;
  departmentName: string;
  versionNumber: number;
  decision: ApprovalDecision;
  comment: string | null;
  approverId: string;
  approverName: string;
  decidedAt: string;
}

export interface HistoryItem {
  versionId: string;
  sopId: string;
  sopTitle: string;
  departmentId: string;
  departmentName: string;
  versionNumber: number;
  status: VersionStatus;
  changeSummary: string | null;
  createdBy: string;
  createdByName: string;
  createdAt: string;
}

export interface LoginResponse {
  token: string;
  user: ApiUser;
}

export interface CreatedSopResponse {
  sop: Sop;
  draft: SopVersion;
}

export interface DecisionResponse {
  decision: ApprovalDecision;
  approval: ApprovalRecord;
  version: SopVersion;
}
