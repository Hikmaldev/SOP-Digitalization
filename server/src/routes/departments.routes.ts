import { Router } from 'express';
import { query } from '../db';
import { requireAuth } from '../middleware/auth';
import type { Department } from '../types';

export const departmentsRouter = Router();

/** Reference data for filters and the draft editor. */
departmentsRouter.get('/', requireAuth, async (_req, res) => {
  const rows = await query<Department>('SELECT id, name FROM departments ORDER BY name ASC');
  res.json(rows);
});
