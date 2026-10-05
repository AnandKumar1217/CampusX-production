import { env } from "../config/env.js";
import { AppError } from "../utils/http.js";

const BREVO_URL = "https://api.brevo.com/v3/smtp/email";

export async function sendEmail({
  to,
  subject,
  htmlContent,
  textContent,
}: {
  to: { email: string; name?: string }[];
  subject: string;
  htmlContent: string;
  textContent: string;
}) {
  if (!env.BREVO_API_KEY || !env.BREVO_SENDER_EMAIL) {
    console.warn("[EmailService] BREVO_API_KEY or BREVO_SENDER_EMAIL is missing. Email not sent.");
    throw new AppError(503, "Email service is not configured", "EMAIL_DELIVERY_FAILED");
  }

  try {
    const response = await fetch(BREVO_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": env.BREVO_API_KEY,
        Accept: "application/json",
      },
      body: JSON.stringify({
        sender: {
          name: env.BREVO_SENDER_NAME,
          email: env.BREVO_SENDER_EMAIL,
        },
        to,
        subject,
        htmlContent,
        textContent,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[EmailService] Brevo API Error:", response.status, errorText);
      throw new AppError(503, "Failed to send email via provider", "EMAIL_DELIVERY_FAILED");
    }

    return true;
  } catch (error) {
    if (error instanceof AppError) throw error;
    console.error("[EmailService] Failed to send email:", error);
    throw new AppError(503, "Network error while sending email", "EMAIL_DELIVERY_FAILED");
  }
}

export async function sendSignupVerificationOtp(email: string, otp: string, name?: string) {
  const subject = "Verify your CampusX email";
  const textContent = `Your CampusX verification code is: ${otp}\n\nThis code expires in 10 minutes.\n\nNever share this code with anyone.\n\nIf you did not request this, you can safely ignore this email.`;
  const htmlContent = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
      <h2 style="color: #6366f1;">CampusX</h2>
      <h3>Verify your email</h3>
      <p>Your CampusX verification code is:</p>
      <div style="background: #f4f4f5; padding: 16px; font-size: 24px; font-weight: bold; letter-spacing: 4px; text-align: center; border-radius: 8px; margin: 24px 0;">
        ${otp}
      </div>
      <p>This code expires in 10 minutes.</p>
      <p><strong>Never share this code with anyone.</strong></p>
      <p style="font-size: 12px; color: #71717a; margin-top: 32px;">If you did not request this, you can safely ignore this email.</p>
    </div>
  `;

  return sendEmail({
    to: [{ email, name }],
    subject,
    textContent,
    htmlContent,
  });
}

export async function sendPasswordResetOtp(email: string, otp: string, name?: string) {
  const subject = "Reset your CampusX password";
  const textContent = `Your CampusX password reset code is: ${otp}\n\nThis code expires in 10 minutes.\n\nThis code can be used to reset your CampusX password.\n\nNever share this code with anyone.\n\nIf you did not request this, you can safely ignore this email.`;
  const htmlContent = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
      <h2 style="color: #6366f1;">CampusX</h2>
      <h3>Reset your password</h3>
      <p>Your CampusX password reset code is:</p>
      <div style="background: #f4f4f5; padding: 16px; font-size: 24px; font-weight: bold; letter-spacing: 4px; text-align: center; border-radius: 8px; margin: 24px 0;">
        ${otp}
      </div>
      <p>This code expires in 10 minutes.</p>
      <p>This code can be used to reset your CampusX password.</p>
      <p><strong>Never share this code with anyone.</strong></p>
      <p style="font-size: 12px; color: #71717a; margin-top: 32px;">If you did not request this, you can safely ignore this email.</p>
    </div>
  `;

  return sendEmail({
    to: [{ email, name }],
    subject,
    textContent,
    htmlContent,
  });
}
