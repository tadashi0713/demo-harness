import { NextResponse, type NextRequest } from 'next/server';
import { ZodError } from 'zod';
import { badRequest, HttpError } from './http-error';

export function errorResponse(error: unknown): NextResponse {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          code: 'validation_error',
          message: '入力値が不正です',
          details: error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        },
      },
      { status: 400 },
    );
  }

  if (error instanceof HttpError) {
    return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.status });
  }

  console.error('[api] 未処理のエラー', error);
  return NextResponse.json(
    { error: { code: 'internal_error', message: 'サーバーエラーが発生しました' } },
    { status: 500 },
  );
}

/** Route Handler を包み、例外を API 共通のエラー JSON に変換する。 */
export function route<P extends Record<string, string> = Record<string, string>>(
  handler: (req: NextRequest, params: P) => Promise<Response>,
) {
  return async (req: NextRequest, context: { params: Promise<P> }): Promise<Response> => {
    try {
      return await handler(req, await context.params);
    } catch (error) {
      return errorResponse(error);
    }
  };
}

export async function readJson(req: NextRequest): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw badRequest('リクエストボディが JSON ではありません', 'invalid_json');
  }
}
