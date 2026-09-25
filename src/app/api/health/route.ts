import { NextResponse } from 'next/server';
import { config } from '@/server/config';
import { pool } from '@/server/db/pool';
import { route } from '@/server/route';

export const dynamic = 'force-dynamic';

export const GET = route(async () => {
  await pool.query('SELECT 1');
  return NextResponse.json({ status: 'ok', env: config.env });
});
