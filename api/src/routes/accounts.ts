import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../lib/async-handler';
import { currentUser, requireAuth } from '../middleware/auth';
import { deposit, getAccount, listAccounts, listTransactions } from '../services/accounts';

const uuid = z.string().uuid('ID の形式が正しくありません');

const depositSchema = z.object({
  amount: z.number().int('金額は整数で指定してください').positive('金額は 1 以上で指定してください'),
  description: z.string().max(120).optional(),
});

const querySchema = z.object({
  accountId: uuid.optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const accountsRouter = Router();

accountsRouter.use(requireAuth);

accountsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const accounts = await listAccounts(currentUser(req).id);
    const totalBalance = accounts.reduce((sum, account) => sum + account.balance, 0);
    res.json({ accounts, totalBalance });
  }),
);

accountsRouter.get(
  '/:accountId',
  asyncHandler(async (req, res) => {
    const accountId = uuid.parse(req.params.accountId);
    const account = await getAccount(currentUser(req).id, accountId);
    res.json({ account });
  }),
);

accountsRouter.get(
  '/:accountId/transactions',
  asyncHandler(async (req, res) => {
    const userId = currentUser(req).id;
    const accountId = uuid.parse(req.params.accountId);
    const { limit } = querySchema.parse(req.query);
    await getAccount(userId, accountId); // 所有者チェック
    const transactions = await listTransactions(userId, { accountId, limit: limit ?? 50 });
    res.json({ transactions });
  }),
);

accountsRouter.post(
  '/:accountId/deposit',
  asyncHandler(async (req, res) => {
    const accountId = uuid.parse(req.params.accountId);
    const input = depositSchema.parse(req.body);
    const result = await deposit(currentUser(req).id, accountId, input.amount, input.description ?? '');
    res.status(201).json(result);
  }),
);
