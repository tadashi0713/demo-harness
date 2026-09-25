/** サーバー起動時に 1 度だけ呼ばれる。スキーマ適用とデモデータ投入を行う。 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { bootstrapDatabase } = await import('./server/db/bootstrap');
    await bootstrapDatabase();
  }
}
