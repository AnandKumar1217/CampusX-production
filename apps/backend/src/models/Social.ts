import { model, Schema } from "mongoose";

const objectId = Schema.Types.ObjectId;

const friendshipSchema = new Schema(
  {
    users: [{ type: objectId, ref: "User", required: true }],
    createdBy: { type: objectId, ref: "User", required: true },
  },
  { timestamps: true, versionKey: false },
);
friendshipSchema.index({ users: 1 });

const friendRequestSchema = new Schema(
  {
    requester: { type: objectId, ref: "User", required: true, index: true },
    recipient: { type: objectId, ref: "User", required: true, index: true },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected", "cancelled"],
      default: "pending",
      index: true,
    },
  },
  { timestamps: true, versionKey: false },
);
friendRequestSchema.index({ requester: 1, recipient: 1 }, { unique: true });

const postSchema = new Schema(
  {
    author: { type: objectId, ref: "User", required: true, index: true },
    body: { type: String, maxlength: 2000, default: "" },
    media: [{ url: String, type: { type: String, enum: ["image", "video"] } }],
    visibility: {
      type: String,
      enum: ["public", "friends", "group"],
      default: "public",
    },
    group: { type: objectId, ref: "Group" },
    location: {
      name: String,
      coordinates: { type: [Number], index: "2dsphere" },
    },
    tags: [String],
    reactionCount: { type: Number, default: 0 },
    commentCount: { type: Number, default: 0 },
    deletedAt: Date,
  },
  { timestamps: true, versionKey: false },
);
postSchema.index({ author: 1, createdAt: -1 });
postSchema.index({ visibility: 1, createdAt: -1 });

const commentSchema = new Schema(
  {
    post: { type: objectId, ref: "Post", required: true, index: true },
    author: { type: objectId, ref: "User", required: true },
    body: { type: String, required: true, maxlength: 1000 },
    parent: { type: objectId, ref: "Comment" },
  },
  { timestamps: true, versionKey: false },
);
commentSchema.index({ post: 1, createdAt: 1 });

const reactionSchema = new Schema(
  {
    post: { type: objectId, ref: "Post", required: true, index: true },
    user: { type: objectId, ref: "User", required: true, index: true },
    type: {
      type: String,
      enum: ["like", "love", "fire", "celebrate"],
      required: true,
    },
  },
  { timestamps: true, versionKey: false },
);
reactionSchema.index({ post: 1, user: 1 }, { unique: true });

const storySchema = new Schema(
  {
    author: { type: objectId, ref: "User", required: true, index: true },
    mediaUrl: { type: String, required: true },
    mediaType: { type: String, enum: ["image", "video"], default: "image" },
    caption: { type: String, maxlength: 300 },
    expiresAt: { type: Date, required: true, expires: 0 },
    viewers: [{ user: { type: objectId, ref: "User" }, viewedAt: Date }],
  },
  { timestamps: true, versionKey: false },
);

const savedItemSchema = new Schema(
  {
    user: { type: objectId, ref: "User", required: true, index: true },
    itemType: {
      type: String,
      enum: ["post", "listing", "event"],
      required: true,
    },
    item: { type: objectId, required: true },
  },
  { timestamps: true, versionKey: false },
);
savedItemSchema.index({ user: 1, itemType: 1, item: 1 }, { unique: true });

const notificationSchema = new Schema(
  {
    user: { type: objectId, ref: "User", required: true, index: true },
    actor: { type: objectId, ref: "User" },
    type: { type: String, required: true, index: true },
    title: { type: String, required: true },
    body: { type: String },
    readAt: { type: Date },
    target: { route: String, params: Schema.Types.Mixed },
  },
  { timestamps: true, versionKey: false },
);
notificationSchema.index({ user: 1, readAt: 1, createdAt: -1 });

export const Friendship = model("Friendship", friendshipSchema);
export const FriendRequest = model("FriendRequest", friendRequestSchema);
export const Post = model("Post", postSchema);
export const Comment = model("Comment", commentSchema);
export const Reaction = model("Reaction", reactionSchema);
export const Story = model("Story", storySchema);
export const SavedItem = model("SavedItem", savedItemSchema);
export const Notification = model("Notification", notificationSchema);
