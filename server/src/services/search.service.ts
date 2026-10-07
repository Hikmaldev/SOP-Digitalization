import { query } from '../db';
import { canViewDrafts } from '../lib/permissions';
import type { Actor, VersionStatus } from '../types';

export interface SearchParams {
  actor: Actor;
  q?: string;
  departmentId?: string;
  includeDrafts: boolean;
  limit: number;
  offset: number;
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

interface SearchRow {
  version_id: string;
  sop_id: string;
  title: string;
  department_id: string;
  department_name: string;
  version_number: number;
  status: VersionStatus;
  body_excerpt: string | null;
  updated_at: Date;
}

function mapRow(row: SearchRow): SearchResult {
  return {
    versionId: row.version_id,
    sopId: row.sop_id,
    title: row.title,
    departmentId: row.department_id,
    departmentName: row.department_name,
    versionNumber: row.version_number,
    status: row.status,
    bodyExcerpt: row.body_excerpt ?? '',
    updatedAt: row.updated_at.toISOString(),
  };
}

/**
 * Postgres full-text search (FR-SRCH-01..05, design doc §8).
 * - published versions only, unless the caller may include drafts;
 * - department filter;
 * - ranked with exact title matches first, then ts_rank_cd.
 * Viewers never see drafts, whatever they pass.
 */
export async function searchSops(params: SearchParams): Promise<SearchResult[]> {
  const needle = params.q?.trim() ?? '';
  const includeDrafts = params.includeDrafts && canViewDrafts(params.actor);
  const draftScope = params.actor.role === 'admin' ? null : params.actor.departmentId;

  if (!needle) {
    // Browse mode: newest published versions first.
    const rows = await query<SearchRow>(
      `SELECT v.id AS version_id, s.id AS sop_id, s.title,
              s.department_id, d.name AS department_name,
              v.version_number, v.status,
              left(coalesce(v.body_content, ''), 400) AS body_excerpt,
              v.updated_at
       FROM sop_versions v
       JOIN sops s ON s.id = v.sop_id
       JOIN departments d ON d.id = s.department_id
       WHERE v.status = 'published'
         AND ($1::uuid IS NULL OR s.department_id = $1)
       ORDER BY v.updated_at DESC
       LIMIT $2 OFFSET $3`,
      [params.departmentId ?? null, params.limit, params.offset],
    );
    return rows.map(mapRow);
  }

  const rows = await query<SearchRow>(
    `SELECT v.id AS version_id, s.id AS sop_id, s.title,
            s.department_id, d.name AS department_name,
            v.version_number, v.status,
            left(coalesce(v.body_content, ''), 400) AS body_excerpt,
            v.updated_at
     FROM sop_versions v
     JOIN sops s ON s.id = v.sop_id
     JOIN departments d ON d.id = s.department_id
     CROSS JOIN LATERAL (SELECT websearch_to_tsquery('english', $1) AS query) q
     WHERE v.search_vector @@ q.query
       AND ($2::uuid IS NULL OR s.department_id = $2)
       AND (
         v.status = 'published'
         OR (
           $3::boolean
           AND v.status IN ('draft', 'pending_approval', 'rejected')
           AND ($4::uuid IS NULL OR s.department_id = $4)
         )
       )
     ORDER BY
       (lower(s.title) = lower($1)) DESC,
       ts_rank_cd(v.search_vector, q.query) DESC,
       v.updated_at DESC
     LIMIT $5 OFFSET $6`,
    [needle, params.departmentId ?? null, includeDrafts, draftScope, params.limit, params.offset],
  );

  return rows.map(mapRow);
}
