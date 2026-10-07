import { query } from '../db';
import type { Actor, VersionStatus } from '../types';

export interface HistoryParams {
  actor: Actor;
  q?: string;
  status?: VersionStatus;
  departmentId?: string;
  limit: number;
  offset: number;
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

interface HistoryRow {
  version_id: string;
  sop_id: string;
  sop_title: string;
  department_id: string;
  department_name: string;
  version_number: number;
  status: VersionStatus;
  change_summary: string | null;
  created_by: string;
  created_by_name: string;
  created_at: Date;
}

/**
 * Flattened audit trail across every SOP (FR-VER-02/03, the Version History
 * screen). Viewers only see published/superseded versions.
 */
export async function listVersionHistory(params: HistoryParams): Promise<HistoryItem[]> {
  const needle = params.q?.trim() ?? '';
  const viewerOnly = params.actor.role === 'viewer';

  const rows = await query<HistoryRow>(
    `SELECT v.id AS version_id, s.id AS sop_id, s.title AS sop_title,
            s.department_id, d.name AS department_name,
            v.version_number, v.status, v.change_summary,
            v.created_by, u.full_name AS created_by_name, v.created_at
     FROM sop_versions v
     JOIN sops s ON s.id = v.sop_id
     JOIN departments d ON d.id = s.department_id
     JOIN users u ON u.id = v.created_by
     WHERE ($1::uuid IS NULL OR s.department_id = $1)
       AND ($2::text IS NULL OR v.status = $2)
       AND ($3::boolean = false OR v.status IN ('published', 'superseded'))
       AND (
         $4::text = ''
         OR s.title ILIKE '%' || $4 || '%'
         OR v.change_summary ILIKE '%' || $4 || '%'
       )
     ORDER BY v.created_at DESC
     LIMIT $5 OFFSET $6`,
    [
      params.departmentId ?? null,
      params.status ?? null,
      viewerOnly,
      needle,
      params.limit,
      params.offset,
    ],
  );

  return rows.map((row) => ({
    versionId: row.version_id,
    sopId: row.sop_id,
    sopTitle: row.sop_title,
    departmentId: row.department_id,
    departmentName: row.department_name,
    versionNumber: row.version_number,
    status: row.status,
    changeSummary: row.change_summary,
    createdBy: row.created_by,
    createdByName: row.created_by_name,
    createdAt: row.created_at.toISOString(),
  }));
}
