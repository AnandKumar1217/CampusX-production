import { Router } from "express";
import { isValidObjectId } from "mongoose";
import { z } from "zod";

import { Comment, Notification, Post, Reaction, SavedItem } from "../models/Social.js";
import { cloudinaryService } from "../services/cloudinary.js";
import { AppError, asyncHandler, sendSuccess } from "../utils/http.js";
import { pagination } from "../utils/pagination.js";
import { pushService } from "../services/pushService.js";

async function formatPosts(posts: any[], userId: string | undefined) {
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

postRouter.get(
  "/",
  asyncHandler(async (request, response) => {
    const { page, limit, skip } = pagination(request.query);
    const [items, total] = await Promise.all([
      Post.find({ deletedAt: { $exists: false } })
        .populate(
          "author",
          "name username avatarUrl department academicYear verified",
        )
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Post.countDocuments({ deletedAt: { $exists: false } }),
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
    
    const items = await Post.find({
      _id: { $in: postIds },
      deletedAt: { $exists: false },
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
      .parse(request.body);
    const item = await Post.create({ ...input, author: request.user!._id });
    return sendSuccess(response, item, "Post created", 201);
  }),
);

postRouter.get(
  "/:id",
  asyncHandler(async (request, response) => {
    if (!isValidObjectId(request.params.id))
      throw new AppError(400, "Invalid post id", "INVALID_ID");
    const [post, comments] = await Promise.all([
      Post.findOne({
        _id: request.params.id,
        deletedAt: { $exists: false },
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
    const post = await Post.findOne({
      _id: request.params.id,
      deletedAt: { $exists: false },
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
    if (post.author.toString() !== request.user!._id.toString()) {
      const notification = await Notification.findOneAndUpdate(
        { user: post.author, actor: request.user!._id, type: "post_comment", "target.params.postId": post._id.toString() },
        {
          $set: {
            title: `${request.user!.name} commented on your post`,
            target: { route: "PostDetail", params: { postId: post._id.toString() } }
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
    const post = await Post.findOne({ _id: request.params.id, deletedAt: { $exists: false } });
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
              target: { route: "PostDetail", params: { postId: post._id.toString() } }
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
    return sendSuccess(response, reaction, "Reaction updated");
  }),
);

postRouter.post(
  "/:id/save",
  asyncHandler(async (request, response) => {
    const { saved } = z
      .object({ saved: z.boolean().default(true) })
      .parse(request.body);
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
    return sendSuccess(
      response,
      { saved },
      saved ? "Post saved" : "Post removed from saved",
    );
  }),
);
