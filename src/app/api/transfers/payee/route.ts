import { NextResponse } from 'next/server';
import { requireAuth } from '@/server/auth';
import { route } from '@/server/route';
import { accountNumberSchema } from '@/server/schemas';
import { lookupPayee } from '@/server/services/transfers';

export const GET = route(async (req) => {
  requireAuth(req);
  const accountNumber = accountNumberSchema.parse(req.nextUrl.searchParams.get('accountNumber'));
  return NextResponse.json({ payee: await lookupPayee(accountNumber) });
});
