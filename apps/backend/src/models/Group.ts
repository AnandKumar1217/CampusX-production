import { model, Schema } from "mongoose";

const objectId = Schema.Types.ObjectId;
const groupSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, index: true },
    description: { type: String, maxlength: 1000 },
    avatarUrl: String,
    avatarPublicId: String,
    category: String,
    privacy: { type: String, enum: ["public", "private"], default: "public" },
    owner: { type: objectId, ref: "User", required: true },
    memberCount: { type: Number, default: 1 },
  },
  { timestamps: true, versionKey: false },
);
groupSchema.index({ name: "text", description: "text", category: "text" });

const membershipSchema = new Schema(
  {
    group: { type: objectId, ref: "Group", required: true, index: true },
    user: { type: objectId, ref: "User", required: true, index: true },
    role: {
      type: String,
      enum: ["owner", "admin", "moderator", "member"],
      default: "member",
    },
    status: {
      type: String,
      enum: ["active", "invited", "requested"],
      default: "active",
    },
    invitedBy: { type: objectId, ref: "User" },
  },
  { timestamps: true, versionKey: false },
);
membershipSchema.index({ group: 1, user: 1 }, { unique: true });

const pollSchema = new Schema(
  {
    group: { type: objectId, ref: "Group", required: true, index: true },
    author: { type: objectId, ref: "User", required: true },
    question: { type: String, required: true, maxlength: 400 },
    options: [
      {
        label: { type: String, required: true },
        voters: [{ type: objectId, ref: "User" }],
      },
    ],
    multiple: { type: Boolean, default: false },
    closesAt: Date,
    closedAt: Date,
  },
  { timestamps: true, versionKey: false },
);
pollSchema.index({ group: 1, createdAt: -1 });

const groupFileSchema = new Schema(
  {
    group: { type: objectId, ref: "Group", required: true, index: true },
    uploadedBy: { type: objectId, ref: "User", required: true },
    name: { type: String, required: true },
    url: { type: String, required: true },
    mimeType: String,
    size: Number,
    folder: String,
  },
  { timestamps: true, versionKey: false },
);

const studySessionSchema = new Schema(
  {
    group: { type: objectId, ref: "Group", required: true, index: true },
    createdBy: { type: objectId, ref: "User", required: true },
    title: { type: String, required: true },
    description: String,
    startsAt: { type: Date, required: true, index: true },
    endsAt: Date,
    location: String,
    meetingUrl: String,
    attendees: [{ type: objectId, ref: "User" }],
  },
  { timestamps: true, versionKey: false },
);

const groupMessageSchema = new Schema(
  {
    group: { type: objectId, ref: "Group", required: true, index: true },
    sender: { type: objectId, ref: "User", required: true, index: true },
    text: { type: String, maxlength: 4000, default: "" },
    attachments: [{ url: String, name: String, mimeType: String, size: Number }],
    nonce: { type: String, maxlength: 100 },
    deletedAt: Date,
  },
  { timestamps: true, versionKey: false },
);
groupMessageSchema.index({ group: 1, createdAt: -1 });

export const Group = model("Group", groupSchema);
export const GroupMembership = model("GroupMembership", membershipSchema);
export const Poll = model("Poll", pollSchema);
export const GroupFile = model("GroupFile", groupFileSchema);
export const StudySession = model("StudySession", studySessionSchema);
export const GroupMessage = model("GroupMessage", groupMessageSchema);
