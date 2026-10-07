import type { NextFunction, Request, Response } from 'express';
import { ForbiddenError, UnauthorizedError } from '../lib/errors';
import { verifyAccessToken } from '../lib/jwt';
import type { UserRole } from '../types';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: UserRole;
        departmentId: string | null;
        name: string;
        email: string;
      };
    }
  }
}

/** Verify the Bearer token and attach the caller to the request. */
export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    next(new UnauthorizedError());
    return;
  }

  try {
    const payload = await verifyAccessToken(header.slice('Bearer '.length));
    req.user = {
      id: payload.sub,
      role: payload.role,
      departmentId: payload.departmentId,
      name: payload.name,
      email: payload.email,
    };
    next();
  } catch {
    next(new UnauthorizedError('Invalid or expired token'));
  }
}

/** Restrict a route to the given roles. Admin always passes. */
export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const user = req.user;
    if (!user) {
      next(new UnauthorizedError());
      return;
    }
    if (user.role !== 'admin' && !roles.includes(user.role)) {
      next(new ForbiddenError());
      return;
    }
    next();
  };
}

/** Narrow helper for handlers that run after requireAuth. */
export function actorFrom(req: Request) {
  const user = req.user;
  if (!user) throw new UnauthorizedError();
  return { id: user.id, role: user.role, departmentId: user.departmentId };
}
