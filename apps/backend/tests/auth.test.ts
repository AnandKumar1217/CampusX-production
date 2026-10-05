import { describe, it, expect, vi, beforeEach } from "vitest";
import * as authService from "../src/services/authService";
import { User } from "../src/models/User";
import { EmailOtp } from "../src/models/EmailOtp";
import { OtpSendWindow } from "../src/models/OtpSendWindow";
import { RefreshToken } from "../src/models/RefreshToken";
import * as emailService from "../src/services/emailService";
import { AppError } from "../src/utils/http";
import * as tokenService from "../src/services/tokenService";
import bcrypt from "bcryptjs";

vi.mock("../src/models/User", () => ({
  User: {
    exists: vi.fn(),
    findOne: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
  }
}));

vi.mock("../src/models/EmailOtp", () => ({
  EmailOtp: {
    findOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
    deleteMany: vi.fn(),
    deleteOne: vi.fn(),
    create: vi.fn(),
  }
}));

vi.mock("../src/models/OtpSendWindow", () => ({
  OtpSendWindow: {
    countDocuments: vi.fn(),
    create: vi.fn(),
  }
}));

vi.mock("../src/models/RefreshToken", () => ({
  RefreshToken: {
    create: vi.fn(),
    findOne: vi.fn(),
    updateMany: vi.fn(),
    updateOne: vi.fn(),
  }
}));

vi.mock("../src/services/emailService", () => ({
  sendSignupVerificationOtp: vi.fn(),
  sendPasswordResetOtp: vi.fn(),
}));

vi.mock("../src/services/tokenService", () => ({
  hashToken: vi.fn((token) => `hashed_${token}`),
  randomResetToken: vi.fn(() => "reset_token_123"),
  createAccessToken: vi.fn(),
  createRefreshToken: vi.fn(),
}));

vi.mock("nanoid", () => ({
  nanoid: () => "random_id"
}));

vi.mock("node:crypto", () => ({
  default: {
    randomInt: () => 123456
  },
  randomUUID: () => "uuid"
}));

describe("Auth Service Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("sendVerificationOtp", () => {
    it("60-second cooldown", async () => {
      vi.mocked(User.exists).mockResolvedValue(null);
      vi.mocked(EmailOtp.findOne).mockResolvedValue({ lastSentAt: new Date() } as any);
      
      await expect(authService.sendVerificationOtp("test@example.com"))
        .rejects.toThrowError(new AppError(429, "Please wait 60 seconds before requesting another code", "RATE_LIMIT"));
    });

    it("5 successful sends per rolling hour", async () => {
      vi.mocked(User.exists).mockResolvedValue(null);
      vi.mocked(EmailOtp.findOne).mockResolvedValue(null);
      vi.mocked(OtpSendWindow.countDocuments).mockResolvedValue(5);
      
      await expect(authService.sendVerificationOtp("test@example.com"))
        .rejects.toThrowError(new AppError(429, "Too many requests. Please try again later.", "RATE_LIMIT"));
    });

    it("purpose counters independent", async () => {
      vi.mocked(User.exists).mockResolvedValue(null);
      vi.mocked(EmailOtp.findOne).mockResolvedValue(null);
      vi.mocked(OtpSendWindow.countDocuments).mockImplementation(async (query: any) => {
        if (query.purpose === "signup_verification") return 0;
        return 5;
      });
      vi.mocked(EmailOtp.create).mockResolvedValue({ _id: "1" } as any);
      vi.mocked(emailService.sendSignupVerificationOtp).mockResolvedValue(true);
      
      await authService.sendVerificationOtp("test@example.com");
      expect(emailService.sendSignupVerificationOtp).toHaveBeenCalled();
    });

    it("Brevo non-2xx => 503 EMAIL_DELIVERY_FAILED", async () => {
      vi.mocked(User.exists).mockResolvedValue(null);
      vi.mocked(EmailOtp.findOne).mockResolvedValue(null);
      vi.mocked(OtpSendWindow.countDocuments).mockResolvedValue(0);
      vi.mocked(EmailOtp.create).mockResolvedValue({ _id: "1" } as any);
      
      vi.mocked(emailService.sendSignupVerificationOtp).mockRejectedValue(new AppError(503, "Failed to send email via provider", "EMAIL_DELIVERY_FAILED"));
      
      await expect(authService.sendVerificationOtp("test@example.com"))
        .rejects.toThrowError(new AppError(503, "Failed to send verification email. Please try again.", "EMAIL_DELIVERY_FAILED"));
      
      expect(EmailOtp.deleteOne).toHaveBeenCalledWith({ _id: "1" });
      expect(OtpSendWindow.create).not.toHaveBeenCalled();
    });
  });

  describe("createPasswordReset", () => {
    it("forgot-password unknown/existing externally indistinguishable", async () => {
      vi.mocked(EmailOtp.findOne).mockResolvedValue(null);
      vi.mocked(OtpSendWindow.countDocuments).mockResolvedValue(0);
      
      // Unknown user
      vi.mocked(User.findOne).mockResolvedValue(null);
      
      const res1 = await authService.createPasswordReset("unknown@example.com");
      expect(res1.message).toBe("If that account exists, we have sent a password reset email.");
      expect(OtpSendWindow.create).toHaveBeenCalled(); // dummy log
      
      vi.clearAllMocks();
      
      // Existing user
      vi.mocked(User.findOne).mockResolvedValue({ email: "known@example.com", name: "test" } as any);
      vi.mocked(EmailOtp.create).mockResolvedValue({ _id: "1" } as any);
      vi.mocked(emailService.sendPasswordResetOtp).mockResolvedValue(true);
      
      const res2 = await authService.createPasswordReset("known@example.com");
      expect(res2.message).toBe("If that account exists, we have sent a password reset email.");
      expect(OtpSendWindow.create).toHaveBeenCalled(); // real log
      expect(emailService.sendPasswordResetOtp).toHaveBeenCalled();
    });

    it("Brevo network failure => 503 EMAIL_DELIVERY_FAILED", async () => {
      vi.mocked(EmailOtp.findOne).mockResolvedValue(null);
      vi.mocked(OtpSendWindow.countDocuments).mockResolvedValue(0);
      vi.mocked(User.findOne).mockResolvedValue({ email: "known@example.com", name: "test" } as any);
      vi.mocked(EmailOtp.create).mockResolvedValue({ _id: "1" } as any);
      
      vi.mocked(emailService.sendPasswordResetOtp).mockRejectedValue(new AppError(503, "Network error", "EMAIL_DELIVERY_FAILED"));
      
      await expect(authService.createPasswordReset("known@example.com"))
        .rejects.toThrowError(new AppError(503, "Failed to send email. Please try again.", "EMAIL_DELIVERY_FAILED"));
    });
  });

  describe("checkIdentity (OTP validation)", () => {
    it("valid signup OTP", async () => {
      vi.mocked(User.exists).mockResolvedValue(null);
      vi.mocked(EmailOtp.findOne).mockResolvedValue({ 
        codeHash: "hashed_123456", 
        expiresAt: new Date(Date.now() + 10000) 
      } as any);
      
      const result = await authService.checkIdentity("test@example.com", undefined, "123456");
      expect(result.available).toBe(true);
    });

    it("wrong signup OTP", async () => {
      vi.mocked(User.exists).mockResolvedValue(null);
      const mockRecord = { 
        _id: "1",
        codeHash: "hashed_123456", 
        expiresAt: new Date(Date.now() + 10000),
        attempts: 0,
        save: vi.fn()
      };
      vi.mocked(EmailOtp.findOne).mockResolvedValue(mockRecord as any);
      
      await expect(authService.checkIdentity("test@example.com", undefined, "654321"))
        .rejects.toThrowError(new AppError(400, "Incorrect verification code", "INVALID_OTP"));
      expect(mockRecord.attempts).toBe(1);
    });

    it("5th failed attempt invalidates OTP", async () => {
      vi.mocked(User.exists).mockResolvedValue(null);
      const mockRecord = { 
        _id: "1",
        codeHash: "hashed_123456", 
        expiresAt: new Date(Date.now() + 10000),
        attempts: 4,
        save: vi.fn()
      };
      vi.mocked(EmailOtp.findOne).mockResolvedValue(mockRecord as any);
      
      await expect(authService.checkIdentity("test@example.com", undefined, "654321"))
        .rejects.toThrowError(new AppError(400, "Too many attempts. Please request a new code.", "TOO_MANY_ATTEMPTS"));
      expect(EmailOtp.deleteOne).toHaveBeenCalledWith({ _id: "1" });
    });
    
    it("expired OTP", async () => {
      vi.mocked(User.exists).mockResolvedValue(null);
      const mockRecord = { 
        codeHash: "hashed_123456", 
        expiresAt: new Date(Date.now() - 10000), // expired
      };
      vi.mocked(EmailOtp.findOne).mockResolvedValue(mockRecord as any);
      
      await expect(authService.checkIdentity("test@example.com", undefined, "123456"))
        .rejects.toThrowError(new AppError(400, "Verification code is invalid or expired", "INVALID_OTP"));
    });
  });

  describe("verifyForgotPasswordOtp & resetPassword", () => {
    it("valid reset OTP returns reset token", async () => {
      const mockRecord = { 
        _id: "1",
        codeHash: "hashed_123456", 
        expiresAt: new Date(Date.now() + 10000),
        attempts: 0
      };
      vi.mocked(EmailOtp.findOneAndUpdate).mockResolvedValue(mockRecord as any);
      const mockUser = {
        save: vi.fn()
      };
      vi.mocked(User.findOne).mockResolvedValue(mockUser as any);
      
      const result = await authService.verifyForgotPasswordOtp("test@example.com", "123456");
      expect(result.resetToken).toBe("reset_token_123");
      expect(EmailOtp.deleteOne).toHaveBeenCalledWith({ _id: "1" });
    });

    it("reset token one-time use and revokes refresh tokens", async () => {
      const mockUser = {
        _id: "u1",
        passwordResetTokenHash: "hashed_token123",
        passwordResetExpiresAt: new Date(Date.now() + 10000),
        save: vi.fn()
      };
      vi.mocked(User.findOne).mockReturnValue({
        select: vi.fn().mockResolvedValue(mockUser)
      } as any);
      
      await authService.resetPassword("token123", "NewPass123!");
      
      // Token cleared
      expect(mockUser.passwordResetTokenHash).toBeUndefined();
      expect(mockUser.passwordResetExpiresAt).toBeUndefined();
      
      // Refresh tokens revoked
      expect(RefreshToken.updateMany).toHaveBeenCalledWith(
        { user: "u1", revokedAt: { $exists: false } },
        { $set: { revokedAt: expect.any(Date) } }
      );
    });
  });
  
  describe("login behavior", () => {
    it("legacy user with missing emailVerified can login", async () => {
      const mockUser = {
        _id: "u1",
        passwordHash: "legacy_pass",
        emailVerified: undefined // Legacy missing
      };
      vi.mocked(User.findOne).mockReturnValue({
        select: vi.fn().mockResolvedValue(mockUser)
      } as any);
      
      vi.spyOn(bcrypt, "compare").mockResolvedValue(true as never);
      
      const session = await authService.login("test", "legacy_pass", {});
      expect(session).toBeDefined();
    });

    it("explicit emailVerified=false user cannot login", async () => {
      const mockUser = {
        _id: "u1",
        passwordHash: "legacy_pass",
        emailVerified: false // Explicit false
      };
      vi.mocked(User.findOne).mockReturnValue({
        select: vi.fn().mockResolvedValue(mockUser)
      } as any);
      
      vi.spyOn(bcrypt, "compare").mockResolvedValue(true as never);
      
      await expect(authService.login("test", "legacy_pass", {}))
        .rejects.toThrowError(new AppError(403, "Please verify your email before logging in", "EMAIL_NOT_VERIFIED"));
    });
  });
});
