import { Pool, types, type PoolClient } from 'pg';
import { config } from '../config';

// bigint (OID 20) はデフォルトで string になるため number へ変換する。
// 金額は最小通貨単位 (JPY = 円) の整数で保持し、Number.MAX_SAFE_INTEGER 内で扱う。
types.setTypeParser(types.builtins.INT8, (value) => Number(value));

// 開発時のホットリロードでコネクションプールが増殖しないよう globalThis に保持する
const globalForDb = globalThis as unknown as { atlasbankPool?: Pool };

export const pool = globalForDb.atlasbankPool ?? new Pool({ connectionString: config.databaseUrl, max: 10 });

if (config.env !== 'production') {
  globalForDb.atlasbankPool = pool;
}

/** 1 つのトランザクション内で処理を実行する。例外時は自動で ROLLBACK。 */
export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/** DB が起動しきるまで待つ（docker compose 起動直後向け）。 */
export async function waitForDatabase(retries = 30, delayMs = 1000): Promise<void> {
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      await pool.query('SELECT 1');
      return;
    } catch (error) {
      if (attempt === retries) throw error;
      console.log(`[db] 接続待機中... (${attempt}/${retries})`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}
