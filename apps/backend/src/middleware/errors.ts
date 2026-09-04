import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";

import { env } from "../config/env.js";
import { AppError } from "../utils/http.js";

export const notFound: RequestHandler = (request, _response, next) => {
  next(
    new AppError(
      404,
      `Route ${request.method} ${request.originalUrl} was not found`,
      "NOT_FOUND",
    ),
  );
};

export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  _request,
  response,
  _next,
) => {
  if (error instanceof ZodError) {
    const firstIssue = error.issues[0];
    const message = firstIssue 
      ? (String(firstIssue.path[firstIssue.path.length - 1]) + ": " + firstIssue.message)
      : "Validation failed";

    response
      .status(422)
      .json({
        success: false,
        message,
        code: "VALIDATION_ERROR",
        errors: error.issues,
      });
    return;
  }
  if (error instanceof AppError) {
    response
      .status(error.statusCode)
      .json({
        success: false,
        message: error.message,
        code: error.code,
        details: error.details,
      });
    return;
  }
  const message =
    error instanceof Error ? error.message : "Unexpected server error";
  response.status(500).json({
    success: false,
    message:
      env.NODE_ENV === "production" ? "Unexpected server error" : message,
    code: "INTERNAL_ERROR",
    ...(env.NODE_ENV === "development" && error instanceof Error
      ? { stack: error.stack }
      : {}),
  });
};
