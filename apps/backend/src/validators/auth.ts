import { z } from "zod";

const password = z
  .string()
  .min(8)
  .max(128)
  .regex(/[A-Za-z]/, "Password must contain a letter")
  .regex(/[0-9]/, "Password must contain a number");
const params = z.object({}).passthrough();
const query = z.object({}).passthrough();

export const signupSchema = z.object({
  params,
  query,
  body: z.object({
    fullName: z.string().min(2).max(80),
    username: z.string().min(3).max(30).regex(/^[a-z0-9_.]+$/, "Username can only contain lowercase letters, numbers, dots, and underscores"),
    email: z.string().min(5).max(120),
    password,
    college: z.string().min(2).max(120),
    department: z.string().min(2).max(100),
    academicYear: z.string().min(1).max(30),
    interests: z.array(z.string().max(50)).max(20).default([]),
    otp: z.string().length(6),
  }),
});
export const checkIdentitySchema = z.object({
  params,
  query,
  body: z.object({
    email: z.string().min(5).max(120),
    username: z.string().min(3).max(30).regex(/^[a-z0-9_.]+$/, "Username can only contain lowercase letters, numbers, dots, and underscores").optional(),
    otp: z.string().length(6).optional(),
  }),
});
export const loginSchema = z.object({
  params,
  query,
  body: z.object({
    identity: z.string().min(3).max(120),
    password: z.string().min(1).max(128),
  }),
});
export const refreshSchema = z.object({
  params,
  query,
  body: z.object({ refreshToken: z.string().min(20) }),
});
export const forgotSchema = z.object({
  params,
  query,
  body: z.object({
    value: z.string().min(3).max(120),
    method: z.enum(["email", "username", "phone"]).optional(),
  }),
});
export const resetSchema = z.object({
  params,
  query,
  body: z.object({ token: z.string().min(20), password }),
});
export const sendVerificationOtpSchema = z.object({
  params,
  query,
  body: z.object({ email: z.string().min(5).max(120) }),
});
export const verifyEmailSchema = z.object({
  params,
  query,
  body: z.object({ email: z.string().min(5).max(120), otp: z.string().length(6) }),
});
export const verifyForgotPasswordOtpSchema = z.object({
  params,
  query,
  body: z.object({ email: z.string().min(5).max(120), otp: z.string().length(6) }),
});
