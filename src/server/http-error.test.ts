import { describe, expect, it } from 'vitest';
import { badRequest, conflict, forbidden, HttpError, notFound, unauthorized } from './http-error';

describe('HttpError ヘルパー', () => {
  it.each([
    [badRequest('不正'), 400, 'bad_request', '不正'],
    [unauthorized(), 401, 'unauthorized', '認証が必要です'],
    [forbidden(), 403, 'forbidden', 'この操作は許可されていません'],
    [notFound(), 404, 'not_found', 'リソースが見つかりません'],
    [conflict('競合'), 409, 'conflict', '競合'],
  ])('ステータス・コード・メッセージを設定する (%#)', (error, status, code, message) => {
    expect(error).toBeInstanceOf(HttpError);
    expect(error).toBeInstanceOf(Error);
    expect(error.status).toBe(status);
    expect(error.code).toBe(code);
    expect(error.message).toBe(message);
  });

  it('コードを上書きできる', () => {
    expect(badRequest('金額不正', 'invalid_amount').code).toBe('invalid_amount');
    expect(conflict('残高不足', 'insufficient_funds').code).toBe('insufficient_funds');
  });
});
