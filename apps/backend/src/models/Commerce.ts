import { model, Schema } from "mongoose";

const objectId = Schema.Types.ObjectId;
const eventSchema = new Schema(
  {
    title: { type: String, required: true, index: true },
    description: { type: String, maxlength: 5000 },
    imageUrl: String,
    category: { type: String, index: true },
    startsAt: { type: Date, required: true, index: true },
    endsAt: Date,
    location: {
      name: String,
      coordinates: { type: [Number], index: "2dsphere" },
    },
    creator: { type: objectId, ref: "User", required: true },
    attendees: [
      {
        user: { type: objectId, ref: "User" },
        status: { type: String, enum: ["going", "maybe"] },
      },
    ],
    draft: { type: Boolean, default: false },
  },
  { timestamps: true, versionKey: false },
);

const listingSchema = new Schema(
  {
    seller: { type: objectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, index: true },
    description: { type: String, maxlength: 4000 },
    category: { type: String, required: true, index: true },
    price: { type: Number, required: true, min: 0 },
    negotiable: { type: Boolean, default: true },
    images: [String],
    condition: String,
    location: String,
    status: {
      type: String,
      enum: ["active", "sold", "draft"],
      default: "active",
      index: true,
    },
  },
  { timestamps: true, versionKey: false },
);
listingSchema.index({ title: "text", description: "text", category: "text" });

const timetableEntrySchema = new Schema(
  {
    user: { type: objectId, ref: "User", required: true, index: true },
    subject: { type: String, required: true },
    room: String,
    lecturer: String,
    days: [{ type: Number, min: 0, max: 6 }],
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    color: String,
    repeat: {
      type: String,
      enum: ["none", "weekly", "custom"],
      default: "weekly",
    },
  },
  { timestamps: true, versionKey: false },
);
timetableEntrySchema.index({ user: 1, days: 1, startTime: 1 });

export const Event = model("Event", eventSchema);
export const MarketplaceListing = model("MarketplaceListing", listingSchema);
export const TimetableEntry = model("TimetableEntry", timetableEntrySchema);
