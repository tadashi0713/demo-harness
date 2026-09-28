import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { requireAuth, signToken } from './auth';
import { config } from './config';
import { HttpError } from './http-error';

const user = { id: 'user-1', email: 'user@example.com' };

function requestWith(authorization?: string): NextRequest {
  const headers = authorization ? { authorization } : undefined;
  return new NextRequest('http://localhost/api/auth/me', { headers });
}

function authError(fn: () => unknown): HttpError {
  try {
    fn();
  } catch (error) {
    if (error instanceof HttpError) return error;
    throw error;
  }
  throw new Error('例外が発生しませんでした');
}

describe('signToken / requireAuth', () => {
  it('発行したトークンでユーザーを復元できる', () => {
    const token = signToken(user);
    expect(requireAuth(requestWith(`Bearer ${token}`))).toEqual(user);
  });

  it('トークンに有効期限を設定する', () => {
    const payload = jwt.decode(signToken(user)) as jwt.JwtPayload;
    expect(payload.sub).toBe(user.id);
    expect(payload.exp).toBeGreaterThan(payload.iat!);
  });

  it('Authorization ヘッダーがなければ 401', () => {
    const error = authError(() => requireAuth(requestWith()));
    expect(error.status).toBe(401);
    expect(error.message).toBe('認証が必要です');
  });

  it('Bearer 以外のスキームは 401', () => {
    const error = authError(() => requireAuth(requestWith(`Basic ${signToken(user)}`)));
    expect(error.status).toBe(401);
  });

  it('別の鍵で署名されたトークンは 401', () => {
    const forged = jwt.sign({ sub: user.id, email: user.email }, 'other-secret');
    const error = authError(() => requireAuth(requestWith(`Bearer ${forged}`)));
    expect(error.status).toBe(401);
    expect(error.message).toBe('トークンが無効または期限切れです');
  });

  it('期限切れのトークンは 401', () => {
    const expired = jwt.sign({ sub: user.id, email: user.email, exp: Math.floor(Date.now() / 1000) - 60 }, config.jwtSecret);
    const error = authError(() => requireAuth(requestWith(`Bearer ${expired}`)));
    expect(error.message).toBe('トークンが無効または期限切れです');
  });

  it('sub を含まないトークンは 401', () => {
    const noSub = jwt.sign({ email: user.email }, config.jwtSecret);
    const error = authError(() => requireAuth(requestWith(`Bearer ${noSub}`)));
    expect(error.message).toBe('トークンが不正です');
  });
});
