import bcrypt from 'bcryptjs';
import type { User } from '@/lib/types';
import { pool } from '../db/pool';
import { unauthorized } from '../http-error';

type UserRow = {
  id: string;
  email: string;
  full_name: string;
  password_hash: string;
  created_at: Date;
};

const toUser = (row: UserRow): User => ({
  id: row.id,
  email: row.email,
  fullName: row.full_name,
  createdAt: row.created_at.toISOString(),
});

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
