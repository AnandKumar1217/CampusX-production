import mongoose, { Document, Schema } from "mongoose";

export interface IKeepAliveState extends Document {
  id: string;
  lastRealUserActivity: number;
  lastKeepAliveAt: number;
}

const keepAliveStateSchema = new Schema<IKeepAliveState>({
  id: { type: String, required: true, unique: true, index: true },
  lastRealUserActivity: { type: Number, default: 0 },
  lastKeepAliveAt: { type: Number, default: 0 },
});

export const KeepAliveState = mongoose.model<IKeepAliveState>("KeepAliveState", keepAliveStateSchema);
