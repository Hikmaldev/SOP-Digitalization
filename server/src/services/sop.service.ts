import { query, queryOne, withTransaction } from '../db';
import { ForbiddenError, NotFoundError } from '../lib/errors';
import {
  mapApproval,
  mapChangeLog,
  mapSop,
  mapVersion,
  type ApprovalRow,
  type ChangeLogRow,
  type SopRow,
  type SopVersionRow,
} from '../lib/mappers';
import { canEditSop } from '../lib/permissions';
import type { Actor, ApprovalRecord, ChangeLogEntry, Sop, SopVersion, VersionStatus } from '../types';
import { createDraftVersion } from './version.service';

export interface SopListVersionSummary {
  id: string;
  versionNumber: number;
  status: VersionStatus;
  changeSummary: string | null;
  updatedAt: string;
}

export interface SopListItem {
  id: string;
  title: string;
  departmentId: string;
  departmentName: string;
  publishedVersion: { id: string; versionNumber: number } | null;
  latestVersion: SopListVersionSummary | null;
}

export interface ListSopsParams {
  actor: Actor;
  departmentId?: string;
  includeDrafts: boolean;
  limit: number;
  offset: number;
}

interface SopListRow {
  id: string;
  title: string;
  department_id: string;
  department_name: string;
  published_id: string | null;
  published_version_number: number | null;
  published_updated_at: Date | null;
  latest_id: string | null;
  latest_version_number: number | null;
  latest_status: VersionStatus | null;
  latest_change_summary: string | null;
  latest_updated_at: Date | null;
}

export async function listSops(params: ListSopsParams): Promise<SopListItem[]> {
  const includeDrafts = params.includeDrafts && params.actor.role !== 'viewer';
  const draftScope = params.actor.role === 'admin' ? null : params.actor.departmentId;

  const rows = await query<SopListRow>(
    `SELECT
        s.id,
        s.title,
        s.department_id,
        d.name AS department_name,
        pub.id AS published_id,
        pub.version_number AS published_version_number,
        pub.updated_at AS published_updated_at,
        lat.id AS latest_id,
        lat.version_number AS latest_version_number,
        lat.status AS latest_status,
        lat.change_summary AS latest_change_summary,
        lat.updated_at AS latest_updated_at
     FROM sops s
     JOIN departments d ON d.id = s.department_id
     LEFT JOIN sop_versions pub ON pub.id = s.current_published_version_id
     LEFT JOIN LATERAL (
       SELECT v.* FROM sop_versions v
       WHERE v.sop_id = s.id
       ORDER BY v.version_number DESC
       LIMIT 1
     ) lat ON TRUE
     WHERE ($1::uuid IS NULL OR s.department_id = $1)
       AND (pub.id IS NOT NULL OR ($2::boolean AND ($5::uuid IS NULL OR s.department_id = $5)))
     ORDER BY COALESCE(lat.updated_at, s.created_at) DESC
     LIMIT $3 OFFSET $4`,
    [params.departmentId ?? null, includeDrafts, params.limit, params.offset, draftScope],
  );

  // Draft/pending status is only visible to the actor's own department
  // (admins see everything). Everyone else sees the published summary.
  const isAdmin = params.actor.role === 'admin';
  const actorDepartmentId = params.actor.departmentId;

  return rows.map((row) => {
    const latestVisible =
      row.latest_status === 'published' ||
      (includeDrafts && (isAdmin || row.department_id === actorDepartmentId));

    const latestVersion: SopListVersionSummary | null =
      latestVisible && row.latest_id && row.latest_status && row.latest_updated_at
        ? {
            id: row.latest_id,
            versionNumber: row.latest_version_number ?? 0,
            status: row.latest_status,
            changeSummary: row.latest_change_summary,
            updatedAt: row.latest_updated_at.toISOString(),
          }
        : row.published_id && row.published_version_number != null
          ? {
              id: row.published_id,
              versionNumber: row.published_version_number,
              status: 'published',
              changeSummary: null,
              updatedAt: (row.published_updated_at ?? row.latest_updated_at ?? new Date()).toISOString(),
            }
          : null;

    return {
      id: row.id,
      title: row.title,
      departmentId: row.department_id,
      departmentName: row.department_name,
      publishedVersion:
        row.published_id && row.published_version_number != null
          ? { id: row.published_id, versionNumber: row.published_version_number }
          : null,
      latestVersion,
    };
  });
}

export async function getSopScope(sopId: string): Promise<SopRow> {
  const rows = await queryOne<SopRow>('SELECT * FROM sops WHERE id = $1', [sopId]);
  if (!rows) throw new NotFoundError('SOP');
  return rows;
}

export interface CreateSopParams {
  title: string;
  departmentId: string;
  bodyContent?: string | null;
  diagramData?: unknown | null;
  annotationText?: string | null;
  changeSummary?: string;
}

export async function createSop(actor: Actor, params: CreateSopParams) {
  return withTransaction(async (client) => {
    const { rows } = await client.query<SopRow>(
      `INSERT INTO sops (department_id, title, created_by)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [params.departmentId, params.title, actor.id],
    );
    const sop = rows[0];

    const draft = await createDraftVersion(client, {
      sopId: sop.id,
      actorId: actor.id,
      changeSummary: params.changeSummary ?? 'Created SOP draft',
      bodyContent: params.bodyContent ?? null,
      diagramData: params.diagramData ?? null,
      annotationText: params.annotationText ?? null,
    });

    return { sop: mapSop(sop), draft: mapVersion(draft) };
  });
}

export interface UpdateSopParams {
  title?: string;
  departmentId?: string;
}

export async function updateSop(sopId: string, params: UpdateSopParams): Promise<Sop> {
  const row = await queryOne<SopRow>(
    `UPDATE sops SET
       title = COALESCE($2, title),
       department_id = COALESCE($3::uuid, department_id)
     WHERE id = $1
     RETURNING *`,
    [sopId, params.title ?? null, params.departmentId ?? null],
  );
  if (!row) throw new NotFoundError('SOP');
  return mapSop(row);
}

export interface SopDetail {
  sop: Sop & { departmentName: string; ownerName: string };
  versions: SopVersion[];
  changeLog: (ChangeLogEntry & { changedByName: string })[];
  approvals: (ApprovalRecord & { approverName: string })[];
}

/**
 * Full detail for one SOP. Viewers only see published/superseded versions
 * ("View version history: Limited (published only)" — PRD §6).
 */
export async function getSopDetail(actor: Actor, sopId: string): Promise<SopDetail> {
  const sopRow = await queryOne<SopRow & { department_name: string; owner_name: string }>(
    `SELECT s.*, d.name AS department_name, u.full_name AS owner_name
     FROM sops s
     JOIN departments d ON d.id = s.department_id
     JOIN users u ON u.id = s.created_by
     WHERE s.id = $1`,
    [sopId],
  );
  if (!sopRow) throw new NotFoundError('SOP');

  const viewerOnly = actor.role === 'viewer';
  const versions = await query<SopVersionRow>(
    `SELECT * FROM sop_versions
     WHERE sop_id = $1
       AND ($2::boolean = false OR status IN ('published', 'superseded'))
     ORDER BY version_number DESC`,
    [sopId, viewerOnly],
  );

  const versionIds = versions.map((version) => version.id);

  const changeLog = versionIds.length
    ? await query<ChangeLogRow & { changed_by_name: string }>(
        `SELECT cl.*, u.full_name AS changed_by_name
         FROM version_change_log cl
         JOIN users u ON u.id = cl.changed_by
         WHERE cl.sop_version_id = ANY($1::uuid[])
         ORDER BY cl.created_at DESC`,
        [versionIds],
      )
    : [];

  const approvals = versionIds.length
    ? await query<ApprovalRow & { approver_name: string }>(
        `SELECT a.*, u.full_name AS approver_name
         FROM approvals a
         JOIN users u ON u.id = a.approver_id
         WHERE a.sop_version_id = ANY($1::uuid[])
         ORDER BY a.decided_at DESC`,
        [versionIds],
      )
    : [];

  return {
    sop: {
      ...mapSop(sopRow),
      departmentName: sopRow.department_name,
      ownerName: sopRow.owner_name,
    },
    versions: versions.map(mapVersion),
    changeLog: changeLog.map((row) => ({ ...mapChangeLog(row), changedByName: row.changed_by_name })),
    approvals: approvals.map((row) => ({ ...mapApproval(row), approverName: row.approver_name })),
  };
}

/** Author/approver guard used by every edit endpoint. */
export function assertCanEdit(actor: Actor, sop: SopRow): void {
  if (!canEditSop(actor, { departmentId: sop.department_id, createdBy: sop.created_by })) {
    throw new ForbiddenError('You can only edit SOPs in your own department');
  }
}
