import { model, Schema, Types } from "mongoose";

export interface IPushDevice {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  expoPushToken: string;
  deviceId?: string;
  platform?: string;
  active: boolean;
  lastSeenAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const pushDeviceSchema = new Schema<IPushDevice>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    expoPushToken: { type: String, required: true, unique: true },
    deviceId: { type: String },
    platform: { type: String },
    active: { type: Boolean, default: true },
    lastSeenAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// We want to easily find active tokens for a user
pushDeviceSchema.index({ user: 1, active: 1 });

export const PushDevice = model<IPushDevice>("PushDevice", pushDeviceSchema);
