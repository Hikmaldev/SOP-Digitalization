import { Router } from 'express';
import { z } from 'zod';
import { parse } from '../lib/validate';
import { actorFrom, requireAuth, requireRole } from '../middleware/auth';
import {
  decideOnVersion,
  listDecidedApprovals,
  listPendingApprovals,
} from '../services/approval.service';

export const approvalsRouter = Router();
approvalsRouter.use(requireAuth, requireRole('approver'));

/** FR-APR-02: the review queue for the approver's department. */
approvalsRouter.get('/', async (req, res) => {
  res.json(await listPendingApprovals(actorFrom(req)));
});

/** Recently decided drafts (the "Recently decided" tab). */
approvalsRouter.get('/decided', async (req, res) => {
  const { limit } = parse(
    z.object({ limit: z.coerce.number().int().min(1).max(100).default(20) }),
    req.query,
  );
  res.json(await listDecidedApprovals(actorFrom(req), limit));
});

const decisionSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  comment: z.string().max(2_000).nullish(),
});

/** FR-APR-03..06: approve publishes atomically; reject requires a comment. */
approvalsRouter.post('/:versionId/decision', async (req, res) => {
  const { versionId } = parse(z.object({ versionId: z.uuid() }), req.params);
  const body = parse(decisionSchema, req.body);

  res.json(
    await decideOnVersion({
      actor: actorFrom(req),
      versionId,
      decision: body.decision,
      comment: body.comment ?? null,
    }),
  );
});
