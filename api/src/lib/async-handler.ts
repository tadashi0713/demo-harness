import type { NextFunction, Request, RequestHandler, Response } from 'express';

/** async ハンドラの例外を Express のエラーハンドラへ渡す。 */
export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}
