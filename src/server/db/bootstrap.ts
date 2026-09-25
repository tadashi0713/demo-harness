import { config } from '../config';
import { migrate } from './migrate';
import { waitForDatabase } from './pool';
import { seedDemoData } from './seed';

export async function bootstrapDatabase(): Promise<void> {
  await waitForDatabase();
  await migrate();
  if (config.seedDemoData) {
    await seedDemoData();
  }
}
