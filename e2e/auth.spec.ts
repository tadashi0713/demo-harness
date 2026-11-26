import { expect, test } from '@playwright/test';
import { DEMO_USER, login, loginAsDemoUser } from './helpers';

test.describe('認証', () => {
  test('未ログインでダッシュボードを開くとログイン画面へ戻される', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByText('アカウントにログインしてください')).toBeVisible();
  });

  test('デモアカウントでログインするとダッシュボードが表示される', async ({ page }) => {
    await loginAsDemoUser(page);
    await expect(page.locator('.user-chip')).toContainText(DEMO_USER.fullName);
  });

  test('パスワードを間違えるとエラーが表示されログインできない', async ({ page }) => {
    await login(page, DEMO_USER.email, 'wrong-password');
    await expect(page.locator('.alert[data-tone="error"]')).toHaveText('メールアドレスまたはパスワードが違います');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('ログアウトするとログイン画面へ戻り、再読み込みしてもセッションが復元されない', async ({ page }) => {
    await loginAsDemoUser(page);
    await page.getByRole('button', { name: 'ログアウト' }).click();
    await expect(page).toHaveURL(/\/login$/);

    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('ログイン後に再読み込みしてもセッションが維持される', async ({ page }) => {
    await loginAsDemoUser(page);
    await page.reload();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.locator('.user-chip')).toContainText(DEMO_USER.fullName);
  });
});
