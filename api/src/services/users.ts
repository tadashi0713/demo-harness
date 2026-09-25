import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { pool, withTransaction } from '../db/pool';
import { conflict, unauthorized } from '../lib/http-error';

export type User = {
  id: string;
  email: string;
  fullName: string;
  createdAt: string;
};

type UserRow = {
  id: string;
  email: string;
  full_name: string;
  password_hash: string;
  created_at: Date;
};

const WELCOME_BONUS = 10_000;

const toUser = (row: UserRow): User => ({
  id: row.id,
  email: row.email,
  fullName: row.full_name,
  createdAt: row.created_at.toISOString(),
});

function randomAccountNumber(): string {
  const block = () => String(crypto.randomInt(0, 10_000)).padStart(4, '0');
  return `${block()}-${block()}`;
}

export async function registerUser(params: {
  email: string;
  password: string;
  fullName: string;
}): Promise<User> {
  const email = params.email.trim().toLowerCase();
  const passwordHash = await bcrypt.hash(params.password, 10);

  return withTransaction(async (client) => {
    const existing = await client.query(`SELECT 1 FROM users WHERE email = $1`, [email]);
    if (existing.rowCount) throw conflict('このメールアドレスは既に登録されています', 'email_taken');

    const inserted = await client.query<UserRow>(
      `INSERT INTO users (email, password_hash, full_name) VALUES ($1, $2, $3)
       RETURNING id, email, full_name, password_hash, created_at`,
      [email, passwordHash, params.fullName.trim()],
    );
    const user = inserted.rows[0]!;

    // 新規ユーザーには総合口座を 1 つ作成し、デモ用のウェルカム入金を行う
    let accountId: string | undefined;
    for (let attempt = 0; attempt < 5 && !accountId; attempt += 1) {
      const candidate = randomAccountNumber();
      const taken = await client.query(`SELECT 1 FROM accounts WHERE account_number = $1`, [candidate]);
      if (taken.rowCount) continue;
      const account = await client.query<{ id: string }>(
        `INSERT INTO accounts (user_id, account_number, name, kind, balance)
         VALUES ($1, $2, '総合口座', 'checking', $3) RETURNING id`,
        [user.id, candidate, WELCOME_BONUS],
      );
      accountId = account.rows[0]!.id;
    }
    if (!accountId) throw conflict('口座番号の発行に失敗しました。もう一度お試しください', 'account_number_conflict');

    await client.query(
      `INSERT INTO transactions (account_id, direction, kind, amount, balance_after, description)
       VALUES ($1, 'credit', 'deposit', $2, $2, 'ようこそキャンペーン入金')`,
      [accountId, WELCOME_BONUS],
    );

    return toUser(user);
  });
}

export async function authenticate(email: string, password: string): Promise<User> {
  const { rows } = await pool.query<UserRow>(
    `SELECT id, email, full_name, password_hash, created_at FROM users WHERE email = $1`,
    [email.trim().toLowerCase()],
  );
  const row = rows[0];
  // ユーザーの有無を伏せるため、どちらの失敗でも同じメッセージを返す
  if (!row || !(await bcrypt.compare(password, row.password_hash))) {
    throw unauthorized('メールアドレスまたはパスワードが違います');
  }
  return toUser(row);
}

export async function getUserById(id: string): Promise<User | null> {
  const { rows } = await pool.query<UserRow>(
    `SELECT id, email, full_name, password_hash, created_at FROM users WHERE id = $1`,
    [id],
  );
  const row = rows[0];
  return row ? toUser(row) : null;
}
