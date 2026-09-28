import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deposit, getAccount, listAccounts, listTransactions, toAccount } from './accounts';

const db = vi.hoisted(() => ({
  poolQuery: vi.fn(),
  clientQuery: vi.fn(),
}));

vi.mock('../db/pool', () => ({
  pool: { query: db.poolQuery },
  withTransaction: (fn: (client: unknown) => Promise<unknown>) => fn({ query: db.clientQuery }),
}));

const ACCOUNT_ID = '11111111-1111-4111-8111-111111111111';
const createdAt = new Date('2026-01-01T00:00:00Z');

const accountRow = (overrides: Record<string, unknown> = {}) => ({
  id: ACCOUNT_ID,
  account_number: '1000-0001',
  name: '総合口座',
  kind: 'checking' as const,
  currency: 'JPY',
  balance: 10000,
  created_at: createdAt,
  ...overrides,
});

beforeEach(() => {
  db.poolQuery.mockReset();
  db.clientQuery.mockReset();
});

describe('toAccount', () => {
  it('DB の行を API の型に変換する', () => {
    expect(toAccount(accountRow({ balance: '2500' as unknown as number }))).toEqual({
      id: ACCOUNT_ID,
      accountNumber: '1000-0001',
      name: '総合口座',
      kind: 'checking',
      currency: 'JPY',
      balance: 2500,
      createdAt: '2026-01-01T00:00:00.000Z',
    });
  });
});

describe('listAccounts', () => {
  it('ユーザーの口座一覧を返す', async () => {
    db.poolQuery.mockResolvedValueOnce({ rows: [accountRow(), accountRow({ id: 'b', kind: 'savings' })] });

    const accounts = await listAccounts('user-1');

    expect(accounts.map((a) => a.kind)).toEqual(['checking', 'savings']);
    expect(db.poolQuery.mock.calls[0]![1]).toEqual(['user-1']);
  });
});

describe('getAccount', () => {
  it('所有している口座を返す', async () => {
    db.poolQuery.mockResolvedValueOnce({ rows: [accountRow()] });
    await expect(getAccount('user-1', ACCOUNT_ID)).resolves.toMatchObject({ id: ACCOUNT_ID });
    expect(db.poolQuery.mock.calls[0]![1]).toEqual([ACCOUNT_ID, 'user-1']);
  });

  it('見つからなければ 404', async () => {
    db.poolQuery.mockResolvedValueOnce({ rows: [] });
    await expect(getAccount('user-1', ACCOUNT_ID)).rejects.toMatchObject({ status: 404 });
  });
});

describe('listTransactions', () => {
  const txRow = {
    id: 'tx-1',
    account_id: ACCOUNT_ID,
    direction: 'debit',
    kind: 'transfer',
    amount: '3000',
    balance_after: '7000',
    description: '貯蓄口座 への振込',
    created_at: createdAt,
    peer_account_number: '1000-0002',
    peer_account_name: '貯蓄口座',
  };

  it('取引を API の型に変換して返す', async () => {
    db.poolQuery.mockResolvedValueOnce({ rows: [txRow] });

    await expect(listTransactions('user-1', { accountId: ACCOUNT_ID })).resolves.toEqual([
      {
        id: 'tx-1',
        accountId: ACCOUNT_ID,
        direction: 'debit',
        kind: 'transfer',
        amount: 3000,
        balanceAfter: 7000,
        description: '貯蓄口座 への振込',
        createdAt: '2026-01-01T00:00:00.000Z',
        peerAccountNumber: '1000-0002',
        peerAccountName: '貯蓄口座',
      },
    ]);
    expect(db.poolQuery.mock.calls[0]![1]).toEqual(['user-1', ACCOUNT_ID, 20]);
  });

  it('口座未指定なら null で全口座を対象にする', async () => {
    db.poolQuery.mockResolvedValueOnce({ rows: [] });
    await listTransactions('user-1');
    expect(db.poolQuery.mock.calls[0]![1]).toEqual(['user-1', null, 20]);
  });

  it.each([
    [0, 1],
    [-5, 1],
    [50, 50],
    [1000, 100],
  ])('limit %s は %s に丸める', async (limit, expected) => {
    db.poolQuery.mockResolvedValueOnce({ rows: [] });
    await listTransactions('user-1', { limit });
    expect(db.poolQuery.mock.calls[0]![1][2]).toBe(expected);
  });
});

describe('deposit', () => {
  function mockDepositQueries(locked: { id: string; balance: number | string } | null) {
    db.clientQuery
      .mockResolvedValueOnce({ rows: locked ? [locked] : [] })
      .mockImplementationOnce(async (_sql: string, [balance]: [number]) => ({ rows: [accountRow({ balance })] }))
      .mockImplementationOnce(async (_sql: string, [accountId, amount, balanceAfter, description]: unknown[]) => ({
        rows: [
          {
            id: 'tx-1',
            account_id: accountId,
            direction: 'credit',
            kind: 'deposit',
            amount,
            balance_after: balanceAfter,
            description,
            created_at: createdAt,
            peer_account_number: null,
            peer_account_name: null,
          },
        ],
      }));
  }

  it('残高に加算し入金取引を記録する', async () => {
    mockDepositQueries({ id: ACCOUNT_ID, balance: '10000' });

    const result = await deposit('user-1', ACCOUNT_ID, 5000, '給与');

    expect(result.account.balance).toBe(15000);
    expect(result.transaction).toMatchObject({
      direction: 'credit',
      kind: 'deposit',
      amount: 5000,
      balanceAfter: 15000,
      description: '給与',
    });
    expect(db.clientQuery.mock.calls[0]![0]).toMatch(/FOR UPDATE/);
    expect(db.clientQuery.mock.calls[1]![1]).toEqual([15000, ACCOUNT_ID]);
  });

  it('摘要が空なら「入金」とする', async () => {
    mockDepositQueries({ id: ACCOUNT_ID, balance: 0 });
    const result = await deposit('user-1', ACCOUNT_ID, 100, '');
    expect(result.transaction.description).toBe('入金');
  });

  it.each([0, -100, 0.5])('金額 %s は 400 invalid_amount', async (amount) => {
    await expect(deposit('user-1', ACCOUNT_ID, amount, '')).rejects.toMatchObject({
      status: 400,
      code: 'invalid_amount',
    });
    expect(db.clientQuery).not.toHaveBeenCalled();
  });

  it('自分の口座でなければ 404 で更新しない', async () => {
    mockDepositQueries(null);
    await expect(deposit('user-1', ACCOUNT_ID, 100, '')).rejects.toMatchObject({ status: 404 });
    expect(db.clientQuery).toHaveBeenCalledTimes(1);
  });
});
