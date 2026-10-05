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
  sendVerificationOtp,
  verifyForgotPasswordOtp,
} from "../services/authService.js";
import { AppError, sendSuccess } from "../utils/http.js";

const meta = (request: Request) => ({
  userAgent: request.header("user-agent"),
  ip: request.ip,
});

export async function signupController(request: Request, response: Response) {
  const result = await signup(request.body, meta(request));
  const io = request.app.get("io");
  if (io) {
    io.emit("user:registered", result.user);
  }
  return sendSuccess(
    response,
    result,
    "Account created",
    201,
  );
}

export async function checkIdentityController(request: Request, response: Response) {
  return sendSuccess(
    response,
    await checkIdentity(request.body.email, request.body.username, request.body.otp),
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
  const result = await createPasswordReset(request.body.value);
  return sendSuccess(
    response,
    result,
    "If the account exists, a password reset code will be sent",
  );
}
export async function verifyForgotPasswordOtpController(
  request: Request,
  response: Response,
) {
  const result = await verifyForgotPasswordOtp(request.body.email, request.body.otp);
  return sendSuccess(response, result, "Code verified successfully");
}
export async function sendVerificationOtpController(request: Request, response: Response) {
  await sendVerificationOtp(request.body.email);
  return sendSuccess(response, null, "Verification code sent");
}

export async function resetPasswordController(
  request: Request,
  response: Response,
) {
  await resetPassword(request.body.token, request.body.password);
  return sendSuccess(response, null, "Password reset successfully");
}
