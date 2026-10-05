import { type HydratedDocument, type InferSchemaType, model, Schema } from "mongoose";

const otpSendWindowSchema = new Schema(
  {
    email: { type: String, required: true, trim: true, lowercase: true },
    purpose: { type: String, enum: ["signup_verification", "password_reset"], required: true },
    count: { type: Number, default: 1 },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
  },
  { timestamps: true, versionKey: false }
);

otpSendWindowSchema.index({ email: 1, purpose: 1 });

export type OtpSendWindowDocument = HydratedDocument<InferSchemaType<typeof otpSendWindowSchema>>;
export const OtpSendWindow = model("OtpSendWindow", otpSendWindowSchema);
