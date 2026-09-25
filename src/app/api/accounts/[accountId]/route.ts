import { NextResponse } from 'next/server';
import { requireAuth } from '@/server/auth';
import { route } from '@/server/route';
import { accountIdSchema } from '@/server/schemas';
import { getAccount } from '@/server/services/accounts';

export const GET = route<{ accountId: string }>(async (req, params) => {
  const accountId = accountIdSchema.parse(params.accountId);
  const account = await getAccount(requireAuth(req).id, accountId);
  return NextResponse.json({ account });
});
