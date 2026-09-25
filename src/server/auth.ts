import jwt, { type SignOptions } from 'jsonwebtoken';
import type { NextRequest } from 'next/server';
import { config } from './config';
import { unauthorized } from './http-error';

export type AuthUser = { id: string; email: string };

export function signToken(user: AuthUser): string {
  return jwt.sign({ sub: user.id, email: user.email }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  } as SignOptions);
}

/** Authorization: Bearer <token> を検証してログイン中のユーザーを返す。 */
export function requireAuth(req: NextRequest): AuthUser {
  const header = req.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) throw unauthorized();

  let payload: string | jwt.JwtPayload;
  try {
    payload = jwt.verify(header.slice('Bearer '.length), config.jwtSecret);
  } catch {
    throw unauthorized('トークンが無効または期限切れです');
  }
  if (typeof payload === 'string' || !payload.sub) throw unauthorized('トークンが不正です');
  return { id: String(payload.sub), email: String(payload.email ?? '') };
}
