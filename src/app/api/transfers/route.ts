import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/server/auth';
import { readJson, route } from '@/server/route';
import { accountNumberSchema, amountSchema } from '@/server/schemas';
import { createTransfer } from '@/server/services/transfers';

const transferSchema = z.object({
  fromAccountId: z.string().uuid('送金元の口座を選択してください'),
  toAccountNumber: accountNumberSchema,
  amount: amountSchema,
  description: z.string().max(120).optional(),
});

export const POST = route(async (req) => {
  const userId = requireAuth(req).id;
  const input = transferSchema.parse(await readJson(req));
  const transfer = await createTransfer({
    userId,
    fromAccountId: input.fromAccountId,
    toAccountNumber: input.toAccountNumber,
    amount: input.amount,
    description: input.description ?? '',
  });
  return NextResponse.json({ transfer }, { status: 201 });
});
