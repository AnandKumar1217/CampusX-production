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
    enabled: { type: Boolean, default: true },
    ghostMode: { type: Boolean, default: false },
    friendsOnly: { type: Boolean, default: true },
    groupsAllowed: { type: Boolean, default: false },
    highAccuracy: { type: Boolean, default: false },
    updateFrequencyMinutes: { type: Number, default: 1 },
    point: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: { type: [Number], default: [0, 0] },
    },
    accuracy: { type: Number },
    heading: { type: Number },
    speed: { type: Number },
    source: { type: String, enum: ["foreground", "background", "manual", "on_demand"] },
    positionUpdatedAt: Date,
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

const holidaySchema = new Schema(
  {
    name: { type: String, required: true },
    date: { type: String, required: true, index: true },
    type: { 
      type: String, 
      enum: ["national", "festival", "college", "optional"], 
      required: true 
    },
    description: { type: String },
  },
  { timestamps: true, versionKey: false },
);

export const LocationSharing = model("LocationSharing", locationSharingSchema);
export const AIConversation = model("AIConversation", aiConversationSchema);
export const Holiday = model("Holiday", holidaySchema);
