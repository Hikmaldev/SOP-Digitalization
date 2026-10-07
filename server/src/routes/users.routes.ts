import { Router } from 'express';
import { z } from 'zod';
import { parse } from '../lib/validate';
import { requireAuth, requireRole } from '../middleware/auth';
import { listUsers, updateUser } from '../services/user.service';

export const usersRouter = Router();

/** User management is admin-only (FR-AUTH-03, PRD §6). */
usersRouter.use(requireAuth, requireRole('admin'));

usersRouter.get('/', async (_req, res) => {
  res.json(await listUsers());
});

const updateUserSchema = z
  .object({
    role: z.enum(['author', 'approver', 'viewer', 'admin']).optional(),
    departmentId: z.uuid().optional(),
  })
  .refine((value) => value.role !== undefined || value.departmentId !== undefined, {
    message: 'Provide at least one field to update',
  });

usersRouter.patch('/:userId', async (req, res) => {
  const { userId } = parse(z.object({ userId: z.uuid() }), req.params);
  const body = parse(updateUserSchema, req.body);
  res.json(await updateUser(userId, body));
});
