import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { parse } from '../lib/validate';
import { actorFrom, requireAuth } from '../middleware/auth';
import {
  confirmPasswordReset,
  getMe,
  login,
  requestPasswordReset,
} from '../services/auth.service';

export const authRouter = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: { code: 'rate_limited', message: 'Too many login attempts. Try again later.' },
  },
});

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1, 'Password is required'),
});

/** FR-AUTH-01: email + password login, JWT issued by the API. */
authRouter.post('/login', loginLimiter, async (req, res) => {
  const body = parse(loginSchema, req.body);
  res.json(await login(body.email, body.password));
});

authRouter.get('/me', requireAuth, async (req, res) => {
  res.json(await getMe(actorFrom(req).id));
});

const resetRequestSchema = z.object({ email: z.email() });

/** FR-AUTH-04: request a password reset link (email provider TBD). */
authRouter.post('/password-reset/request', async (req, res) => {
  const body = parse(resetRequestSchema, req.body);
  res.json(await requestPasswordReset(body.email));
});

const resetConfirmSchema = z.object({
  token: z.string().min(10),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

authRouter.post('/password-reset/confirm', async (req, res) => {
  const body = parse(resetConfirmSchema, req.body);
  await confirmPasswordReset(body.token, body.newPassword);
  res.json({ message: 'Password updated. You can now sign in.' });
});
