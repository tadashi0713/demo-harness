import { NextResponse } from 'next/server';
import { requireAuth } from '@/server/auth';
import { route } from '@/server/route';
import { accountIdSchema, limitSchema } from '@/server/schemas';
import { getAccount, listTransactions } from '@/server/services/accounts';

export const GET = route<{ accountId: string }>(async (req, params) => {
  const userId = requireAuth(req).id;
  const accountId = accountIdSchema.parse(params.accountId);
  const limit = limitSchema.parse(req.nextUrl.searchParams.get('limit') ?? undefined);
  await getAccount(userId, accountId); // 所有者チェック
  const transactions = await listTransactions(userId, { accountId, limit: limit ?? 50 });
  return NextResponse.json({ transactions });
});
