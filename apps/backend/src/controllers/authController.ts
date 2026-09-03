import type { Request, Response } from "express";

import { env } from "../config/env.js";
import {
  createPasswordReset,
  login,
  resetPassword,
  revokeRefreshToken,
  rotateRefreshToken,
  signup,
  checkIdentity,
} from "../services/authService.js";
import { AppError, sendSuccess } from "../utils/http.js";

const meta = (request: Request) => ({
  userAgent: request.header("user-agent"),
  ip: request.ip,
});

export async function signupController(request: Request, response: Response) {
  return sendSuccess(
    response,
    await signup(request.body, meta(request)),
    "Account created",
    201,
  );
}

export async function checkIdentityController(request: Request, response: Response) {
  return sendSuccess(
    response,
    await checkIdentity(request.body.email),
    "Identity available",
  );
}
export async function loginController(request: Request, response: Response) {
  return sendSuccess(
    response,
    await login(request.body.identity, request.body.password, meta(request)),
    "Welcome back",
  );
}
export async function refreshController(request: Request, response: Response) {
  return sendSuccess(
    response,
    await rotateRefreshToken(request.body.refreshToken, meta(request)),
    "Session refreshed",
  );
}
export async function logoutController(request: Request, response: Response) {
  await revokeRefreshToken(request.body.refreshToken);
  return sendSuccess(response, null, "Signed out");
}
export async function forgotPasswordController(
  request: Request,
  response: Response,
) {
  const reset = await createPasswordReset(request.body.value);
  if (reset && env.NODE_ENV === "development")
    return sendSuccess(
      response,
      { delivery: "development", resetUrl: reset.resetUrl },
      "Password reset generated for development",
    );
  if (reset && env.NODE_ENV !== "development")
    throw new AppError(
      503,
      "Password email delivery is not configured yet",
      "EMAIL_DELIVERY_UNAVAILABLE",
    );
  return sendSuccess(
    response,
    { delivery: "not_applicable" },
    "If the account exists, password reset instructions will be sent",
  );
}
export async function resetPasswordController(
  request: Request,
  response: Response,
) {
  await resetPassword(request.body.token, request.body.password);
  return sendSuccess(response, null, "Password reset successfully");
}
