import { NextResponse } from 'next/server';
import { requireAuth } from '@/server/auth';
import { route } from '@/server/route';
import { listAccounts } from '@/server/services/accounts';

export const GET = route(async (req) => {
  const accounts = await listAccounts(requireAuth(req).id);
  const totalBalance = accounts.reduce((sum, account) => sum + account.balance, 0);
  return NextResponse.json({ accounts, totalBalance });
});
