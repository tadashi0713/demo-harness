import type { NextFunction, Request, Response } from 'express';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { config } from '../config';
import { unauthorized } from '../lib/http-error';

export type AuthUser = { id: string; email: string };

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function signToken(user: AuthUser): string {
  return jwt.sign({ sub: user.id, email: user.email }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  } as SignOptions);
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    next(unauthorized());
    return;
  }

  try {
    const payload = jwt.verify(header.slice('Bearer '.length), config.jwtSecret);
    if (typeof payload === 'string' || !payload.sub) {
      next(unauthorized('トークンが不正です'));
      return;
    }
    req.user = { id: String(payload.sub), email: String(payload.email ?? '') };
    next();
  } catch {
    next(unauthorized('トークンが無効または期限切れです'));
  }
}

/** requireAuth を通過した後に呼ぶ。ユーザーが取れない場合は例外。 */
export function currentUser(req: Request): AuthUser {
  if (!req.user) throw unauthorized();
  return req.user;
}
