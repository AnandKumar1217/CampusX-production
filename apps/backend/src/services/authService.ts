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
import { OtpSendWindow } from "../models/OtpSendWindow.js";

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
  emailVerified?: boolean | null;
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
      if (record.attempts >= 5) {
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

  // OTP is verified and user created successfully, delete OTP
  await EmailOtp.deleteMany({ email, purpose: "signup_verification" });

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

async function enforceSendLimits(email: string, purpose: "password_reset" | "signup_verification") {
  const recent = await EmailOtp.findOne({ email, purpose });
  if (recent && recent.lastSentAt > new Date(Date.now() - 60_000)) {
    throw new AppError(429, "Please wait 60 seconds before requesting another code", "RATE_LIMIT");
  }

  const oneHourAgo = new Date(Date.now() - 60 * 60_000);
  const sendCount = await OtpSendWindow.countDocuments({ email, purpose, createdAt: { $gt: oneHourAgo } });
  if (sendCount >= 5) {
    throw new AppError(429, "Too many requests. Please try again later.", "RATE_LIMIT");
  }
}

export async function createPasswordReset(identifier: string) {
  const normalized = identifier.trim().toLowerCase();
  
  await enforceSendLimits(normalized, "password_reset");

  const user = await User.findOne({
    $or: [
      { email: normalized },
      { username: normalized },
      { phone: normalized },
    ],
  });

  if (!user) {
    // Dummy rate-limit increment to make response indistinguishable for unknown users
    await OtpSendWindow.create({ email: normalized, purpose: "password_reset", expiresAt: new Date(Date.now() + 60 * 60_000) });
    await EmailOtp.deleteMany({ email: normalized, purpose: "password_reset" });
    await EmailOtp.create({
      email: normalized,
      purpose: "password_reset",
      codeHash: "dummy",
      expiresAt: new Date(Date.now() + 10 * 60_000),
    });
    return { message: "If that account exists, we have sent a password reset email." };
  }
  
  const email = user.email;

  if (email !== normalized) {
    await enforceSendLimits(email, "password_reset");
  }

  const otp = generateOtp();
  await EmailOtp.deleteMany({ email, purpose: "password_reset" });
  const otpRecord = await EmailOtp.create({
    email,
    purpose: "password_reset",
    codeHash: hashToken(otp),
    expiresAt: new Date(Date.now() + 10 * 60_000),
  });

  try {
    await sendPasswordResetOtp(email, otp, user.name);
  } catch (error) {
    await EmailOtp.deleteOne({ _id: otpRecord._id });
    console.error(`[AuthService] Password reset email delivery failed for ${email}:`, error);
    // DO NOT throw error. Return generic response to prevent account enumeration.
    return { message: "If that account exists, we have sent a password reset email." };
  }

  await OtpSendWindow.create({ email, purpose: "password_reset", expiresAt: new Date(Date.now() + 60 * 60_000) });
  if (email !== normalized) {
    await OtpSendWindow.create({ email: normalized, purpose: "password_reset", expiresAt: new Date(Date.now() + 60 * 60_000) });
  }

  return { message: "If that account exists, we have sent a password reset email." };
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

  if (record.attempts >= 5) {
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

  await enforceSendLimits(email, "signup_verification");

  const otp = generateOtp();
  await EmailOtp.deleteMany({ email, purpose: "signup_verification" });
  const otpRecord = await EmailOtp.create({
    email,
    purpose: "signup_verification",
    codeHash: hashToken(otp),
    expiresAt: new Date(Date.now() + 10 * 60_000),
  });

  try {
    await sendSignupVerificationOtp(email, otp);
  } catch (error) {
    await EmailOtp.deleteOne({ _id: otpRecord._id });
    throw new AppError(503, "Failed to send verification email. Please try again.", "EMAIL_DELIVERY_FAILED");
  }

  await OtpSendWindow.create({ email, purpose: "signup_verification", expiresAt: new Date(Date.now() + 60 * 60_000) });
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
