import { Router } from "express";
import { z } from "zod";

import {
  Event,
  MarketplaceListing,
  TimetableEntry,
} from "../models/Commerce.js";
import { AppError, asyncHandler, sendSuccess } from "../utils/http.js";
import { pagination } from "../utils/pagination.js";

export const eventRouter = Router();
eventRouter.get(
  "/",
  asyncHandler(async (request, response) => {
    const { page, limit, skip } = pagination(request.query);
    const filter = {
      draft: false,
      startsAt: { $gte: new Date() },
      ...(request.query.category ? { category: request.query.category } : {}),
    };
    const [items, total] = await Promise.all([
      Event.find(filter)
        .populate("creator", "name username avatarUrl")
        .sort({ startsAt: 1 })
        .skip(skip)
        .limit(limit),
      Event.countDocuments(filter),
    ]);
    return sendSuccess(response, { items, page, limit, total });
  }),
);
eventRouter.post(
  "/",
  asyncHandler(async (request, response) => {
    const input = z
      .object({
        title: z.string().min(3).max(200),
        description: z.string().max(5000).optional(),
        imageUrl: z.url().optional(),
        category: z.string().max(80).optional(),
        startsAt: z.coerce.date(),
        endsAt: z.coerce.date().optional(),
        location: z
          .object({
            name: z.string().max(200),
            coordinates: z.tuple([z.number(), z.number()]).optional(),
          })
          .optional(),
        draft: z.boolean().default(false),
      })
      .parse(request.body);
    return sendSuccess(
      response,
      await Event.create({ ...input, creator: request.user!._id }),
      "Event created",
      201,
    );
  }),
);
eventRouter.get(
  "/:id",
  asyncHandler(async (request, response) => {
    const item = await Event.findById(request.params.id)
      .populate("creator", "name username avatarUrl")
      .populate("attendees.user", "name username avatarUrl");
    if (!item) throw new AppError(404, "Event not found", "EVENT_NOT_FOUND");
    return sendSuccess(response, item);
  }),
);
eventRouter.patch(
  "/:id",
  asyncHandler(async (request, response) => {
    const item = await Event.findOneAndUpdate(
      { _id: request.params.id, creator: request.user!._id },
      { $set: request.body },
      { new: true, runValidators: true },
    );
    if (!item)
      throw new AppError(
        404,
        "Event not found or not owned by you",
        "EVENT_NOT_FOUND",
      );
    return sendSuccess(response, item, "Event updated");
  }),
);
eventRouter.post(
  "/:id/attendance",
  asyncHandler(async (request, response) => {
    const { status } = z
      .object({ status: z.enum(["none", "maybe", "going"]) })
      .parse(request.body);
    await Event.updateOne(
      { _id: request.params.id },
      { $pull: { attendees: { user: request.user!._id } } },
    );
    if (status !== "none")
      await Event.updateOne(
        { _id: request.params.id },
        { $push: { attendees: { user: request.user!._id, status } } },
      );
    return sendSuccess(response, { status }, "Attendance updated");
  }),
);

export const marketplaceRouter = Router();
marketplaceRouter.get(
  "/",
  asyncHandler(async (request, response) => {
    const { page, limit, skip } = pagination(request.query);
    const query = String(request.query.q ?? "").trim();
    const filter = {
      status: "active",
      ...(query ? { $text: { $search: query } } : {}),
      ...(request.query.category ? { category: request.query.category } : {}),
    };
    const [items, total] = await Promise.all([
      MarketplaceListing.find(filter)
        .populate("seller", "name username avatarUrl verified")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      MarketplaceListing.countDocuments(filter),
    ]);
    return sendSuccess(response, { items, page, limit, total });
  }),
);
marketplaceRouter.post(
  "/",
  asyncHandler(async (request, response) => {
    const input = z
      .object({
        title: z.string().min(3).max(180),
        description: z.string().max(4000).optional(),
        category: z.string().min(1).max(80),
        price: z.number().min(0),
        negotiable: z.boolean().default(true),
        images: z.array(z.url()).max(5).default([]),
        condition: z.string().max(80).optional(),
        location: z.string().max(200).optional(),
        draft: z.boolean().default(false),
      })
      .parse(request.body);
    return sendSuccess(
      response,
      await MarketplaceListing.create({
        ...input,
        seller: request.user!._id,
        status: input.draft ? "draft" : "active",
      }),
      "Listing created",
      201,
    );
  }),
);
marketplaceRouter.get(
  "/mine",
  asyncHandler(async (request, response) =>
    sendSuccess(
      response,
      await MarketplaceListing.find({ seller: request.user!._id }).sort({
        createdAt: -1,
      }),
    ),
  ),
);
marketplaceRouter.get(
  "/:id",
  asyncHandler(async (request, response) => {
    const item = await MarketplaceListing.findById(request.params.id).populate(
      "seller",
      "name username avatarUrl verified",
    );
    if (!item)
      throw new AppError(404, "Listing not found", "LISTING_NOT_FOUND");
    return sendSuccess(response, item);
  }),
);
marketplaceRouter.patch(
  "/:id",
  asyncHandler(async (request, response) => {
    const input = z
      .object({
        title: z.string().min(3).max(180).optional(),
        description: z.string().max(4000).optional(),
        price: z.number().min(0).optional(),
        status: z.enum(["active", "sold", "draft"]).optional(),
        images: z.array(z.url()).max(5).optional(),
      })
      .parse(request.body);
    const item = await MarketplaceListing.findOneAndUpdate(
      { _id: request.params.id, seller: request.user!._id },
      { $set: input },
      { new: true, runValidators: true },
    );
    if (!item)
      throw new AppError(
        404,
        "Listing not found or not owned by you",
        "LISTING_NOT_FOUND",
      );
    return sendSuccess(response, item, "Listing updated");
  }),
);
marketplaceRouter.delete(
  "/:id",
  asyncHandler(async (request, response) => {
    const item = await MarketplaceListing.findOneAndDelete({
      _id: request.params.id,
      seller: request.user!._id,
    });
    if (!item)
      throw new AppError(
        404,
        "Listing not found or not owned by you",
        "LISTING_NOT_FOUND",
      );
    return sendSuccess(response, null, "Listing deleted");
  }),
);

export const timetableRouter = Router();
timetableRouter.get(
  "/",
  asyncHandler(async (request, response) =>
    sendSuccess(
      response,
      await TimetableEntry.find({ user: request.user!._id }).sort({
        days: 1,
        startTime: 1,
      }),
    ),
  ),
);
timetableRouter.post(
  "/",
  asyncHandler(async (request, response) => {
    const input = z
      .object({
        subject: z.string().min(1).max(160),
        room: z.string().max(100).optional(),
        lecturer: z.string().max(120).optional(),
        day: z.number().int().min(0).max(6).optional(),
        days: z.array(z.number().int().min(0).max(6)).optional(),
        startTime: z.string().regex(/^\d{2}:\d{2}$/),
        endTime: z.string().regex(/^\d{2}:\d{2}$/),
        color: z.string().max(20).optional(),
        repeat: z.string().optional(),
      })
      .parse(request.body);
    const item = await TimetableEntry.create({
      ...input,
      days: input.days ?? [input.day ?? 1],
      user: request.user!._id,
      repeat: input.repeat === "Every week" ? "weekly" : "none",
    });
    return sendSuccess(response, item, "Class added", 201);
  }),
);
timetableRouter.patch(
  "/:id",
  asyncHandler(async (request, response) => {
    const item = await TimetableEntry.findOneAndUpdate(
      { _id: request.params.id, user: request.user!._id },
      { $set: request.body },
      { new: true, runValidators: true },
    );
    if (!item) throw new AppError(404, "Class not found", "CLASS_NOT_FOUND");
    return sendSuccess(response, item, "Class updated");
  }),
);
timetableRouter.delete(
  "/:id",
  asyncHandler(async (request, response) => {
    await TimetableEntry.deleteOne({
      _id: request.params.id,
      user: request.user!._id,
    });
    return sendSuccess(response, null, "Class deleted");
  }),
);
