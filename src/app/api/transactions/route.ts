import { NextResponse } from 'next/server';
import { requireAuth } from '@/server/auth';
import { route } from '@/server/route';
import { limitSchema } from '@/server/schemas';
import { listTransactions } from '@/server/services/accounts';

// 全口座を横断した最近の取引（ダッシュボード用）
export const GET = route(async (req) => {
  const userId = requireAuth(req).id;
  const limit = limitSchema.parse(req.nextUrl.searchParams.get('limit') ?? undefined);
  const transactions = await listTransactions(userId, { limit: limit ?? 10 });
  return NextResponse.json({ transactions });
});
