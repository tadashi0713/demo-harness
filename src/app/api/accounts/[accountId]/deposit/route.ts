import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/server/auth';
import { readJson, route } from '@/server/route';
import { accountIdSchema, amountSchema } from '@/server/schemas';
import { deposit } from '@/server/services/accounts';

const depositSchema = z.object({
  amount: amountSchema,
  description: z.string().max(120).optional(),
});

export const POST = route<{ accountId: string }>(async (req, params) => {
  const userId = requireAuth(req).id;
  const accountId = accountIdSchema.parse(params.accountId);
  const input = depositSchema.parse(await readJson(req));
  const result = await deposit(userId, accountId, input.amount, input.description ?? '');
  return NextResponse.json(result, { status: 201 });
});
