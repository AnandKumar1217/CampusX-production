import type { RequestHandler } from "express";

import { User } from "../models/User.js";
import { verifyAccessToken } from "../services/tokenService.js";
import { AppError, asyncHandler } from "../utils/http.js";

export const authenticate: RequestHandler = asyncHandler(
  async (request, _response, next) => {
    const authorization = request.header("authorization");
    if (!authorization?.startsWith("Bearer "))
      throw new AppError(401, "Authentication is required", "AUTH_REQUIRED");
    let payload;
    try {
      payload = verifyAccessToken(authorization.slice(7));
    } catch {
      throw new AppError(
        401,
        "Access token is invalid or expired",
        "INVALID_ACCESS_TOKEN",
      );
    }
    if (payload.type !== "access")
      throw new AppError(401, "Invalid access token", "INVALID_ACCESS_TOKEN");
    const user = await User.findById(payload.sub).select("name username email avatarUrl");
    if (!user)
      throw new AppError(401, "Account no longer exists", "ACCOUNT_NOT_FOUND");
    request.user = user;
    next();
  },
);
