import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import crypto, { randomUUID } from "node:crypto";

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
import { sendSignupVerificationOtp, sendPasswordResetOtp } from "./emailService.js";
import { EmailOtp } from "../models/EmailOtp.js";

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
  interests: string[];
  verified: boolean;
  qrToken?: string | null;
  emailVerified?: boolean;
};
type SignupInput = {
  fullName: string;
  username: string;
  email: string;
  password: string;
  college: string;
  department: string;
  academicYear: string;
  interests?: string[];
  otp: string;
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
    interests: user.interests,
    verified: user.verified,
    qrToken: user.qrToken,
    emailVerified: user.emailVerified,
  };
}

function generateOtp() {
  return crypto.randomInt(100000, 1000000).toString();
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

export async function checkIdentity(identityRaw: string, usernameRaw?: string, otpRaw?: string) {
  const email = identityRaw.trim().toLowerCase();

  if (await User.exists({ email }))
    throw new AppError(
      409,
      "An account with this email already exists",
      "EMAIL_EXISTS",
    );

  if (usernameRaw) {
    const username = usernameRaw.trim().toLowerCase();
    if (await User.exists({ username })) {
      const suggestions: string[] = [];
      let attempts = 0;
      while (suggestions.length < 3 && attempts < 20) {
        const randomNum = Math.floor(Math.random() * 999) + 1;
        const suggestion = `${username}${randomNum}`;
        if (!(await User.exists({ username: suggestion })) && !suggestions.includes(suggestion)) {
          suggestions.push(suggestion);
        }
        attempts++;
      }
      throw new AppError(409, "Username is already taken", "USERNAME_TAKEN", { suggestions });
    }
  }

  if (otpRaw) {
    const record = await EmailOtp.findOne({ email, purpose: "signup_verification" });
    if (!record || record.expiresAt < new Date()) {
      throw new AppError(400, "Verification code is invalid or expired", "INVALID_OTP");
    }
    if (record.codeHash !== hashToken(otpRaw)) {
      record.attempts += 1;
      if (record.attempts > 5) {
        await EmailOtp.deleteOne({ _id: record._id });
        throw new AppError(400, "Too many attempts. Please request a new code.", "TOO_MANY_ATTEMPTS");
      }
      await record.save();
      throw new AppError(400, "Incorrect verification code", "INVALID_OTP");
    }
  }

  return { available: true };
}

export async function generateUniqueQrToken(): Promise<string> {
  const maxRetries = 3;
  for (let i = 0; i < maxRetries; i++) {
    const token = randomUUID();
    const exists = await User.exists({ qrToken: token });
    if (!exists) return token;
  }
  throw new AppError(500, "Could not generate unique QR identity.", "QR_GENERATION_FAILED");
}

export async function signup(input: SignupInput, meta: SessionMeta) {
  await checkIdentity(input.email, input.username, input.otp);
  
  const email = input.email.trim().toLowerCase();
  
  // OTP is verified, delete it
  await EmailOtp.deleteMany({ email, purpose: "signup_verification" });

  const username = input.username.trim().toLowerCase();
  const passwordHash = await bcrypt.hash(input.password, 12);
  const user = await User.create({
    name: input.fullName.trim(),
    email,
    username,
    passwordHash,
    college: input.college.trim(),
    department: input.department.trim(),
    academicYear: input.academicYear,
    interests: input.interests ?? [],
    qrToken: await generateUniqueQrToken(),
    emailVerified: true,
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
    ],
  }).select("+passwordHash");
  let passwordMatches = false;
  if (user) {
    try {
      passwordMatches = await bcrypt.compare(password, user.passwordHash);
    } catch {
      passwordMatches = false;
    }
    
    // Legacy plain-text or dummy fallback migration
    if (!passwordMatches && user.passwordHash === password) {
      passwordMatches = true;
      user.passwordHash = await bcrypt.hash(password, 12);
      await user.save();
    }
  }

  if (!user || !passwordMatches)
    throw new AppError(401, "Invalid login details", "INVALID_CREDENTIALS");
    
  if (user.emailVerified === false) {
    throw new AppError(403, "Please verify your email before logging in", "EMAIL_NOT_VERIFIED");
  }
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
  });
  if (!user) return null;
  
  const otp = generateOtp();
  await EmailOtp.deleteMany({ email: user.email, purpose: "password_reset" });
  await EmailOtp.create({
    email: user.email,
    purpose: "password_reset",
    codeHash: hashToken(otp),
    expiresAt: new Date(Date.now() + 10 * 60_000),
  });

  // Fire and forget
  sendPasswordResetOtp(user.email, otp, user.name).catch(() => {});

  return { email: user.email };
}

export async function verifyForgotPasswordOtp(emailRaw: string, otp: string) {
  const email = emailRaw.trim().toLowerCase();
  
  // Prevent brute force by incrementing attempts
  const record = await EmailOtp.findOneAndUpdate(
    { email, purpose: "password_reset" },
    { $inc: { attempts: 1 } },
    { new: true }
  );

  if (!record || record.expiresAt < new Date()) {
    throw new AppError(400, "Verification code is invalid or expired", "INVALID_OTP");
  }

  if (record.attempts > 5) {
    await EmailOtp.deleteOne({ _id: record._id });
    throw new AppError(400, "Too many attempts. Please request a new code.", "TOO_MANY_ATTEMPTS");
  }

  if (record.codeHash !== hashToken(otp)) {
    throw new AppError(400, "Incorrect verification code", "INVALID_OTP");
  }

  // OTP valid!
  await EmailOtp.deleteOne({ _id: record._id });

  const user = await User.findOne({ email });
  if (!user) throw new AppError(400, "User not found", "USER_NOT_FOUND");

  const resetToken = randomResetToken();
  user.passwordResetTokenHash = hashToken(resetToken);
  user.passwordResetExpiresAt = new Date(Date.now() + 30 * 60_000);
  await user.save();

  return { resetToken };
}

export async function sendVerificationOtp(emailRaw: string) {
  const email = emailRaw.trim().toLowerCase();
  
  if (await User.exists({ email })) {
    throw new AppError(409, "An account with this email already exists", "EMAIL_EXISTS");
  }

  // Rate limit resends slightly
  const recent = await EmailOtp.findOne({ email, purpose: "signup_verification" });
  if (recent && recent.lastSentAt > new Date(Date.now() - 60_000)) {
    throw new AppError(429, "Please wait before requesting another code", "RATE_LIMIT");
  }

  const otp = generateOtp();
  await EmailOtp.deleteMany({ email, purpose: "signup_verification" });
  await EmailOtp.create({
    email,
    purpose: "signup_verification",
    codeHash: hashToken(otp),
    expiresAt: new Date(Date.now() + 10 * 60_000),
  });

  sendSignupVerificationOtp(email, otp).catch(() => {});
}

export async function verifyEmail(emailRaw: string, otp: string) {
  const email = emailRaw.trim().toLowerCase();
  
  const record = await EmailOtp.findOneAndUpdate(
    { email, purpose: "signup_verification" },
    { $inc: { attempts: 1 } },
    { new: true }
  );

  if (!record || record.expiresAt < new Date()) {
    throw new AppError(400, "Verification code is invalid or expired", "INVALID_OTP");
  }

  if (record.attempts > 5) {
    await EmailOtp.deleteOne({ _id: record._id });
    throw new AppError(400, "Too many attempts. Please request a new code.", "TOO_MANY_ATTEMPTS");
  }

  if (record.codeHash !== hashToken(otp)) {
    throw new AppError(400, "Incorrect verification code", "INVALID_OTP");
  }

  const user = await User.findOne({ email });
  if (!user) throw new AppError(400, "User not found", "USER_NOT_FOUND");

  user.emailVerified = true;
  await user.save();
  await EmailOtp.deleteOne({ _id: record._id });

  return { success: true };
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
