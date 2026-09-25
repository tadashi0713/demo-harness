import { NextResponse } from 'next/server';

const notFound = async () =>
  NextResponse.json({ error: { code: 'not_found', message: 'エンドポイントが見つかりません' } }, { status: 404 });

export { notFound as GET, notFound as POST, notFound as PUT, notFound as PATCH, notFound as DELETE };
