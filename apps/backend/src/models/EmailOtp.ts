import { type HydratedDocument, type InferSchemaType, model, Schema } from "mongoose";

const emailOtpSchema = new Schema(
  {
    email: { type: String, required: true, trim: true, lowercase: true },
    purpose: { type: String, enum: ["signup_verification", "password_reset"], required: true },
    codeHash: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
    attempts: { type: Number, default: 0 },
    resendCount: { type: Number, default: 1 },
    lastSentAt: { type: Date, default: Date.now },
  },
  { timestamps: true, versionKey: false }
);

emailOtpSchema.index({ email: 1, purpose: 1 });

export type EmailOtpDocument = HydratedDocument<InferSchemaType<typeof emailOtpSchema>>;
export const EmailOtp = model("EmailOtp", emailOtpSchema);
