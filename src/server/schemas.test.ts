import { describe, expect, it } from 'vitest';
import { accountIdSchema, accountNumberSchema, amountSchema, limitSchema } from './schemas';

describe('accountIdSchema', () => {
  it('UUID を受け付ける', () => {
    expect(accountIdSchema.safeParse('3f1c2b9e-8a4d-4f5e-9c7b-1a2b3c4d5e6f').success).toBe(true);
  });

  it('UUID 以外は拒否する', () => {
    const result = accountIdSchema.safeParse('not-a-uuid');
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('ID の形式が正しくありません');
  });
});

describe('accountNumberSchema', () => {
  it('0000-0000 形式を受け付け、前後の空白を除去する', () => {
    expect(accountNumberSchema.parse('  1000-0002 ')).toBe('1000-0002');
  });

  it.each(['10000002', '1000-002', 'abcd-efgh', '1000-00021'])('%s は拒否する', (value) => {
    expect(accountNumberSchema.safeParse(value).success).toBe(false);
  });
});

describe('amountSchema', () => {
  it('正の整数を受け付ける', () => {
    expect(amountSchema.parse(1)).toBe(1);
  });

  it.each([
    [0, '金額は 1 以上で指定してください'],
    [-100, '金額は 1 以上で指定してください'],
    [1.5, '金額は整数で指定してください'],
  ])('%s は拒否する', (value, message) => {
    const result = amountSchema.safeParse(value);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(message);
  });

  it('文字列は拒否する', () => {
    expect(amountSchema.safeParse('100').success).toBe(false);
  });
});

describe('limitSchema', () => {
  it('クエリ文字列を数値に変換する', () => {
    expect(limitSchema.parse('50')).toBe(50);
  });

  it('未指定を許容する', () => {
    expect(limitSchema.parse(undefined)).toBeUndefined();
  });

  it.each(['0', '101', '1.5', 'abc'])('%s は拒否する', (value) => {
    expect(limitSchema.safeParse(value).success).toBe(false);
  });
});
