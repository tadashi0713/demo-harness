import { NextResponse } from 'next/server';
import { z } from 'zod';
import { signToken } from '@/server/auth';
import { readJson, route } from '@/server/route';
import { authenticate } from '@/server/services/users';

const loginSchema = z.object({
  email: z.string().email('メールアドレスの形式が正しくありません'),
  password: z.string().min(1, 'パスワードを入力してください'),
});

export const POST = route(async (req) => {
  const input = loginSchema.parse(await readJson(req));
  const user = await authenticate(input.email, input.password);
  return NextResponse.json({ token: signToken({ id: user.id, email: user.email }), user });
});
