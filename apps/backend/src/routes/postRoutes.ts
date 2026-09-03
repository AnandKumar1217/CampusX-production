import { Router } from "express";
import { isValidObjectId } from "mongoose";
import { z } from "zod";

import { Comment, Post, Reaction, SavedItem } from "../models/Social.js";
import { AppError, asyncHandler, sendSuccess } from "../utils/http.js";
import { pagination } from "../utils/pagination.js";

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
    return sendSuccess(response, { items, page, limit, total });
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
          .array(z.object({ url: z.url(), type: z.enum(["image", "video"]) }))
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
    return sendSuccess(response, { post, comments });
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
    if (
      !(await Post.exists({
        _id: request.params.id,
        deletedAt: { $exists: false },
      }))
    )
      throw new AppError(404, "Post not found", "POST_NOT_FOUND");
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
    return sendSuccess(response, comment, "Comment added", 201);
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
    const existing = await Reaction.findOne({
      post: request.params.id,
      user: request.user!._id,
    });
    if (!type) {
      if (existing) {
        await existing.deleteOne();
        await Post.updateOne(
          { _id: request.params.id },
          { $inc: { reactionCount: -1 } },
        );
      }
      return sendSuccess(response, null, "Reaction removed");
    }
    const created = !existing;
    const reaction = await Reaction.findOneAndUpdate(
      { post: request.params.id, user: request.user!._id },
      { $set: { type } },
      { new: true, upsert: true },
    );
    if (created)
      await Post.updateOne(
        { _id: request.params.id },
        { $inc: { reactionCount: 1 } },
      );
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
