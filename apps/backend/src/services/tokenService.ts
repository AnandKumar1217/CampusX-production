import crypto from "node:crypto";

import jwt, { type SignOptions } from "jsonwebtoken";

import { env } from "../config/env.js";

export type AccessPayload = { sub: string; type: "access" };
export type RefreshPayload = { sub: string; type: "refresh"; jti: string };

export function createAccessToken(userId: string) {
  return jwt.sign(
    { sub: userId, type: "access" } satisfies AccessPayload,
    env.JWT_ACCESS_SECRET,
    {
      expiresIn: env.JWT_ACCESS_TTL as SignOptions["expiresIn"],
      issuer: "campusx-api",
      audience: "campusx-mobile",
    },
  );
}

export function createRefreshToken(userId: string, jti: string) {
  return jwt.sign(
    { sub: userId, type: "refresh", jti } satisfies RefreshPayload,
    env.JWT_REFRESH_SECRET,
    {
      expiresIn: `${env.JWT_REFRESH_TTL_DAYS}d` as SignOptions["expiresIn"],
      issuer: "campusx-api",
      audience: "campusx-mobile",
    },
  );
}

export function verifyAccessToken(token: string) {
  return jwt.verify(token, env.JWT_ACCESS_SECRET, {
    issuer: "campusx-api",
    audience: "campusx-mobile",
  }) as AccessPayload;
}

export function verifyRefreshToken(token: string) {
  return jwt.verify(token, env.JWT_REFRESH_SECRET, {
    issuer: "campusx-api",
    audience: "campusx-mobile",
  }) as RefreshPayload;
}

export function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function randomResetToken() {
  return crypto.randomBytes(32).toString("base64url");
}
