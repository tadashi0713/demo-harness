import { expect, test } from '@playwright/test';
import { accountCard, CHECKING_ACCOUNT, loginAsDemoUser, readMoney, SAVINGS_ACCOUNT } from './helpers';

test.describe('口座', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsDemoUser(page);
  });

  test('ダッシュボードに口座一覧と、その合計と一致する総資産が表示される', async ({ page }) => {
    const checking = accountCard(page, CHECKING_ACCOUNT.number);
    const savings = accountCard(page, SAVINGS_ACCOUNT.number);
    await expect(checking).toContainText(CHECKING_ACCOUNT.name);
    await expect(savings).toContainText(SAVINGS_ACCOUNT.name);

    const total = await readMoney(page.locator('.hero-amount'));
    const sum =
      (await readMoney(checking.locator('.account-balance'))) +
      (await readMoney(savings.locator('.account-balance')));
    expect(total).toBe(sum);

    await expect(page.locator('.tx-row').first()).toBeVisible();
  });

  test('口座カードをクリックすると明細画面が表示される', async ({ page }) => {
    await accountCard(page, CHECKING_ACCOUNT.number).click();

    await expect(page).toHaveURL(/\/accounts\/[^/]+$/);
    await expect(page.getByRole('heading', { name: CHECKING_ACCOUNT.name, level: 1 })).toBeVisible();
    await expect(page.locator('.account-number')).toContainText(CHECKING_ACCOUNT.number);
    await expect(page.locator('.tx-row').filter({ hasText: '給与振込' }).first()).toBeVisible();
  });

  test('デモ入金すると残高が増え、取引履歴に追加される', async ({ page }) => {
    await accountCard(page, SAVINGS_ACCOUNT.number).click();
    await expect(page.getByRole('heading', { name: SAVINGS_ACCOUNT.name, level: 1 })).toBeVisible();

    const balance = page.locator('.hero-amount');
    const before = await readMoney(balance);

    await page.getByLabel('入金額').fill('1234');
    await page.getByRole('button', { name: '入金する' }).click();

    await expect(page.locator('.alert[data-tone="success"]')).toContainText('を入金しました');
    await expect.poll(() => readMoney(balance)).toBe(before + 1234);
    await expect(page.locator('.tx-row').first()).toContainText('デモ入金');
  });
});
