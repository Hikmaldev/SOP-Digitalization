import type {
  ApprovalRecord,
  ChangeLogEntry,
  Sop,
  SopVersion,
  User,
  UserRole,
  VersionStatus,
} from '../types';

/* Row shapes as they come back from Postgres, and mappers to API types. */

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  full_name: string;
  role: UserRole;
  department_id: string | null;
  created_at: Date;
}

export function mapUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: row.role,
    departmentId: row.department_id,
    createdAt: row.created_at.toISOString(),
  };
}

export interface SopRow {
  id: string;
  department_id: string;
  title: string;
  current_published_version_id: string | null;
  created_by: string;
  created_at: Date;
}

export function mapSop(row: SopRow): Sop {
  return {
    id: row.id,
    departmentId: row.department_id,
    title: row.title,
    currentPublishedVersionId: row.current_published_version_id,
    createdBy: row.created_by,
    createdAt: row.created_at.toISOString(),
  };
}

export interface SopVersionRow {
  id: string;
  sop_id: string;
  version_number: number;
  status: VersionStatus;
  body_content: string | null;
  diagram_data: unknown | null;
  diagram_file_url: string | null;
  annotation_text: string | null;
  change_summary: string | null;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

export function mapVersion(row: SopVersionRow): SopVersion {
  return {
    id: row.id,
    sopId: row.sop_id,
    versionNumber: row.version_number,
    status: row.status,
    bodyContent: row.body_content,
    diagramData: row.diagram_data,
    diagramFileUrl: row.diagram_file_url,
    annotationText: row.annotation_text,
    changeSummary: row.change_summary,
    createdBy: row.created_by,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export interface ChangeLogRow {
  id: string;
  sop_version_id: string;
  changed_by: string;
  change_summary: string;
  created_at: Date;
}

export function mapChangeLog(row: ChangeLogRow): ChangeLogEntry {
  return {
    id: row.id,
    sopVersionId: row.sop_version_id,
    changedBy: row.changed_by,
    changeSummary: row.change_summary,
    createdAt: row.created_at.toISOString(),
  };
}

export interface ApprovalRow {
  id: string;
  sop_version_id: string;
  approver_id: string;
  decision: ApprovalRecord['decision'];
  comment: string | null;
  decided_at: Date;
}

export function mapApproval(row: ApprovalRow): ApprovalRecord {
  return {
    id: row.id,
    sopVersionId: row.sop_version_id,
    approverId: row.approver_id,
    decision: row.decision,
    comment: row.comment,
    decidedAt: row.decided_at.toISOString(),
  };
}
