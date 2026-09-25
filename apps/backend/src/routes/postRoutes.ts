import { Router } from "express";
import type { Request } from "express";
import { isValidObjectId } from "mongoose";
import { z } from "zod";

import { Comment, Notification, Post, Reaction, SavedItem, Friendship } from "../models/Social.js";
import { GroupMembership } from "../models/Group.js";
import { cloudinaryService } from "../services/cloudinary.js";
import { AppError, asyncHandler, sendSuccess } from "../utils/http.js";
import { pagination } from "../utils/pagination.js";
import { pushService } from "../services/pushService.js";

export async function formatPosts(posts: any[], userId: string | undefined) {
  if (!posts.length) return [];
  const postIds = posts.map(p => p._id);
  const [reactions, saved] = await Promise.all([
    userId ? Reaction.find({ post: { $in: postIds }, user: userId, type: "like" }) : Promise.resolve([]),
    userId ? SavedItem.find({ item: { $in: postIds }, itemType: "post", user: userId }) : Promise.resolve([]),
  ]);
  const likedSet = new Set(reactions.map(r => r.post.toString()));
  const savedSet = new Set(saved.map(s => s.item.toString()));
  
  return posts.map(p => {
    const doc = p.toObject ? p.toObject() : p;
    return {
      ...doc,
      id: doc._id.toString(),
      liked: likedSet.has(doc._id.toString()),
      saved: savedSet.has(doc._id.toString()),
      reactions: doc.reactionCount || 0,
      comments: doc.commentCount || 0,
      image: doc.media?.[0]?.url,
    };
  });
}

export const postRouter = Router();

// The feed contains public posts plus content this account is allowed to see.
// Reuse the same filter for detail and interaction endpoints so a guessed ID
// cannot bypass the feed's visibility rules.
async function readablePostFilter(userId: string) {
  const [friendships, memberships] = await Promise.all([
    Friendship.find({ users: userId }).select("users"),
    GroupMembership.find({ user: userId, status: "active" }).select("group"),
  ]);
  const friendIds = friendships.flatMap((friendship) => friendship.users)
    .filter((id) => id.toString() !== userId);
  const groupIds = memberships.map((membership) => membership.group);
  return {
    deletedAt: { $exists: false },
    $or: [
      { visibility: "public" },
      { author: userId },
      { visibility: "friends", author: { $in: friendIds } },
      { visibility: "group", group: { $in: groupIds } },
    ],
  };
}

async function emitPostEvent(request: Request, post: any, event: string) {
  const io = request.app.get("io");
  const postId = post._id.toString();
  const authorId = post.author.toString();
  const payload = { postId, authorId, ...(post.group ? { groupId: post.group.toString() } : {}) };
  if (post.visibility === "public") {
    io?.emit(event, payload);
    return;
  }
  const recipients = new Set([authorId]);
  if (post.visibility === "group" && post.group) {
    const members = await GroupMembership.find({ group: post.group, status: "active" }).select("user");
    members.forEach((member) => recipients.add(member.user.toString()));
  } else if (post.visibility === "friends") {
    const friendships = await Friendship.find({ users: post.author }).select("users");
    friendships.flatMap((friendship) => friendship.users)
      .forEach((id) => recipients.add(id.toString()));
  }
  recipients.forEach((id) => io?.to(`user:${id}`).emit(event, payload));
}

postRouter.get(
  "/",
  asyncHandler(async (request, response) => {
    const { page, limit, skip } = pagination(request.query);
    const filter = await readablePostFilter(request.user!._id.toString());
    const [items, total] = await Promise.all([
      Post.find(filter)
        .populate(
          "author",
          "name username avatarUrl department academicYear verified",
        )
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Post.countDocuments(filter),
    ]);
    const formattedItems = await formatPosts(items, request.user?._id?.toString());
    return sendSuccess(response, { items: formattedItems, page, limit, total });
  }),
);

postRouter.get(
  "/my",
  asyncHandler(async (request, response) => {
    const items = await Post.find({
      author: request.user!._id,
      deletedAt: { $exists: false },
    })
      .populate("author", "name username avatarUrl department academicYear verified")
      .sort({ createdAt: -1 });
    const formattedItems = await formatPosts(items, request.user!._id.toString());
    return sendSuccess(response, formattedItems);
  }),
);

postRouter.get(
  "/saved",
  asyncHandler(async (request, response) => {
    const saved = await SavedItem.find({
      user: request.user!._id,
      itemType: "post",
    }).sort({ createdAt: -1 });
    const postIds = saved.map(s => s.item);
    const readable = await readablePostFilter(request.user!._id.toString());
    
    const items = await Post.find({
      ...readable,
      _id: { $in: postIds },
    })
      .populate("author", "name username avatarUrl department academicYear verified");
      
    const itemMap = new Map(items.map(item => [item._id.toString(), item]));
    const sortedItems = postIds.map(id => itemMap.get(id.toString())).filter(Boolean);

    const formattedItems = await formatPosts(sortedItems, request.user!._id.toString());
    return sendSuccess(response, formattedItems);
  }),
);

postRouter.post(
  "/",
  asyncHandler(async (request, response) => {
    const input = z
      .object({
        body: z.string().max(2000).default(""),
        visibility: z.enum(["public", "friends", "group"]).default("public"),
        media: z
          .array(
            z.object({
              url: z.string().url(),
              type: z.enum(["image", "video"]),
              publicId: z.string().optional(),
              width: z.number().optional(),
              height: z.number().optional(),
              format: z.string().optional(),
              bytes: z.number().optional(),
            })
          )
          .max(5)
          .default([]),
        group: z.string().optional(),
        location: z
          .object({
            name: z.string(),
            coordinates: z.tuple([z.number(), z.number()]),
          })
          .optional(),
        tags: z.array(z.string().max(50)).max(20).default([]),
      })
      .refine(
        (value) => value.body.trim() || value.media.length,
        "Post needs text or media",
      )
      .refine(
        (value) => {
          if (value.visibility === "group" && !value.group) return false;
          if (value.visibility !== "group" && value.group) return false;
          return true;
        },
        "Group ID is required for group posts and must not be provided for non-group posts"
      )
      .parse(request.body);

    if (input.visibility === "group") {
      const membership = await GroupMembership.exists({ group: input.group, user: request.user!._id, status: "active" });
      if (!membership) throw new AppError(403, "You must be an active member of the group to post in it", "FORBIDDEN");
    }

    const item = await Post.create({ ...input, author: request.user!._id });
    
    await emitPostEvent(request, item, "post:created");

    return sendSuccess(response, item, "Post created", 201);
  }),
);

postRouter.get(
  "/:id",
  asyncHandler(async (request, response) => {
    if (!isValidObjectId(request.params.id))
      throw new AppError(400, "Invalid post id", "INVALID_ID");
    const readable = await readablePostFilter(request.user!._id.toString());
    const [post, comments] = await Promise.all([
      Post.findOne({
        ...readable,
        _id: request.params.id,
      }).populate(
        "author",
        "name username avatarUrl department academicYear verified",
      ),
      Comment.find({ post: request.params.id })
        .populate("author", "name username avatarUrl")
        .sort({ createdAt: 1 })
        .limit(100),
    ]);
    if (!post) throw new AppError(404, "Post not found", "POST_NOT_FOUND");
    const [formattedPost] = await formatPosts([post], request.user?._id?.toString());
    return sendSuccess(response, { post: formattedPost, comments });
  }),
);

postRouter.delete(
  "/:id",
  asyncHandler(async (request, response) => {
    const item = await Post.findOneAndUpdate(
      {
        _id: request.params.id,
        author: request.user!._id,
        deletedAt: { $exists: false },
      },
      { $set: { deletedAt: new Date() } },
      { new: true },
    );
    if (!item)
      throw new AppError(
        404,
        "Post not found or not owned by you",
        "POST_NOT_FOUND",
      );

    if (item.media && item.media.length > 0) {
      const publicIds = item.media.map((m: any) => m.publicId).filter(Boolean);
      for (const pid of publicIds) {
        await cloudinaryService.deleteImage(pid).catch((err) => console.error("Cloudinary cleanup failed:", err));
      }
    }

    await Promise.all([
      Comment.deleteMany({ post: request.params.id }),
      Reaction.deleteMany({ post: request.params.id }),
      SavedItem.deleteMany({ itemType: "post", item: request.params.id }),
    ]);
    await emitPostEvent(request, item, "post:deleted");

    return sendSuccess(response, null, "Post deleted");
  }),
);

postRouter.post(
  "/:id/comments",
  asyncHandler(async (request, response) => {
    const { body, parent } = z
      .object({
        body: z.string().min(1).max(1000),
        parent: z.string().optional(),
      })
      .parse(request.body);
    const readable = await readablePostFilter(request.user!._id.toString());
    const post = await Post.findOne({
      ...readable,
      _id: request.params.id,
    });
    if (!post) throw new AppError(404, "Post not found", "POST_NOT_FOUND");
    const comment = await Comment.create({
      post: request.params.id,
      author: request.user!._id,
      body,
      parent,
    });
    await Post.updateOne(
      { _id: request.params.id },
      { $inc: { commentCount: 1 } },
    );
    await emitPostEvent(request, post, "post:comment");
    if (post.author.toString() !== request.user!._id.toString()) {
      const notification = await Notification.findOneAndUpdate(
        { user: post.author, actor: request.user!._id, type: "post_comment", "target.params.postId": post._id.toString() },
        {
          $set: {
            title: `${request.user!.name} commented on your post`,
            target: { route: "PostDetails", params: { postId: post._id.toString() } }
          },
          $unset: { readAt: "" }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      ).populate("actor", "name username avatarUrl");
      request.app.get("io")?.to(`user:${post.author.toString()}`).emit("notification:new", notification);
      
      void pushService.sendPushNotification(post.author, {
        title: notification.title,
        body: "Tap to view",
        data: {
          route: notification.target?.route,
          params: notification.target?.params,
          notificationId: notification._id.toString()
        }
      });
    }
    return sendSuccess(response, comment, "Comment added", 201);
  }),
);

postRouter.get(
  "/:id/reactions",
  asyncHandler(async (request, response) => {
    if (!isValidObjectId(request.params.id))
      throw new AppError(400, "Invalid post id", "INVALID_ID");
    const readable = await readablePostFilter(request.user!._id.toString());
    const post = await Post.exists({ ...readable, _id: request.params.id });
    if (!post) throw new AppError(404, "Post not found", "POST_NOT_FOUND");
    const reactions = await Reaction.find({ post: request.params.id })
      .populate("user", "name username avatarUrl department academicYear verified")
      .sort({ createdAt: -1 });
    const users = reactions.map(r => r.user).filter(Boolean);
    return sendSuccess(response, users);
  }),
);

postRouter.post(
  "/:id/reactions",
  asyncHandler(async (request, response) => {
    const { type } = z
      .object({
        type: z.enum(["like", "love", "fire", "celebrate"]).nullable(),
      })
      .parse(request.body);
    const readable = await readablePostFilter(request.user!._id.toString());
    const post = await Post.findOne({ ...readable, _id: request.params.id });
    if (!post) throw new AppError(404, "Post not found", "POST_NOT_FOUND");

    const existing = await Reaction.findOne({
      post: post._id,
      user: request.user!._id,
    });
    if (!type) {
      if (existing) {
        await existing.deleteOne();
        await Post.updateOne(
          { _id: request.params.id },
          { $inc: { reactionCount: -1 } },
        );
        await emitPostEvent(request, post, "post:like");
        if (post.author.toString() !== request.user!._id.toString()) {
          await Notification.deleteOne({ user: post.author, actor: request.user!._id, type: "post_reaction", "target.params.postId": post._id.toString() });
        }
      }
      return sendSuccess(response, null, "Reaction removed");
    }
    const created = !existing;
    const reaction = await Reaction.findOneAndUpdate(
      { post: request.params.id, user: request.user!._id },
      { $set: { type } },
      { new: true, upsert: true },
    );
    if (created) {
      await Post.updateOne(
        { _id: request.params.id },
        { $inc: { reactionCount: 1 } },
      );
      if (post.author.toString() !== request.user!._id.toString()) {
        const notification = await Notification.findOneAndUpdate(
          { user: post.author, actor: request.user!._id, type: "post_reaction", "target.params.postId": post._id.toString() },
          {
            $set: {
              title: `${request.user!.name} reacted to your post`,
              target: { route: "PostDetails", params: { postId: post._id.toString() } }
            },
            $unset: { readAt: "" }
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        ).populate("actor", "name username avatarUrl");
        request.app.get("io")?.to(`user:${post.author.toString()}`).emit("notification:new", notification);
        
        void pushService.sendPushNotification(post.author, {
          title: notification.title,
          body: "Tap to view",
          data: {
            route: notification.target?.route,
            params: notification.target?.params,
            notificationId: notification._id.toString()
          }
        });
      }
    }
    await emitPostEvent(request, post, "post:like");
    return sendSuccess(response, reaction, "Reaction updated");
  }),
);

postRouter.post(
  "/:id/save",
  asyncHandler(async (request, response) => {
    const { saved } = z
      .object({ saved: z.boolean().default(true) })
      .parse(request.body);
    if (saved) {
      const readable = await readablePostFilter(request.user!._id.toString());
      const post = await Post.exists({ ...readable, _id: request.params.id });
      if (!post) throw new AppError(404, "Post not found", "POST_NOT_FOUND");
    }
    if (saved)
      await SavedItem.updateOne(
        { user: request.user!._id, itemType: "post", item: request.params.id },
        {
          $setOnInsert: {
            user: request.user!._id,
            itemType: "post",
            item: request.params.id,
          },
        },
        { upsert: true },
      );
    else
      await SavedItem.deleteOne({
        user: request.user!._id,
        itemType: "post",
        item: request.params.id,
      });
    request.app.get("io")?.to(`user:${request.user!._id}`).emit("post:saved", { postId: request.params.id, saved });
    return sendSuccess(
      response,
      { saved },
      saved ? "Post saved" : "Post removed from saved",
    );
  }),
);
