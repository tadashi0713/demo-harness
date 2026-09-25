import { z } from 'zod';

export const accountIdSchema = z.string().uuid('ID の形式が正しくありません');

export const accountNumberSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{4}$/, '口座番号は 0000-0000 の形式で入力してください');

export const limitSchema = z.coerce.number().int().min(1).max(100).optional();

export const amountSchema = z
  .number()
  .int('金額は整数で指定してください')
  .positive('金額は 1 以上で指定してください');
