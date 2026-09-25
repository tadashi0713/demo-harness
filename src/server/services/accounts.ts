import type { Account, Transaction } from '@/lib/types';
import { pool, withTransaction } from '../db/pool';
import { badRequest, notFound } from '../http-error';

export type AccountRow = {
  id: string;
  account_number: string;
  name: string;
  kind: 'checking' | 'savings';
  currency: string;
  balance: number;
  created_at: Date;
};

type TransactionRow = {
  id: string;
  account_id: string;
  direction: 'credit' | 'debit';
  kind: 'deposit' | 'withdrawal' | 'transfer';
  amount: number;
  balance_after: number;
  description: string;
  created_at: Date;
  peer_account_number: string | null;
  peer_account_name: string | null;
};

export const toAccount = (row: AccountRow): Account => ({
  id: row.id,
  accountNumber: row.account_number,
  name: row.name,
  kind: row.kind,
  currency: row.currency,
  balance: Number(row.balance),
  createdAt: row.created_at.toISOString(),
});

const toTransaction = (row: TransactionRow): Transaction => ({
  id: row.id,
  accountId: row.account_id,
  direction: row.direction,
  kind: row.kind,
  amount: Number(row.amount),
  balanceAfter: Number(row.balance_after),
  description: row.description,
  createdAt: row.created_at.toISOString(),
  peerAccountNumber: row.peer_account_number,
  peerAccountName: row.peer_account_name,
});

export async function listAccounts(userId: string): Promise<Account[]> {
  const { rows } = await pool.query<AccountRow>(
    `SELECT id, account_number, name, kind, currency, balance, created_at
       FROM accounts
      WHERE user_id = $1
      ORDER BY created_at`,
    [userId],
  );
  return rows.map(toAccount);
}

export async function getAccount(userId: string, accountId: string): Promise<Account> {
  const { rows } = await pool.query<AccountRow>(
    `SELECT id, account_number, name, kind, currency, balance, created_at
       FROM accounts
      WHERE id = $1 AND user_id = $2`,
    [accountId, userId],
  );
  const row = rows[0];
  if (!row) throw notFound('口座が見つかりません');
  return toAccount(row);
}

export async function listTransactions(
  userId: string,
  options: { accountId?: string; limit?: number } = {},
): Promise<Transaction[]> {
  const limit = Math.min(Math.max(options.limit ?? 20, 1), 100);
  const { rows } = await pool.query<TransactionRow>(
    `SELECT t.id, t.account_id, t.direction, t.kind, t.amount, t.balance_after,
            t.description, t.created_at,
            peer.account_number AS peer_account_number,
            peer.name           AS peer_account_name
       FROM transactions t
       JOIN accounts a       ON a.id = t.account_id
       LEFT JOIN accounts peer ON peer.id = t.peer_account_id
      WHERE a.user_id = $1
        AND ($2::uuid IS NULL OR t.account_id = $2::uuid)
      ORDER BY t.created_at DESC, t.id DESC
      LIMIT $3`,
    [userId, options.accountId ?? null, limit],
  );
  return rows.map(toTransaction);
}

/** デモ用の入金。実際の銀行では外部からの着金に相当する。 */
export async function deposit(
  userId: string,
  accountId: string,
  amount: number,
  description: string,
): Promise<{ account: Account; transaction: Transaction }> {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw badRequest('金額は 1 以上の整数で指定してください', 'invalid_amount');
  }

  return withTransaction(async (client) => {
    const locked = await client.query<{ id: string; balance: number }>(
      `SELECT id, balance FROM accounts WHERE id = $1 AND user_id = $2 FOR UPDATE`,
      [accountId, userId],
    );
    const account = locked.rows[0];
    if (!account) throw notFound('口座が見つかりません');

    const balanceAfter = Number(account.balance) + amount;
    const updated = await client.query<AccountRow>(
      `UPDATE accounts SET balance = $1 WHERE id = $2
       RETURNING id, account_number, name, kind, currency, balance, created_at`,
      [balanceAfter, accountId],
    );
    const tx = await client.query<TransactionRow>(
      `INSERT INTO transactions (account_id, direction, kind, amount, balance_after, description)
       VALUES ($1, 'credit', 'deposit', $2, $3, $4)
       RETURNING id, account_id, direction, kind, amount, balance_after, description, created_at,
                 NULL::text AS peer_account_number, NULL::text AS peer_account_name`,
      [accountId, amount, balanceAfter, description || '入金'],
    );

    return {
      account: toAccount(updated.rows[0]!),
      transaction: toTransaction(tx.rows[0]!),
    };
  });
}
