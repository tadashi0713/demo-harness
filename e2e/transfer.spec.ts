import { expect, test } from '@playwright/test';
import { accountCard, CHECKING_ACCOUNT, DEMO_USER, loginAsDemoUser, readMoney, SAVINGS_ACCOUNT } from './helpers';

test.describe('振込', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsDemoUser(page);
  });

  test('自分の貯蓄口座へ振込すると、両口座の残高と明細に反映される', async ({ page }) => {
    const checkingBefore = await readMoney(accountCard(page, CHECKING_ACCOUNT.number).locator('.account-balance'));
    const savingsBefore = await readMoney(accountCard(page, SAVINGS_ACCOUNT.number).locator('.account-balance'));
    const amount = 1000;
    const description = `E2E 振込 ${Date.now()}`;

    await page.getByRole('link', { name: '振込する' }).click();
    await expect(page.getByRole('heading', { name: '振込', level: 1 })).toBeVisible();

    const from = page.getByLabel('送金元の口座');
    const checkingOption = from.locator('option', { hasText: CHECKING_ACCOUNT.number });
    await expect(checkingOption).toHaveCount(1);
    await from.selectOption((await checkingOption.getAttribute('value')) ?? '');
    await page.getByLabel('振込先の口座番号').fill(SAVINGS_ACCOUNT.number);
    await expect(page.getByText(`受取人: ${DEMO_USER.fullName}（${SAVINGS_ACCOUNT.name}）`)).toBeVisible();
    await page.getByLabel('金額').fill(String(amount));
    await page.getByLabel('摘要（任意）').fill(description);
    await page.getByRole('button', { name: '振込を実行' }).click();

    const result = page.locator('section.card').filter({ hasText: '振込結果' });
    await expect(result.getByText('振込が完了しました')).toBeVisible();
    await expect(result).toContainText(SAVINGS_ACCOUNT.number);
    await expect(result).toContainText(description);

    await page.getByRole('link', { name: 'ダッシュボードへ' }).click();
    await expect
      .poll(() => readMoney(accountCard(page, CHECKING_ACCOUNT.number).locator('.account-balance')))
      .toBe(checkingBefore - amount);
    await expect
      .poll(() => readMoney(accountCard(page, SAVINGS_ACCOUNT.number).locator('.account-balance')))
      .toBe(savingsBefore + amount);

    await accountCard(page, SAVINGS_ACCOUNT.number).click();
    await expect(page.getByRole('heading', { name: SAVINGS_ACCOUNT.name, level: 1 })).toBeVisible();
    const row = page.locator('.tx-row').filter({ hasText: description });
    await expect(row).toContainText(`振込元 ${CHECKING_ACCOUNT.number}`);
    await expect(row.locator('.tx-amount')).toHaveAttribute('data-direction', 'credit');
  });

  test('残高を超える金額を入力すると振込ボタンが押せない', async ({ page }) => {
    await page.goto('/transfer');
    await expect(page.getByLabel('送金元の口座')).toContainText(CHECKING_ACCOUNT.number);

    await page.getByLabel('振込先の口座番号').fill(SAVINGS_ACCOUNT.number);
    await page.getByLabel('金額').fill('999999999999');

    await expect(page.getByText('残高が不足しています')).toBeVisible();
    await expect(page.getByRole('button', { name: '振込を実行' })).toBeDisabled();
  });

  test('存在しない口座番号へは振込できない', async ({ page }) => {
    await page.goto('/transfer');
    await expect(page.getByLabel('送金元の口座')).toContainText(CHECKING_ACCOUNT.number);

    await page.getByLabel('振込先の口座番号').fill('9999-9999');
    await page.getByLabel('金額').fill('100');
    await expect(page.getByText('例: 1000-0002')).toBeVisible();
    await page.getByRole('button', { name: '振込を実行' }).click();

    await expect(page.locator('.alert[data-tone="error"]')).toHaveText('送金先の口座番号が見つかりません');
    await expect(page.getByText('振込が完了しました')).toHaveCount(0);
  });
});
