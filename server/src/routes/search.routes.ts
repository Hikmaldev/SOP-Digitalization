import { Router } from 'express';
import { z } from 'zod';
import { booleanParam, parse } from '../lib/validate';
import { actorFrom, requireAuth } from '../middleware/auth';
import { searchSops } from '../services/search.service';

export const searchRouter = Router();
searchRouter.use(requireAuth);

const searchQuerySchema = z.object({
  q: z.string().max(200).optional(),
  department: z.uuid().optional(),
  includeDrafts: booleanParam,
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

/** FR-SRCH-01..05. Published-only by default; drafts optional per role. */
searchRouter.get('/', async (req, res) => {
  const queryParams = parse(searchQuerySchema, req.query);

  res.json(
    await searchSops({
      actor: actorFrom(req),
      q: queryParams.q,
      departmentId: queryParams.department,
      includeDrafts: queryParams.includeDrafts,
      limit: queryParams.limit,
      offset: queryParams.offset,
    }),
  );
});
