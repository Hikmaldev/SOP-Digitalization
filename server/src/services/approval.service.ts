import type { PoolClient } from 'pg';
import { query, withTransaction } from '../db';
import { ForbiddenError, InvalidTransitionError, NotFoundError, ValidationError } from '../lib/errors';
import { mapApproval, mapVersion, type ApprovalRow, type SopRow } from '../lib/mappers';
import { canApproveSop } from '../lib/permissions';
import type { Actor, ApprovalDecision } from '../types';
import { lockVersion, transitionVersion } from './version.service';

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

interface PendingApprovalRow {
  version_id: string;
  sop_id: string;
  title: string;
  department_id: string;
  department_name: string;
  version_number: number;
  change_summary: string | null;
  submitted_by_id: string;
  submitted_by_name: string;
  submitted_at: Date;
}

/** FR-APR-02: the approver's review queue, scoped to their department. */
export async function listPendingApprovals(actor: Actor): Promise<PendingApprovalItem[]> {
  const departmentScope = actor.role === 'admin' ? null : actor.departmentId;

  const rows = await query<PendingApprovalRow>(
    `SELECT v.id AS version_id, s.id AS sop_id, s.title,
            s.department_id, d.name AS department_name,
            v.version_number, v.change_summary,
            v.created_by AS submitted_by_id, u.full_name AS submitted_by_name,
            v.created_at AS submitted_at
     FROM sop_versions v
     JOIN sops s ON s.id = v.sop_id
     JOIN departments d ON d.id = s.department_id
     JOIN users u ON u.id = v.created_by
     WHERE v.status = 'pending_approval'
       AND ($1::uuid IS NULL OR s.department_id = $1)
     ORDER BY v.created_at ASC`,
    [departmentScope],
  );

  return rows.map((row) => ({
    versionId: row.version_id,
    sopId: row.sop_id,
    title: row.title,
    departmentId: row.department_id,
    departmentName: row.department_name,
    versionNumber: row.version_number,
    changeSummary: row.change_summary,
    submittedById: row.submitted_by_id,
    submittedByName: row.submitted_by_name,
    submittedAt: row.submitted_at.toISOString(),
  }));
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

interface DecidedApprovalRow {
  version_id: string;
  sop_id: string;
  title: string;
  department_id: string;
  department_name: string;
  version_number: number;
  decision: ApprovalDecision;
  comment: string | null;
  approver_id: string;
  approver_name: string;
  decided_at: Date;
}

/** Recently decided drafts, scoped to the approver's department. */
export async function listDecidedApprovals(
  actor: Actor,
  limit = 20,
): Promise<DecidedApprovalItem[]> {
  const departmentScope = actor.role === 'admin' ? null : actor.departmentId;

  const rows = await query<DecidedApprovalRow>(
    `SELECT v.id AS version_id, s.id AS sop_id, s.title,
            s.department_id, d.name AS department_name,
            v.version_number, a.decision, a.comment,
            a.approver_id, u.full_name AS approver_name, a.decided_at
     FROM approvals a
     JOIN sop_versions v ON v.id = a.sop_version_id
     JOIN sops s ON s.id = v.sop_id
     JOIN departments d ON d.id = s.department_id
     JOIN users u ON u.id = a.approver_id
     WHERE ($1::uuid IS NULL OR s.department_id = $1)
     ORDER BY a.decided_at DESC
     LIMIT $2`,
    [departmentScope, limit],
  );

  return rows.map((row) => ({
    id: row.version_id,
    versionId: row.version_id,
    sopId: row.sop_id,
    title: row.title,
    departmentId: row.department_id,
    departmentName: row.department_name,
    versionNumber: row.version_number,
    decision: row.decision,
    comment: row.comment,
    approverId: row.approver_id,
    approverName: row.approver_name,
    decidedAt: row.decided_at.toISOString(),
  }));
}

export interface DecideParams {
  actor: Actor;
  versionId: string;
  decision: ApprovalDecision;
  comment?: string | null;
}

/**
 * FR-APR-03..06. Mirrors design doc §6: one click, one transaction, four
 * things happen atomically —
 *   1. record the decision,
 *   2. demote whatever was previously published to `superseded`,
 *   3. promote this version to `published` (through the state machine),
 *   4. point the SOP record at the new current version.
 * If any step fails, everything rolls back and readers see no gap.
 */
export async function decideOnVersion(params: DecideParams) {
  const comment = params.comment?.trim() ?? '';
  if (params.decision === 'rejected' && !comment) {
    throw new ValidationError('A comment is required when rejecting a draft');
  }

  return withTransaction(async (client: PoolClient) => {
    const version = await lockVersion(client, params.versionId);

    if (version.status !== 'pending_approval') {
      throw new InvalidTransitionError(
        version.status,
        params.decision === 'approved' ? 'published' : 'rejected',
        'This draft is no longer pending approval. Refresh to see its current state.',
      );
    }

    const { rows: sopRows } = await client.query<SopRow>('SELECT * FROM sops WHERE id = $1', [
      version.sop_id,
    ]);
    const sop = sopRows[0];
    if (!sop) throw new NotFoundError('SOP');

    if (!canApproveSop(params.actor, { departmentId: sop.department_id, createdBy: sop.created_by })) {
      throw new ForbiddenError('Only an approver for this department can decide on this draft');
    }

    // 1. Record the decision.
    const { rows: approvalRows } = await client.query<ApprovalRow>(
      `INSERT INTO approvals (sop_version_id, approver_id, decision, comment)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [params.versionId, params.actor.id, params.decision, comment || null],
    );

    if (params.decision === 'approved') {
      // 2. Demote whatever was previously published.
      await client.query(
        `UPDATE sop_versions SET status = 'superseded'
         WHERE sop_id = $1 AND status = 'published' AND id <> $2`,
        [version.sop_id, params.versionId],
      );

      // 3. Promote the new version through the state machine chokepoint.
      const published = await transitionVersion(
        client,
        params.versionId,
        'published',
        params.actor.id,
        'Approved and published',
      );

      // 4. Point the SOP record at the new current version.
      await client.query('UPDATE sops SET current_published_version_id = $2 WHERE id = $1', [
        version.sop_id,
        params.versionId,
      ]);

      return {
        decision: params.decision,
        approval: mapApproval(approvalRows[0]),
        version: mapVersion(published),
      };
    }

    const rejected = await transitionVersion(
      client,
      params.versionId,
      'rejected',
      params.actor.id,
      `Rejected: ${comment}`,
    );

    return {
      decision: params.decision,
      approval: mapApproval(approvalRows[0]),
      version: mapVersion(rejected),
    };
  });
}
