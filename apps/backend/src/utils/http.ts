import type { NextFunction, Request, RequestHandler, Response } from "express";

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code = "APP_ERROR",
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

export const asyncHandler =
  (
    handler: (
      request: Request,
      response: Response,
      next: NextFunction,
    ) => Promise<unknown>,
  ): RequestHandler =>
  (request, response, next) => {
    void handler(request, response, next).catch(next);
  };

export function sendSuccess<T>(
  response: Response,
  data: T,
  message = "Success",
  statusCode = 200,
) {
  return response.status(statusCode).json({ success: true, data, message });
}
