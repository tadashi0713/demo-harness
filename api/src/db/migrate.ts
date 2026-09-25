import { pool } from './pool';

/**
 * デモ用のシンプルなマイグレーション。
 * 起動時に冪等に実行される（本番運用では専用のマイグレーションツールを使うこと）。
 */
const SCHEMA_SQL = `
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name     TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS accounts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_number TEXT NOT NULL UNIQUE,
  name           TEXT NOT NULL,
  kind           TEXT NOT NULL CHECK (kind IN ('checking', 'savings')),
  currency       TEXT NOT NULL DEFAULT 'JPY',
  -- 金額は最小通貨単位の整数で保持する（JPY なら円）
  balance        BIGINT NOT NULL DEFAULT 0 CHECK (balance >= 0),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS accounts_user_id_idx ON accounts(user_id);

CREATE TABLE IF NOT EXISTS transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  -- 振込の場合の相手口座（入金/出金では NULL）
  peer_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  -- 同一振込の入出金ペアを紐付けるキー
  transfer_id     UUID,
  direction       TEXT NOT NULL CHECK (direction IN ('credit', 'debit')),
  kind            TEXT NOT NULL CHECK (kind IN ('deposit', 'withdrawal', 'transfer')),
  amount          BIGINT NOT NULL CHECK (amount > 0),
  balance_after   BIGINT NOT NULL,
  description     TEXT NOT NULL DEFAULT '',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS transactions_account_id_created_at_idx
  ON transactions(account_id, created_at DESC);
`;

export async function migrate(): Promise<void> {
  await pool.query(SCHEMA_SQL);
  console.log('[db] スキーマを適用しました');
}
