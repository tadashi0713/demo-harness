import { createApp } from './app';
import { config } from './config';
import { migrate } from './db/migrate';
import { pool, waitForDatabase } from './db/pool';
import { seedDemoData } from './db/seed';

async function main(): Promise<void> {
  await waitForDatabase();
  await migrate();
  if (config.seedDemoData) {
    await seedDemoData();
  }

  const server = createApp().listen(config.port, () => {
    console.log(`[api] http://localhost:${config.port} で待機中 (${config.env})`);
  });

  const shutdown = (signal: string) => {
    console.log(`[api] ${signal} を受信、シャットダウンします`);
    server.close(() => {
      pool.end().finally(() => process.exit(0));
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((error) => {
  console.error('[api] 起動に失敗しました', error);
  process.exit(1);
});
