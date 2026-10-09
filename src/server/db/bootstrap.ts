import { config } from '../config';
import { pool, waitForDatabase } from './pool';
import { seedDemoData } from './seed';

// 複数レプリカが同時に起動しても、シードは 1 台ずつ実行させる
const BOOTSTRAP_LOCK_KEY = 72_210_001;

// スキーマは Harness Database DevOps が db/changelog.yaml を適用して作る
export async function bootstrapDatabase(): Promise<void> {
  await waitForDatabase();

  if (!config.seedDemoData) {
    return;
  }

  const lockClient = await pool.connect();
  try {
    await lockClient.query('SELECT pg_advisory_lock($1)', [BOOTSTRAP_LOCK_KEY]);
    await seedDemoData();
  } finally {
    // セッションを破棄すればロックも確実に解放される
    lockClient.release(true);
  }
}
