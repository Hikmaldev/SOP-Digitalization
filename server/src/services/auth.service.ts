import { createHash, randomBytes } from 'node:crypto';
import { config } from '../config';
import { query, queryOne } from '../db';
import { UnauthorizedError, ValidationError } from '../lib/errors';
import { signAccessToken } from '../lib/jwt';
import { mapUser, type UserRow } from '../lib/mappers';
import { hashPassword, verifyPassword } from '../lib/password';

async function findUserByEmail(email: string): Promise<UserRow | null> {
  return queryOne<UserRow>('SELECT * FROM users WHERE lower(email) = lower($1)', [email]);
}

async function findUserById(id: string): Promise<UserRow | null> {
  return queryOne<UserRow>('SELECT * FROM users WHERE id = $1', [id]);
}

export async function login(email: string, password: string) {
  const user = await findUserByEmail(email);
  // Same generic error for unknown email and wrong password.
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const token = await signAccessToken({
    sub: user.id,
    role: user.role,
    departmentId: user.department_id,
    name: user.full_name,
    email: user.email,
  });

  return { token, user: mapUser(user) };
}

export async function getMe(userId: string) {
  const user = await findUserById(userId);
  if (!user) throw new UnauthorizedError();
  return mapUser(user);
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export interface PasswordResetRequestResult {
  message: string;
  /** Present only when EXPOSE_RESET_TOKEN=true (development convenience). */
  resetToken?: string;
  resetUrl?: string;
}

/**
 * FR-AUTH-04. Always responds with the same message so the endpoint cannot
 * be used to probe which emails exist. In production an email provider would
 * send the link; the token itself is stored hashed, single-use, 1h TTL.
 */
export async function requestPasswordReset(email: string): Promise<PasswordResetRequestResult> {
  const generic: PasswordResetRequestResult = {
    message: 'If that email address exists, a password reset link has been sent.',
  };

  const user = await findUserByEmail(email);
  if (!user) return generic;

  const token = randomBytes(32).toString('hex');
  await query(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, now() + interval '1 hour')`,
    [user.id, hashToken(token)],
  );

  const resetUrl = `${config.corsOrigin}/reset-password?token=${token}`;
  console.log(`[auth] Password reset requested for ${email}. Reset link: ${resetUrl}`);

  if (!config.exposeResetToken) return generic;
  return { ...generic, resetToken: token, resetUrl };
}

export async function confirmPasswordReset(token: string, newPassword: string): Promise<void> {
  const row = await queryOne<{ id: string; user_id: string }>(
    `SELECT id, user_id FROM password_reset_tokens
     WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()`,
    [hashToken(token)],
  );
  if (!row) throw new ValidationError('This reset link is invalid or has expired');

  const passwordHash = await hashPassword(newPassword);
  await query('UPDATE users SET password_hash = $2 WHERE id = $1', [row.user_id, passwordHash]);
  await query('UPDATE password_reset_tokens SET used_at = now() WHERE id = $1', [row.id]);
}
