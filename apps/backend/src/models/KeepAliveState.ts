import { Schema, model } from "mongoose";

export type KeepAliveStateDocument = {
  _id: string;
  lastRealUserActivity: Date;
  lastKeepAliveAt: Date;
  keepAliveLockUntil?: Date | null;
};

const keepAliveStateSchema = new Schema<KeepAliveStateDocument>(
  {
    _id: { type: String, default: "global" },
    lastRealUserActivity: { type: Date, required: true, default: Date.now },
    lastKeepAliveAt: { type: Date, required: true, default: Date.now },
    keepAliveLockUntil: { type: Date, default: null },
  },
  {
    collection: "keepalivestates",
    versionKey: false,
  },
);

export const KeepAliveState = model<KeepAliveStateDocument>(
  "KeepAliveState",
  keepAliveStateSchema,
);
