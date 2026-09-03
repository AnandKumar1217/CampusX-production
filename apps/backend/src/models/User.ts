import {
  type HydratedDocument,
  type InferSchemaType,
  model,
  Schema,
} from "mongoose";

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    username: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
      index: true,
      minlength: 3,
      maxlength: 32,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
      index: true,
    },
    phone: { type: String, trim: true, sparse: true, unique: true },
    passwordHash: { type: String, required: true, select: false },
    avatarUrl: { type: String },
    bio: { type: String, maxlength: 300 },
    college: { type: String, required: true, trim: true },
    department: { type: String, required: true, trim: true },
    academicYear: { type: String, required: true },
    graduationYear: { type: String },
    interests: [{ type: String, trim: true }],
    verified: { type: Boolean, default: false },
    online: { type: Boolean, default: false },
    lastSeenAt: { type: Date },
    roles: { type: [String], default: ["student"] },
    passwordResetTokenHash: { type: String, select: false },
    passwordResetExpiresAt: { type: Date, select: false },
  },
  { timestamps: true, versionKey: false },
);

userSchema.index({
  name: "text",
  username: "text",
  college: "text",
  department: "text",
});

export type UserDocument = HydratedDocument<InferSchemaType<typeof userSchema>>;

export const User = model("User", userSchema);
