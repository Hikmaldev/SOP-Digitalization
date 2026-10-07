import { Router } from 'express';
import { z } from 'zod';
import { parse } from '../lib/validate';
import { actorFrom, requireAuth } from '../middleware/auth';
import { listVersionHistory } from '../services/history.service';
import type { VersionStatus } from '../types';

export const historyRouter = Router();
historyRouter.use(requireAuth);

const statusSchema = z.enum(['draft', 'pending_approval', 'published', 'superseded', 'rejected']);

const historyQuerySchema = z.object({
  q: z.string().max(200).optional(),
  status: statusSchema.optional(),
  department: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

/** FR-VER-02/03: the global version history / audit trail feed. */
historyRouter.get('/', async (req, res) => {
  const queryParams = parse(historyQuerySchema, req.query);
  res.json(
    await listVersionHistory({
      actor: actorFrom(req),
      q: queryParams.q,
      status: queryParams.status as VersionStatus | undefined,
      departmentId: queryParams.department,
      limit: queryParams.limit,
      offset: queryParams.offset,
    }),
  );
});
