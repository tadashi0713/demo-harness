import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.E2E_PORT ?? 3000);
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${port}`;

export default defineConfig({
  testDir: './e2e',
  // 振込で残高が変わるため、テスト同士が干渉しないよう直列に実行する
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ['list'],
    ['junit', { outputFile: 'reports/e2e-junit.xml' }],
    ['html', { outputFolder: 'reports/playwright-report', open: 'never' }],
  ],
  outputDir: 'reports/playwright-results',
  use: {
    baseURL,
    locale: 'ja-JP',
    timezoneId: 'Asia/Tokyo',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // E2E_BASE_URL を指定したときは起動済みの環境（stg など）に対して実行する
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: process.env.CI ? `yarn start -p ${port}` : `yarn dev -p ${port}`,
        url: `${baseURL}/api/health`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
