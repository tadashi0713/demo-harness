export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code = 'error',
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const badRequest = (message: string, code = 'bad_request') => new HttpError(400, message, code);
export const unauthorized = (message = '認証が必要です') => new HttpError(401, message, 'unauthorized');
export const forbidden = (message = 'この操作は許可されていません') => new HttpError(403, message, 'forbidden');
export const notFound = (message = 'リソースが見つかりません') => new HttpError(404, message, 'not_found');
export const conflict = (message: string, code = 'conflict') => new HttpError(409, message, code);
