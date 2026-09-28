import bcrypt from 'bcryptjs';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { authenticate, getUserById } from './users';

const db = vi.hoisted(() => ({ poolQuery: vi.fn() }));

vi.mock('../db/pool', () => ({
  pool: { query: db.poolQuery },
}));

const createdAt = new Date('2026-01-01T00:00:00Z');
let userRow: Record<string, unknown>;

beforeAll(async () => {
  userRow = {
    id: 'user-1',
    email: 'tadashi.nemoto@harness.io',
    full_name: '根本 征',
    password_hash: await bcrypt.hash('password123', 4),
    created_at: createdAt,
  };
});

beforeEach(() => {
  db.poolQuery.mockReset();
});

describe('authenticate', () => {
  it('正しいパスワードならユーザーを返し、ハッシュは含めない', async () => {
    db.poolQuery.mockResolvedValueOnce({ rows: [userRow] });

    const user = await authenticate('tadashi.nemoto@harness.io', 'password123');

    expect(user).toEqual({
      id: 'user-1',
      email: 'tadashi.nemoto@harness.io',
      fullName: '根本 征',
      createdAt: '2026-01-01T00:00:00.000Z',
    });
  });

  it('メールアドレスを正規化して検索する', async () => {
    db.poolQuery.mockResolvedValueOnce({ rows: [userRow] });
    await authenticate('  Tadashi.Nemoto@Harness.io ', 'password123');
    expect(db.poolQuery.mock.calls[0]![1]).toEqual(['tadashi.nemoto@harness.io']);
  });

  it('パスワード違いとユーザー不在は同じ 401 を返す', async () => {
    db.poolQuery.mockResolvedValueOnce({ rows: [userRow] });
    const wrongPassword = await authenticate('tadashi.nemoto@harness.io', 'wrong').catch((e) => e);

    db.poolQuery.mockResolvedValueOnce({ rows: [] });
    const unknownUser = await authenticate('nobody@example.com', 'password123').catch((e) => e);

    expect(wrongPassword).toMatchObject({ status: 401, message: 'メールアドレスまたはパスワードが違います' });
    expect(unknownUser).toMatchObject({ status: wrongPassword.status, message: wrongPassword.message });
  });
});

describe('getUserById', () => {
  it('ユーザーを返す', async () => {
    db.poolQuery.mockResolvedValueOnce({ rows: [userRow] });
    await expect(getUserById('user-1')).resolves.toMatchObject({ id: 'user-1', fullName: '根本 征' });
  });

  it('存在しなければ null', async () => {
    db.poolQuery.mockResolvedValueOnce({ rows: [] });
    await expect(getUserById('missing')).resolves.toBeNull();
  });
});
