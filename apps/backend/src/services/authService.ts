import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";

import { env } from "../config/env.js";
import { RefreshToken } from "../models/RefreshToken.js";
import { User } from "../models/User.js";
import { AppError } from "../utils/http.js";
import {
  createAccessToken,
  createRefreshToken,
  hashToken,
  randomResetToken,
  verifyRefreshToken,
} from "./tokenService.js";

type SessionMeta = { userAgent?: string; ip?: string };
type AuthUser = {
  _id: { toString(): string };
  name: string;
  username: string;
  email: string;
  phone?: string | null;
  passwordHash: string;
  avatarUrl?: string | null;
  bio?: string | null;
  college: string;
  department: string;
  academicYear: string;
  graduationYear?: string | null;
  interests: string[];
  verified: boolean;
};
type SignupInput = {
  fullName: string;
  email: string;
  password: string;
  college: string;
  department: string;
  academicYear: string;
  graduationYear?: string;
  interests?: string[];
};

function safeUser(user: AuthUser) {
  return {
    id: user._id.toString(),
    name: user.name,
    username: user.username,
    email: user.email,
    phone: user.phone,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    college: user.college,
    department: user.department,
    academicYear: user.academicYear,
    graduationYear: user.graduationYear,
    interests: user.interests,
    verified: user.verified,
  };
}

async function issueSession(user: AuthUser, meta: SessionMeta) {
  const jti = nanoid(24);
  const accessToken = createAccessToken(user._id.toString());
  const refreshToken = createRefreshToken(user._id.toString(), jti);
  const expiresAt = new Date(
    Date.now() + env.JWT_REFRESH_TTL_DAYS * 86_400_000,
  );
  await RefreshToken.create({
    user: user._id,
    tokenHash: hashToken(refreshToken),
    expiresAt,
    ...meta,
  });
  return { user: safeUser(user), accessToken, refreshToken };
}

export async function checkIdentity(identityRaw: string) {
  const identity = identityRaw.trim().toLowerCase();
  const isEmail = identity.includes("@");
  const email = isEmail ? identity : `${identity}@phone.campusx.local`;
  const phone = isEmail ? undefined : identity;

  if (await User.exists({ $or: [{ email }, ...(phone ? [{ phone }] : [])] }))
    throw new AppError(
      409,
      "An account with this email or phone already exists",
      "EMAIL_EXISTS",
    );
  return { available: true };
}

export async function signup(input: SignupInput, meta: SessionMeta) {
  await checkIdentity(input.email);
  
  const identity = input.email.trim().toLowerCase();
  const isEmail = identity.includes("@");
  const email = isEmail ? identity : `${identity}@phone.campusx.local`;
  const phone = isEmail ? undefined : identity;
  const baseUsername =
    input.fullName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ".")
      .replace(/^\.|\.$/g, "")
      .slice(0, 22) || "student";
  const username = `${baseUsername}.${nanoid(5).toLowerCase()}`;
  const passwordHash = await bcrypt.hash(input.password, 12);
  const user = await User.create({
    name: input.fullName.trim(),
    email,
    phone,
    username,
    passwordHash,
    college: input.college.trim(),
    department: input.department.trim(),
    academicYear: input.academicYear,
    graduationYear: input.graduationYear,
    interests: input.interests ?? [],
  });
  return issueSession(user, meta);
}

export async function login(
  identity: string,
  password: string,
  meta: SessionMeta,
) {
  const normalized = identity.trim().toLowerCase();
  const user = await User.findOne({
    $or: [
      { email: normalized },
      { username: normalized },
      { phone: identity.trim() },
    ],
  }).select("+passwordHash");
  if (!user || !(await bcrypt.compare(password, user.passwordHash)))
    throw new AppError(401, "Invalid login details", "INVALID_CREDENTIALS");
  return issueSession(user, meta);
}

export async function rotateRefreshToken(rawToken: string, meta: SessionMeta) {
  let payload;
  try {
    payload = verifyRefreshToken(rawToken);
  } catch {
    throw new AppError(
      401,
      "Refresh token is invalid or expired",
      "INVALID_REFRESH_TOKEN",
    );
  }
  if (payload.type !== "refresh")
    throw new AppError(401, "Invalid refresh token", "INVALID_REFRESH_TOKEN");
  const tokenHash = hashToken(rawToken);
  const stored = await RefreshToken.findOne({
    tokenHash,
    revokedAt: { $exists: false },
    expiresAt: { $gt: new Date() },
  });
  if (!stored)
    throw new AppError(
      401,
      "Refresh token has already been used or revoked",
      "REFRESH_TOKEN_REUSED",
    );
  const user = await User.findById(payload.sub);
  if (!user)
    throw new AppError(401, "Account no longer exists", "ACCOUNT_NOT_FOUND");
  const next = await issueSession(user, meta);
  stored.revokedAt = new Date();
  stored.replacedByHash = hashToken(next.refreshToken);
  await stored.save();
  return next;
}

export async function revokeRefreshToken(rawToken: string) {
  await RefreshToken.updateOne(
    { tokenHash: hashToken(rawToken), revokedAt: { $exists: false } },
    { $set: { revokedAt: new Date() } },
  );
}

export async function createPasswordReset(identifier: string) {
  const normalized = identifier.trim().toLowerCase();
  const user = await User.findOne({
    $or: [
      { email: normalized },
      { username: normalized },
      { phone: identifier.trim() },
    ],
  }).select("+passwordResetTokenHash +passwordResetExpiresAt");
  if (!user) return null;
  const token = randomResetToken();
  user.passwordResetTokenHash = hashToken(token);
  user.passwordResetExpiresAt = new Date(Date.now() + 30 * 60_000);
  await user.save();
  return { user, token, resetUrl: `${env.PASSWORD_RESET_URL}?token=${token}` };
}

export async function resetPassword(token: string, password: string) {
  const user = await User.findOne({
    passwordResetTokenHash: hashToken(token),
    passwordResetExpiresAt: { $gt: new Date() },
  }).select("+passwordResetTokenHash +passwordResetExpiresAt +passwordHash");
  if (!user)
    throw new AppError(
      400,
      "Password reset link is invalid or expired",
      "INVALID_RESET_TOKEN",
    );
  user.passwordHash = await bcrypt.hash(password, 12);
  user.passwordResetTokenHash = undefined;
  user.passwordResetExpiresAt = undefined;
  await user.save();
  await RefreshToken.updateMany(
    { user: user._id, revokedAt: { $exists: false } },
    { $set: { revokedAt: new Date() } },
  );
}
