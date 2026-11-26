import { expect, type Locator, type Page } from '@playwright/test';

export const DEMO_USER = {
  email: process.env.E2E_USER_EMAIL ?? 'tadashi.nemoto@harness.io',
  password: process.env.E2E_USER_PASSWORD ?? 'password123',
  fullName: process.env.E2E_USER_FULL_NAME ?? '根本 征',
};

export const CHECKING_ACCOUNT = { number: '1000-0001', name: '総合口座' };
export const SAVINGS_ACCOUNT = { number: '1000-0002', name: '貯蓄口座' };

export async function login(page: Page, email = DEMO_USER.email, password = DEMO_USER.password) {
  await page.goto('/login');
  await page.getByLabel('メールアドレス').fill(email);
  await page.getByLabel('パスワード').fill(password);
  await page.getByRole('button', { name: 'ログイン' }).click();
}

export async function loginAsDemoUser(page: Page) {
  await login(page);
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { name: `こんにちは、${DEMO_USER.fullName} さん` })).toBeVisible();
}

/** "￥1,234" のような表示金額を数値に戻す */
export async function readMoney(locator: Locator): Promise<number> {
  const text = await locator.innerText();
  return Number(text.replace(/[^\d-]/g, ''));
}

export function accountCard(page: Page, accountNumber: string): Locator {
  return page.locator('.account-card').filter({ hasText: accountNumber });
}
