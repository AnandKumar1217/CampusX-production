import { Router } from "express";
import { isValidObjectId } from "mongoose";
import { z } from "zod";

import { User } from "../models/User.js";
import { AppError, asyncHandler, sendSuccess } from "../utils/http.js";
import { pagination } from "../utils/pagination.js";

export const userRouter = Router();

userRouter.get(
  "/me",
  asyncHandler(async (request, response) => {
    const user = await User.findById(request.user!._id).select("-passwordHash");
    return sendSuccess(response, user);
  }),
);

userRouter.patch(
  "/me",
  asyncHandler(async (request, response) => {
    const input = z
      .object({
        name: z.string().min(2).max(80).optional(),
        bio: z.string().max(300).optional(),
        avatarUrl: z.url().optional(),
        college: z.string().max(120).optional(),
        department: z.string().max(100).optional(),
        academicYear: z.string().max(30).optional(),
        interests: z.array(z.string().max(50)).max(20).optional(),
      })
      .parse(request.body);
    const user = await User.findByIdAndUpdate(
      request.user!._id,
      { $set: input },
      { new: true, runValidators: true },
    ).select("-passwordHash");
    return sendSuccess(response, user, "Profile updated");
  }),
);

userRouter.get(
  "/search",
  asyncHandler(async (request, response) => {
    const query = String(request.query.q ?? "").trim();
    const { limit, skip, page } = pagination(request.query, 30);
    const filter = query
      ? { $text: { $search: query } }
      : { _id: { $ne: request.user!._id } };
    const [items, total] = await Promise.all([
      User.find(filter)
        .select(
          "name username avatarUrl college department academicYear verified online",
        )
        .skip(skip)
        .limit(limit),
      User.countDocuments(filter),
    ]);
    return sendSuccess(response, { items, page, limit, total });
  }),
);

userRouter.get(
  "/:id",
  asyncHandler(async (request, response) => {
    if (!isValidObjectId(request.params.id))
      throw new AppError(400, "Invalid user id", "INVALID_ID");
    const user = await User.findById(request.params.id).select(
      "name username avatarUrl bio college department academicYear interests verified online lastSeenAt",
    );
    if (!user) throw new AppError(404, "User not found", "USER_NOT_FOUND");
    return sendSuccess(response, user);
  }),
);
