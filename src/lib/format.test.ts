import { describe, expect, it } from 'vitest';
import { formatDate, formatDateTime, formatMoney, formatSignedMoney } from './format';

describe('formatMoney', () => {
  it('JPY を円記号と桁区切りで表示する', () => {
    expect(formatMoney(1234567)).toBe('￥1,234,567');
  });

  it('0 円を表示できる', () => {
    expect(formatMoney(0)).toBe('￥0');
  });

  it('JPY 以外の通貨も指定できる', () => {
    expect(formatMoney(1500, 'USD')).toBe('$1,500.00');
  });
});

describe('formatSignedMoney', () => {
  it('入金 (credit) には + を付ける', () => {
    expect(formatSignedMoney(1000, 'credit')).toBe('+￥1,000');
  });

  it('出金 (debit) には - を付ける', () => {
    expect(formatSignedMoney(1000, 'debit')).toBe('-￥1,000');
  });
});

describe('日付のフォーマット', () => {
  const iso = '2026-09-25T03:04:00.000Z';

  it('formatDateTime は年月日と時分を表示する', () => {
    expect(formatDateTime(iso)).toBe('2026/09/25 12:04');
  });

  it('formatDate は月日を表示する', () => {
    expect(formatDate(iso)).toBe('9月25日');
  });
});
