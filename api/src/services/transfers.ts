import { pool, withTransaction } from '../db/pool';
import { badRequest, conflict, notFound } from '../lib/http-error';
import { toAccount, type Account, type AccountRow } from './accounts';

export type TransferResult = {
  transferId: string;
  amount: number;
  description: string;
  from: { accountId: string; accountNumber: string; balanceAfter: number };
  to: { accountNumber: string; accountName: string; ownerName: string };
  account: Account;
};

type LockedAccount = {
  id: string;
  account_number: string;
  name: string;
  balance: number;
  currency: string;
  owner_name: string;
};

/**
 * 口座間振込。送金元・送金先を id 順に FOR UPDATE でロックしてから残高を更新するため、
 * 同時実行時のデッドロックと残高の不整合を防げる。
 */
export async function createTransfer(params: {
  userId: string;
  fromAccountId: string;
  toAccountNumber: string;
  amount: number;
  description: string;
}): Promise<TransferResult> {
  const { userId, fromAccountId, toAccountNumber, amount, description } = params;

  if (!Number.isInteger(amount) || amount <= 0) {
    throw badRequest('金額は 1 以上の整数で指定してください', 'invalid_amount');
  }

  return withTransaction(async (client) => {
    const owned = await client.query<{ id: string }>(
      `SELECT id FROM accounts WHERE id = $1 AND user_id = $2`,
      [fromAccountId, userId],
    );
    if (!owned.rows[0]) throw notFound('送金元の口座が見つかりません');

    const destination = await client.query<{ id: string }>(
      `SELECT id FROM accounts WHERE account_number = $1`,
      [toAccountNumber],
    );
    const toAccountId = destination.rows[0]?.id;
    if (!toAccountId) throw notFound('送金先の口座番号が見つかりません');
    if (toAccountId === fromAccountId) {
      throw badRequest('同じ口座には振込できません', 'same_account');
    }

    // デッドロック回避のため id 順にロックする
    const locked = await client.query<LockedAccount>(
      `SELECT a.id, a.account_number, a.name, a.balance, a.currency, u.full_name AS owner_name
         FROM accounts a
         JOIN users u ON u.id = a.user_id
        WHERE a.id = ANY($1::uuid[])
        ORDER BY a.id
          FOR UPDATE OF a`,
      [[fromAccountId, toAccountId]],
    );

    const from = locked.rows.find((row) => row.id === fromAccountId);
    const to = locked.rows.find((row) => row.id === toAccountId);
    if (!from || !to) throw notFound('口座が見つかりません');
    if (from.currency !== to.currency) {
      throw badRequest('通貨が異なる口座間の振込には対応していません', 'currency_mismatch');
    }

    const fromBalance = Number(from.balance);
    if (fromBalance < amount) {
      throw conflict('残高が不足しています', 'insufficient_funds');
    }

    const fromBalanceAfter = fromBalance - amount;
    const toBalanceAfter = Number(to.balance) + amount;
    const label = description || `${to.name} への振込`;

    const updatedFrom = await client.query<AccountRow>(
      `UPDATE accounts SET balance = $1 WHERE id = $2
       RETURNING id, account_number, name, kind, currency, balance, created_at`,
      [fromBalanceAfter, fromAccountId],
    );
    await client.query(`UPDATE accounts SET balance = $1 WHERE id = $2`, [toBalanceAfter, toAccountId]);

    const transfer = await client.query<{ transfer_id: string }>(
      `WITH t AS (SELECT gen_random_uuid() AS transfer_id)
       INSERT INTO transactions
         (account_id, peer_account_id, transfer_id, direction, kind, amount, balance_after, description)
       SELECT v.account_id, v.peer_account_id, t.transfer_id, v.direction, 'transfer',
              $5, v.balance_after, $6
         FROM t,
              (VALUES ($1::uuid, $2::uuid, 'debit',  $3::bigint),
                      ($2::uuid, $1::uuid, 'credit', $4::bigint))
                AS v(account_id, peer_account_id, direction, balance_after)
       RETURNING transfer_id`,
      [fromAccountId, toAccountId, fromBalanceAfter, toBalanceAfter, amount, label],
    );

    return {
      transferId: transfer.rows[0]!.transfer_id,
      amount,
      description: label,
      from: {
        accountId: fromAccountId,
        accountNumber: from.account_number,
        balanceAfter: fromBalanceAfter,
      },
      to: {
        accountNumber: to.account_number,
        accountName: to.name,
        ownerName: to.owner_name,
      },
      account: toAccount(updatedFrom.rows[0]!),
    };
  });
}

/** 振込先の口座番号を検証して受取人名を返す（振込前の確認用）。 */
export async function lookupPayee(
  accountNumber: string,
): Promise<{ accountNumber: string; accountName: string; ownerName: string }> {
  const { rows } = await pool.query<{ account_number: string; name: string; owner_name: string }>(
    `SELECT a.account_number, a.name, u.full_name AS owner_name
       FROM accounts a
       JOIN users u ON u.id = a.user_id
      WHERE a.account_number = $1`,
    [accountNumber],
  );
  const row = rows[0];
  if (!row) throw notFound('口座番号が見つかりません');
  return { accountNumber: row.account_number, accountName: row.name, ownerName: row.owner_name };
}
