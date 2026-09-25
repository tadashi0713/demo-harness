import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../lib/async-handler';
import { currentUser, requireAuth } from '../middleware/auth';
import { createTransfer, lookupPayee } from '../services/transfers';

const accountNumber = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{4}$/, '口座番号は 0000-0000 の形式で入力してください');

const transferSchema = z.object({
  fromAccountId: z.string().uuid('送金元の口座を選択してください'),
  toAccountNumber: accountNumber,
  amount: z.number().int('金額は整数で指定してください').positive('金額は 1 以上で指定してください'),
  description: z.string().max(120).optional(),
});

export const transfersRouter = Router();

transfersRouter.use(requireAuth);

transfersRouter.get(
  '/payee',
  asyncHandler(async (req, res) => {
    const number = accountNumber.parse(req.query.accountNumber);
    res.json({ payee: await lookupPayee(number) });
  }),
);

transfersRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const input = transferSchema.parse(req.body);
    const transfer = await createTransfer({
      userId: currentUser(req).id,
      fromAccountId: input.fromAccountId,
      toAccountNumber: input.toAccountNumber,
      amount: input.amount,
      description: input.description ?? '',
    });
    res.status(201).json({ transfer });
  }),
);
