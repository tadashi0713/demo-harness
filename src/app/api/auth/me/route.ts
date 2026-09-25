import { NextResponse } from 'next/server';
import { requireAuth } from '@/server/auth';
import { unauthorized } from '@/server/http-error';
import { route } from '@/server/route';
import { getUserById } from '@/server/services/users';

export const GET = route(async (req) => {
  const user = await getUserById(requireAuth(req).id);
  if (!user) throw unauthorized('ユーザーが見つかりません');
  return NextResponse.json({ user });
});
