import bcrypt from 'bcryptjs';
import type { PoolClient } from 'pg';
import { pool, withTransaction } from './pool';

type SeedEntry = {
  kind: 'deposit' | 'withdrawal';
  amount: number;
  description: string;
  daysAgo: number;
};

type SeedAccount = {
  accountNumber: string;
  name: string;
  kind: 'checking' | 'savings';
  entries: SeedEntry[];
};

type SeedUser = {
  email: string;
  fullName: string;
  password: string;
  accounts: SeedAccount[];
};

const DEMO_USERS: SeedUser[] = [
  {
    email: 'tadashi.nemoto@harness.io',
    fullName: '根本 征',
    password: 'password123',
    accounts: [
      {
        accountNumber: '1000-0001',
        name: '総合口座',
        kind: 'checking',
        entries: [
          { kind: 'deposit', amount: 480_000, description: '給与振込', daysAgo: 45 },
          { kind: 'withdrawal', amount: 92_000, description: '家賃', daysAgo: 44 },
          { kind: 'withdrawal', amount: 12_800, description: '電気・ガス料金', daysAgo: 40 },
          { kind: 'withdrawal', amount: 6_480, description: 'コンビニ', daysAgo: 33 },
          { kind: 'deposit', amount: 480_000, description: '給与振込', daysAgo: 15 },
          { kind: 'withdrawal', amount: 92_000, description: '家賃', daysAgo: 14 },
          { kind: 'withdrawal', amount: 24_200, description: 'クレジットカード引落', daysAgo: 9 },
          { kind: 'withdrawal', amount: 3_520, description: 'カフェ', daysAgo: 2 },
        ],
      },
      {
        accountNumber: '1000-0002',
        name: '貯蓄口座',
        kind: 'savings',
        entries: [
          { kind: 'deposit', amount: 1_500_000, description: '定期積立', daysAgo: 120 },
          { kind: 'deposit', amount: 300_000, description: '定期積立', daysAgo: 60 },
          { kind: 'deposit', amount: 200_000, description: '定期積立', daysAgo: 30 },
        ],
      },
    ],
  },
];

function daysAgoToDate(daysAgo: number): Date {
  return new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
}

async function seedUser(client: PoolClient, user: SeedUser): Promise<void> {
  const passwordHash = await bcrypt.hash(user.password, 10);
  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO users (email, password_hash, full_name) VALUES ($1, $2, $3) RETURNING id`,
    [user.email, passwordHash, user.fullName],
  );
  const userId = rows[0]!.id;

  for (const account of user.accounts) {
    const inserted = await client.query<{ id: string }>(
      `INSERT INTO accounts (user_id, account_number, name, kind, balance)
       VALUES ($1, $2, $3, $4, 0) RETURNING id`,
      [userId, account.accountNumber, account.name, account.kind],
    );
    const accountId = inserted.rows[0]!.id;

    // 履歴を古い順に適用して残高を積み上げる（残高と履歴を必ず一致させる）
    let balance = 0;
    const entries = [...account.entries].sort((a, b) => b.daysAgo - a.daysAgo);
    for (const entry of entries) {
      balance += entry.kind === 'deposit' ? entry.amount : -entry.amount;
      await client.query(
        `INSERT INTO transactions
           (account_id, direction, kind, amount, balance_after, description, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          accountId,
          entry.kind === 'deposit' ? 'credit' : 'debit',
          entry.kind,
          entry.amount,
          balance,
          entry.description,
          daysAgoToDate(entry.daysAgo),
        ],
      );
    }

    await client.query(`UPDATE accounts SET balance = $1 WHERE id = $2`, [balance, accountId]);
  }
}

/** users が空のときだけデモデータを投入する。 */
export async function seedDemoData(): Promise<void> {
  const { rows } = await pool.query<{ count: number }>('SELECT COUNT(*)::bigint AS count FROM users');
  if ((rows[0]?.count ?? 0) > 0) {
    console.log('[db] 既にデータがあるためシードをスキップしました');
    return;
  }

  await withTransaction(async (client) => {
    for (const user of DEMO_USERS) {
      await seedUser(client, user);
    }
  });

  console.log('[db] デモデータを投入しました (tadashi.nemoto@harness.io, password123)');
}
