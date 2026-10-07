import type { PoolClient } from 'pg';
import { InvalidTransitionError, NotFoundError, ValidationError } from '../lib/errors';
import type { SopVersionRow } from '../lib/mappers';
import type { VersionStatus } from '../types';

/**
 * The state machine nobody gets to skip (design doc §5).
 *
 *   draft ──submit──> pending_approval ──approve──> published
 *                            │
 *                            └──reject──> rejected ──revise──> draft (new row)
 *
 * `published` can later become `superseded`, but only when a newer version
 * of the same SOP is approved. There is no `published -> draft` edge.
 *
 * Every status change in the whole app goes through `transitionVersion()`.
 * Nothing else writes to the `status` column directly.
 */
export const ALLOWED_TRANSITIONS: Record<VersionStatus, readonly VersionStatus[]> = {
  draft: ['pending_approval'],
  pending_approval: ['published', 'rejected'],
  published: ['superseded'],
  superseded: [],
  rejected: [],
};

export function assertTransitionAllowed(from: VersionStatus, to: VersionStatus): void {
  if (!ALLOWED_TRANSITIONS[from].includes(to)) {
    throw new InvalidTransitionError(from, to);
  }
}

export async function lockVersion(client: PoolClient, versionId: string): Promise<SopVersionRow> {
  const { rows } = await client.query<SopVersionRow>(
    'SELECT * FROM sop_versions WHERE id = $1 FOR UPDATE',
    [versionId],
  );
  const version = rows[0];
  if (!version) throw new NotFoundError('Version');
  return version;
}

async function nextVersionNumber(client: PoolClient, sopId: string): Promise<number> {
  const { rows } = await client.query<{ next: number }>(
    'SELECT coalesce(max(version_number), 0) + 1 AS next FROM sop_versions WHERE sop_id = $1',
    [sopId],
  );
  return rows[0].next;
}

/**
 * Move a version to a new status. This is the only writer of `status` —
 * a deliberate chokepoint so new rules only ever need one change site.
 * Must be called inside a transaction (it locks the row FOR UPDATE).
 */
export async function transitionVersion(
  client: PoolClient,
  versionId: string,
  to: VersionStatus,
  actorId: string,
  changeSummary: string,
): Promise<SopVersionRow> {
  const version = await lockVersion(client, versionId);
  assertTransitionAllowed(version.status, to);

  const { rows } = await client.query<SopVersionRow>(
    'UPDATE sop_versions SET status = $2 WHERE id = $1 RETURNING *',
    [versionId, to],
  );

  await client.query(
    `INSERT INTO version_change_log (sop_version_id, changed_by, change_summary)
     VALUES ($1, $2, $3)`,
    [versionId, actorId, changeSummary],
  );

  return rows[0];
}

export interface CreateDraftParams {
  sopId: string;
  actorId: string;
  changeSummary: string;
  /** Revise a specific version (e.g. a rejected draft). */
  sourceVersionId?: string | null;
  /** Overrides for a brand-new SOP with content supplied up front. */
  bodyContent?: string | null;
  diagramData?: unknown | null;
  diagramFileUrl?: string | null;
  annotationText?: string | null;
}

/**
 * Create a new draft version (FR-VER-01). Content is copied from the source
 * version (explicit source, or the current published version) — the original
 * row is never modified. For a brand-new SOP there is no source.
 */
export async function createDraftVersion(
  client: PoolClient,
  params: CreateDraftParams,
): Promise<SopVersionRow> {
  let source: SopVersionRow | null = null;

  if (params.sourceVersionId) {
    source = await lockVersion(client, params.sourceVersionId);
    if (source.sop_id !== params.sopId) {
      throw new ValidationError('The source version belongs to a different SOP');
    }
  } else {
    const { rows } = await client.query<SopVersionRow>(
      `SELECT * FROM sop_versions WHERE sop_id = $1 AND status = 'published' LIMIT 1`,
      [params.sopId],
    );
    source = rows[0] ?? null;
  }

  const versionNumber = await nextVersionNumber(client, params.sopId);

  // JSON null vs SQL null matters: a JSONB 'null' is not SQL NULL.
  const diagramValue =
    params.diagramData !== undefined ? params.diagramData : (source?.diagram_data ?? null);

  const { rows } = await client.query<SopVersionRow>(
    `INSERT INTO sop_versions
       (sop_id, version_number, status, body_content, diagram_data, diagram_file_url,
        annotation_text, change_summary, created_by)
     VALUES ($1, $2, 'draft', $3, $4::jsonb, $5, $6, $7, $8)
     RETURNING *`,
    [
      params.sopId,
      versionNumber,
      params.bodyContent ?? source?.body_content ?? null,
      diagramValue === null ? null : JSON.stringify(diagramValue),
      params.diagramFileUrl ?? source?.diagram_file_url ?? null,
      params.annotationText ?? source?.annotation_text ?? null,
      params.changeSummary,
      params.actorId,
    ],
  );

  const version = rows[0];
  await client.query(
    `INSERT INTO version_change_log (sop_version_id, changed_by, change_summary)
     VALUES ($1, $2, $3)`,
    [version.id, params.actorId, `Created draft v${versionNumber}: ${params.changeSummary}`],
  );

  return version;
}

export interface UpdateDraftParams {
  versionId: string;
  actorId: string;
  bodyContent?: string | null;
  diagramData?: unknown | null;
  diagramFileUrl?: string | null;
  annotationText?: string | null;
  changeSummary?: string;
}

/** Edit a draft in place. Only drafts are editable; everything else is immutable. */
export async function updateDraftVersion(
  client: PoolClient,
  params: UpdateDraftParams,
): Promise<SopVersionRow> {
  const version = await lockVersion(client, params.versionId);
  if (version.status !== 'draft') {
    throw new InvalidTransitionError(
      version.status,
      'draft',
      `Only draft versions can be edited (current status: "${version.status}")`,
    );
  }

  const { rows } = await client.query<SopVersionRow>(
    `UPDATE sop_versions SET
       body_content = COALESCE($2, body_content),
       diagram_data = COALESCE($3::jsonb, diagram_data),
       diagram_file_url = COALESCE($4, diagram_file_url),
       annotation_text = COALESCE($5, annotation_text),
       change_summary = COALESCE($6, change_summary)
     WHERE id = $1
     RETURNING *`,
    [
      params.versionId,
      params.bodyContent ?? null,
      params.diagramData !== undefined && params.diagramData !== null ? JSON.stringify(params.diagramData) : null,
      params.diagramFileUrl ?? null,
      params.annotationText ?? null,
      params.changeSummary ?? null,
    ],
  );

  await client.query(
    `INSERT INTO version_change_log (sop_version_id, changed_by, change_summary)
     VALUES ($1, $2, $3)`,
    [params.versionId, params.actorId, params.changeSummary ?? 'Updated draft content'],
  );

  return rows[0];
}

/**
 * FR-SOP-05: a version can only be submitted when the SOP has at least a
 * title, a department, and either diagram content or body content.
 */
export async function submitVersionForApproval(
  client: PoolClient,
  versionId: string,
  actorId: string,
  expectedSopId?: string,
): Promise<SopVersionRow> {
  const version = await lockVersion(client, versionId);
  if (expectedSopId && version.sop_id !== expectedSopId) {
    throw new NotFoundError('Version');
  }

  const { rows } = await client.query<{ title: string; department_id: string | null }>(
    'SELECT title, department_id FROM sops WHERE id = $1',
    [version.sop_id],
  );
  const sop = rows[0];
  if (!sop) throw new NotFoundError('SOP');

  if (!sop.title.trim()) {
    throw new ValidationError('The SOP needs a title before it can be submitted');
  }
  if (!sop.department_id) {
    throw new ValidationError('The SOP needs a department before it can be submitted');
  }
  const hasContent =
    Boolean(version.body_content?.trim()) ||
    version.diagram_data != null ||
    Boolean(version.diagram_file_url);
  if (!hasContent) {
    throw new ValidationError(
      'The SOP needs either body content or a diagram before it can be submitted',
    );
  }

  return transitionVersion(client, versionId, 'pending_approval', actorId, 'Submitted for approval');
}
