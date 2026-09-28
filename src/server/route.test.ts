import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { conflict } from './http-error';
import { errorResponse, readJson, route } from './route';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('errorResponse', () => {
  it('ZodError を 400 の validation_error に変換する', async () => {
    const parsed = z.object({ amount: z.number() }).safeParse({ amount: 'x' });
    const res = errorResponse(parsed.error);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('validation_error');
    expect(body.error.details).toEqual([{ path: 'amount', message: expect.any(String) }]);
  });

  it('HttpError のステータスとコードをそのまま返す', async () => {
    const res = errorResponse(conflict('残高が不足しています', 'insufficient_funds'));

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: { code: 'insufficient_funds', message: '残高が不足しています' },
    });
  });

  it('想定外のエラーは詳細を伏せて 500 を返す', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = errorResponse(new Error('connection refused'));

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe('internal_error');
    expect(JSON.stringify(body)).not.toContain('connection refused');
  });
});

describe('route', () => {
  const req = new NextRequest('http://localhost/api/test');

  it('params を解決してハンドラーに渡す', async () => {
    const handler = route<{ id: string }>(async (_req, params) => Response.json(params));
    const res = await handler(req, { params: Promise.resolve({ id: 'abc' }) });

    expect(await res.json()).toEqual({ id: 'abc' });
  });

  it('ハンドラーの例外をエラー JSON に変換する', async () => {
    const handler = route(async () => {
      throw conflict('競合しました');
    });
    const res = await handler(req, { params: Promise.resolve({}) });

    expect(res.status).toBe(409);
  });
});

describe('readJson', () => {
  it('JSON ボディをパースする', async () => {
    const req = new NextRequest('http://localhost/api/test', { method: 'POST', body: '{"amount":100}' });
    expect(await readJson(req)).toEqual({ amount: 100 });
  });

  it('JSON でなければ 400 invalid_json', async () => {
    const req = new NextRequest('http://localhost/api/test', { method: 'POST', body: 'not json' });
    await expect(readJson(req)).rejects.toMatchObject({ status: 400, code: 'invalid_json' });
  });
});
