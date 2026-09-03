import { model, Schema } from "mongoose";

const objectId = Schema.Types.ObjectId;
const locationSharingSchema = new Schema(
  {
    user: {
      type: objectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    enabled: { type: Boolean, default: false },
    ghostMode: { type: Boolean, default: false },
    friendsOnly: { type: Boolean, default: true },
    groupsAllowed: { type: Boolean, default: false },
    highAccuracy: { type: Boolean, default: false },
    updateFrequencyMinutes: { type: Number, default: 15 },
    point: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: { type: [Number], default: [0, 0] },
    },
    updatedAt: Date,
  },
  { timestamps: true, versionKey: false },
);
locationSharingSchema.index({ point: "2dsphere" });

const aiConversationSchema = new Schema(
  {
    user: { type: objectId, ref: "User", required: true, index: true },
    title: { type: String, required: true },
    messages: [
      {
        role: {
          type: String,
          enum: ["system", "user", "assistant"],
          required: true,
        },
        content: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true, versionKey: false },
);
aiConversationSchema.index({ user: 1, updatedAt: -1 });

export const LocationSharing = model("LocationSharing", locationSharingSchema);
export const AIConversation = model("AIConversation", aiConversationSchema);
