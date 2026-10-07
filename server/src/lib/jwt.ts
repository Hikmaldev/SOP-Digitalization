import { SignJWT, jwtVerify } from 'jose';
import { config } from '../config';
import type { UserRole } from '../types';

const secret = new TextEncoder().encode(config.jwtSecret);
const ISSUER = 'soply-api';

export interface TokenPayload {
  sub: string;
  role: UserRole;
  departmentId: string | null;
  name: string;
  email: string;
}

export async function signAccessToken(payload: TokenPayload): Promise<string> {
  return new SignJWT({
    role: payload.role,
    departmentId: payload.departmentId,
    name: payload.name,
    email: payload.email,
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setExpirationTime(config.jwtExpiresIn)
    .sign(secret);
}

export async function verifyAccessToken(token: string): Promise<TokenPayload> {
  const { payload } = await jwtVerify(token, secret, { issuer: ISSUER });
  return {
    sub: String(payload.sub),
    role: payload.role as UserRole,
    departmentId: (payload.departmentId as string | null | undefined) ?? null,
    name: String(payload.name ?? ''),
    email: String(payload.email ?? ''),
  };
}
