import type { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Wraps an async route so a rejected promise reaches Express's error pipeline.
 *
 * Express 4 does not await handlers: an unhandled rejection inside a route
 * would leave the request hanging until it times out, with no error response.
 * Every async route must be wrapped.
 */
export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    void handler(req, res, next).catch(next);
  };
}
