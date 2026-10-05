import { Router } from "express";
import rateLimit from "express-rate-limit";

import {
  forgotPasswordController,
  loginController,
  logoutController,
  refreshController,
  resetPasswordController,
  signupController,
  checkIdentityController,
  sendVerificationOtpController,
  verifyForgotPasswordOtpController,
  checkUsernameController,
} from "../controllers/authController.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../utils/http.js";
import {
  forgotSchema,
  loginSchema,
  refreshSchema,
  resetSchema,
  signupSchema,
  checkIdentitySchema,
  sendVerificationOtpSchema,
  verifyForgotPasswordOtpSchema,
  checkUsernameSchema,
} from "../validators/auth.js";

const authLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skip: (req) => req.path === "/login",
});
export const authRouter = Router();
authRouter.use(authLimiter);
authRouter.post(
  "/signup",
  validate(signupSchema),
  asyncHandler(signupController),
);
authRouter.post(
  "/check-identity",
  validate(checkIdentitySchema),
  asyncHandler(checkIdentityController),
);
authRouter.post(
  "/check-username",
  validate(checkUsernameSchema),
  asyncHandler(checkUsernameController),
);
authRouter.post("/login", validate(loginSchema), asyncHandler(loginController));
authRouter.post(
  "/refresh",
  validate(refreshSchema),
  asyncHandler(refreshController),
);
authRouter.post(
  "/logout",
  validate(refreshSchema),
  asyncHandler(logoutController),
);
authRouter.post(
  "/forgot-password",
  validate(forgotSchema),
  asyncHandler(forgotPasswordController),
);
authRouter.post(
  "/verify-forgot-password-otp",
  validate(verifyForgotPasswordOtpSchema),
  asyncHandler(verifyForgotPasswordOtpController),
);
authRouter.post(
  "/reset-password",
  validate(resetSchema),
  asyncHandler(resetPasswordController),
);
authRouter.post(
  "/send-verification-otp",
  validate(sendVerificationOtpSchema),
  asyncHandler(sendVerificationOtpController),
);
