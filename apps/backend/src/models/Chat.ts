import { model, Schema } from "mongoose";

const objectId = Schema.Types.ObjectId;
const conversationSchema = new Schema(
  {
    type: {
      type: String,
      enum: ["direct", "group"],
      default: "direct",
      index: true,
    },
    participants: [{ type: objectId, ref: "User", required: true }],
    participantMetadata: [
      {
        user: { type: objectId, ref: "User" },
        muted: { type: Boolean, default: false },
        pinned: { type: Boolean, default: false },
        archived: { type: Boolean, default: false },
        unreadCount: { type: Number, default: 0 },
        lastReadAt: { type: Date },
      }
    ],
    title: String,
    description: String,
    avatarUrl: String,
    admins: [{ type: objectId, ref: "User" }],
    createdBy: { type: objectId, ref: "User", required: true },
    lastMessageAt: { type: Date, index: true },
    lastMessage: { type: objectId, ref: "Message" },
  },
  { timestamps: true, versionKey: false },
);
conversationSchema.index({ participants: 1, lastMessageAt: -1 });
conversationSchema.index({ "participantMetadata.user": 1 });

const messageSchema = new Schema(
  {
    conversation: {
      type: objectId,
      ref: "Conversation",
      required: true,
      index: true,
    },
    sender: { type: objectId, ref: "User", required: true, index: true },
    text: { type: String, maxlength: 4000, default: "" },
    attachments: [
      { url: String, name: String, mimeType: String, size: Number },
    ],
    replyTo: { type: objectId, ref: "Message" },
    reactions: [
      {
        emoji: String,
        user: { type: objectId, ref: "User" }
      }
    ],
    deliveredTo: [{ user: { type: objectId, ref: "User" }, deliveredAt: Date }],
    readBy: [{ user: { type: objectId, ref: "User" }, readAt: Date }],
    editedAt: Date,
    deletedAt: Date,
  },
  { timestamps: true, versionKey: false },
);
messageSchema.index({ conversation: 1, createdAt: -1 });

export const Conversation = model("Conversation", conversationSchema);
export const Message = model("Message", messageSchema);
