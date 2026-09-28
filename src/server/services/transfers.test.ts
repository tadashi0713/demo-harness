import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTransfer, lookupPayee } from './transfers';

const db = vi.hoisted(() => ({
  poolQuery: vi.fn(),
  clientQuery: vi.fn(),
}));

vi.mock('../db/pool', () => ({
  pool: { query: db.poolQuery },
  withTransaction: (fn: (client: unknown) => Promise<unknown>) => fn({ query: db.clientQuery }),
}));

const FROM_ID = '11111111-1111-4111-8111-111111111111';
const TO_ID = '22222222-2222-4222-8222-222222222222';
const createdAt = new Date('2026-01-01T00:00:00Z');

const baseParams = {
  userId: 'user-1',
  fromAccountId: FROM_ID,
  toAccountNumber: '1000-0002',
  amount: 3000,
  description: '',
};

const lockedRow = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  account_number: id === FROM_ID ? '1000-0001' : '1000-0002',
  name: id === FROM_ID ? '総合口座' : '貯蓄口座',
  balance: 10000,
  currency: 'JPY',
  owner_name: '根本 征',
  ...overrides,
});

/** createTransfer が発行するクエリの順に結果を積む */
function mockTransferQueries(options: {
  owned?: boolean;
  toId?: string | null;
  from?: Record<string, unknown>;
  to?: Record<string, unknown>;
} = {}) {
  const { owned = true, toId = TO_ID, from = {}, to = {} } = options;
  db.clientQuery
    .mockResolvedValueOnce({ rows: owned ? [{ id: FROM_ID }] : [] })
    .mockResolvedValueOnce({ rows: toId ? [{ id: toId }] : [] })
    .mockResolvedValueOnce({ rows: [lockedRow(FROM_ID, from), lockedRow(TO_ID, to)] })
    .mockImplementationOnce(async (_sql: string, [balance]: [number]) => ({
      rows: [
        {
          id: FROM_ID,
          account_number: '1000-0001',
          name: '総合口座',
          kind: 'checking',
          currency: 'JPY',
          balance,
          created_at: createdAt,
        },
      ],
    }))
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({ rows: [{ transfer_id: 'transfer-1' }] });
}

beforeEach(() => {
  db.poolQuery.mockReset();
  db.clientQuery.mockReset();
});

describe('createTransfer', () => {
  it('送金元から減算し送金先へ加算した結果を返す', async () => {
    mockTransferQueries();

    const result = await createTransfer(baseParams);

    expect(result).toEqual({
      transferId: 'transfer-1',
      amount: 3000,
      description: '貯蓄口座 への振込',
      from: { accountId: FROM_ID, accountNumber: '1000-0001', balanceAfter: 7000 },
      to: { accountNumber: '1000-0002', accountName: '貯蓄口座', ownerName: '根本 征' },
      account: {
        id: FROM_ID,
        accountNumber: '1000-0001',
        name: '総合口座',
        kind: 'checking',
        currency: 'JPY',
        balance: 7000,
        createdAt: createdAt.toISOString(),
      },
    });

    const calls = db.clientQuery.mock.calls;
    expect(calls[3]![1]).toEqual([7000, FROM_ID]);
    expect(calls[4]![1]).toEqual([13000, TO_ID]);
    expect(calls[5]![1]).toEqual([FROM_ID, TO_ID, 7000, 13000, 3000, '貯蓄口座 への振込']);
  });

  it('両口座を FOR UPDATE でロックする', async () => {
    mockTransferQueries();
    await createTransfer(baseParams);

    const [sql, params] = db.clientQuery.mock.calls[2]!;
    expect(sql).toMatch(/ORDER BY a\.id\s+FOR UPDATE/);
    expect(params).toEqual([[FROM_ID, TO_ID]]);
  });

  it('摘要を指定した場合はそれを使う', async () => {
    mockTransferQueries();
    const result = await createTransfer({ ...baseParams, description: '家賃' });
    expect(result.description).toBe('家賃');
  });

  it('DB から文字列で返った残高も数値として計算する', async () => {
    mockTransferQueries({ from: { balance: '10000' }, to: { balance: '500' } });
    const result = await createTransfer(baseParams);

    expect(result.from.balanceAfter).toBe(7000);
    expect(db.clientQuery.mock.calls[4]![1]).toEqual([3500, TO_ID]);
  });

  it('残高ちょうどの金額は振込できる', async () => {
    mockTransferQueries();
    const result = await createTransfer({ ...baseParams, amount: 10000 });
    expect(result.from.balanceAfter).toBe(0);
  });

  it.each([0, -1, 1.5, Number.NaN])('金額 %s は DB に触れずに 400 invalid_amount', async (amount) => {
    await expect(createTransfer({ ...baseParams, amount })).rejects.toMatchObject({
      status: 400,
      code: 'invalid_amount',
    });
    expect(db.clientQuery).not.toHaveBeenCalled();
  });

  it('自分の口座でなければ 404', async () => {
    mockTransferQueries({ owned: false });
    await expect(createTransfer(baseParams)).rejects.toMatchObject({
      status: 404,
      message: '送金元の口座が見つかりません',
    });
  });

  it('送金先の口座番号が存在しなければ 404', async () => {
    mockTransferQueries({ toId: null });
    await expect(createTransfer(baseParams)).rejects.toMatchObject({
      status: 404,
      message: '送金先の口座番号が見つかりません',
    });
  });

  it('同じ口座への振込は 400 same_account', async () => {
    mockTransferQueries({ toId: FROM_ID });
    await expect(createTransfer(baseParams)).rejects.toMatchObject({ status: 400, code: 'same_account' });
  });

  it('通貨が異なる場合は 400 currency_mismatch', async () => {
    mockTransferQueries({ to: { currency: 'USD' } });
    await expect(createTransfer(baseParams)).rejects.toMatchObject({ status: 400, code: 'currency_mismatch' });
  });

  it('残高不足は 409 insufficient_funds で残高を更新しない', async () => {
    mockTransferQueries();
    await expect(createTransfer({ ...baseParams, amount: 10001 })).rejects.toMatchObject({
      status: 409,
      code: 'insufficient_funds',
    });
    expect(db.clientQuery).toHaveBeenCalledTimes(3);
  });
});

describe('lookupPayee', () => {
  it('受取人情報を返す', async () => {
    db.poolQuery.mockResolvedValueOnce({
      rows: [{ account_number: '1000-0002', name: '貯蓄口座', owner_name: '根本 征' }],
    });

    await expect(lookupPayee('1000-0002')).resolves.toEqual({
      accountNumber: '1000-0002',
      accountName: '貯蓄口座',
      ownerName: '根本 征',
    });
    expect(db.poolQuery.mock.calls[0]![1]).toEqual(['1000-0002']);
  });

  it('存在しない口座番号は 404', async () => {
    db.poolQuery.mockResolvedValueOnce({ rows: [] });
    await expect(lookupPayee('9999-9999')).rejects.toMatchObject({ status: 404 });
  });
});
