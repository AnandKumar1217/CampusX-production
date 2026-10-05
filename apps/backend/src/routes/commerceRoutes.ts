import { Router } from "express";
import { z } from "zod";

import {
  Event,
  MarketplaceListing,
  TimetableEntry,
  TimetableSettings,
  ScheduleOverride,
} from "../models/Commerce.js";
import { Notification, SavedItem } from "../models/Social.js";
import { pushService } from "../services/pushService.js";
import { cloudinaryService } from "../services/cloudinary.js";
import { AppError, asyncHandler, sendSuccess } from "../utils/http.js";
import { pagination } from "../utils/pagination.js";

export const eventRouter = Router();

eventRouter.get(
  "/",
  asyncHandler(async (request, response) => {
    const { page, limit, skip } = pagination(request.query);
    const filter: any = {
      status: { $ne: "cancelled" },
      $or: [
        { status: "active", draft: { $ne: true } },
        { status: { $exists: false }, draft: { $ne: true } },
        { creator: request.user!._id }
      ]
    };
    if (request.query.category) {
      filter.category = request.query.category;
    }
    if (request.query.q) {
      filter.$text = { $search: request.query.q };
    }
    
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
        description: z.string().max(5000),
        imageUrl: z.url().optional(),
        imagePublicId: z.string().optional(),
        category: z.string().max(80),
        startsAt: z.coerce.date(),
        endsAt: z.coerce.date().optional(),
        location: z.object({
          name: z.string().max(200),
          coordinates: z.tuple([z.number(), z.number()]).optional(),
        }),
        capacity: z.number().min(1).optional(),
        registrationDeadline: z.coerce.date().optional(),
        status: z.enum(["draft", "active", "cancelled"]).default("active"),
        draft: z.boolean().default(false),
      })
      .parse(request.body);

    if (input.endsAt && input.endsAt <= input.startsAt) {
      throw new AppError(400, "End time must be after start time", "INVALID_DATES");
    }
    if (input.registrationDeadline && input.registrationDeadline > input.startsAt) {
      throw new AppError(400, "Registration deadline cannot be after event starts", "INVALID_DEADLINE");
    }

    const item = await Event.create({ ...input, creator: request.user!._id });
    const io = request.app.get("io");
    if (!item.draft && item.status === "active") io?.emit("event:created", { eventId: item._id.toString() });
    
    return sendSuccess(response, item, "Event created", 201);
  }),
);

eventRouter.get(
  "/saved",
  asyncHandler(async (request, response) => {
    const saved = await SavedItem.find({ user: request.user!._id, itemType: "event" }).sort({ createdAt: -1 });
    const ids = saved.map((entry) => entry.item);
    const events = await Event.find({ _id: { $in: ids }, draft: { $ne: true } }).populate("creator", "name username avatarUrl");
    const byId = new Map(events.map((event) => [event._id.toString(), event]));
    return sendSuccess(response, ids.map((id) => byId.get(id.toString())).filter(Boolean));
  }),
);

eventRouter.get(
  "/:id",
  asyncHandler(async (request, response) => {
    const item = await Event.findById(request.params.id)
      .populate("creator", "name username avatarUrl")
      .populate("attendees.user", "name username avatarUrl");
    if (!item) throw new AppError(404, "Event not found", "EVENT_NOT_FOUND");
    if ((item.draft || item.status !== "active") && item.creator._id.toString() !== request.user!._id.toString())
      throw new AppError(404, "Event not found", "EVENT_NOT_FOUND");
    return sendSuccess(response, item);
  }),
);

eventRouter.patch(
  "/:id",
  asyncHandler(async (request, response) => {
    const input = z.object({
      title: z.string().min(3).max(200).optional(),
      description: z.string().max(5000).optional(),
      imageUrl: z.url().optional(),
      imagePublicId: z.string().optional(),
      category: z.string().max(80).optional(),
      startsAt: z.coerce.date().optional(),
      endsAt: z.coerce.date().optional(),
      location: z.object({
        name: z.string().max(200),
        coordinates: z.tuple([z.number(), z.number()]).optional(),
      }).optional(),
      capacity: z.number().min(1).optional(),
      registrationDeadline: z.coerce.date().optional(),
      status: z.enum(["draft", "active", "cancelled"]).optional(),
      draft: z.boolean().optional(),
    }).parse(request.body);
    
    const event = await Event.findById(request.params.id);
    if (!event) throw new AppError(404, "Event not found", "EVENT_NOT_FOUND");
    if (event.creator.toString() !== request.user!._id.toString()) {
      throw new AppError(403, "Not authorized to modify this event", "FORBIDDEN");
    }
    
    const startsAt = input.startsAt || event.startsAt;
    const endsAt = input.endsAt || event.endsAt;
    if (endsAt && startsAt && endsAt <= startsAt) {
      throw new AppError(400, "End time must be after start time", "INVALID_DATES");
    }
    
    const updateData: any = { ...input };
    if (updateData.status === "cancelled" && event.status !== "cancelled") {
      updateData.cancelledAt = new Date();
    }
    
    const oldPublicId = event.imagePublicId;
    const item = await Event.findByIdAndUpdate(event._id, { $set: updateData }, { new: true, runValidators: true });
    
    if (input.imagePublicId && oldPublicId && input.imagePublicId !== oldPublicId) {
      await cloudinaryService.deleteImage(oldPublicId).catch(console.error);
    }
    
    if (updateData.status === "cancelled" && event.status !== "cancelled") {
       const goingAttendees = event.attendees.filter((a: any) => a.status === "going").map((a: any) => a.user).filter(Boolean);
       if (goingAttendees.length > 0) {
           const notifs = goingAttendees.map((userId: any) => ({
               user: userId,
               actor: request.user!._id,
               type: "event_cancel",
               title: `Event cancelled: ${event.title}`
           }));
           await Notification.insertMany(notifs).catch(console.error);
           
           goingAttendees.forEach((userId: any) => {
             void pushService.sendPushNotification(userId, {
               title: `Event Cancelled`,
               body: `${event.title} has been cancelled.`,
               data: { route: "EventDetails", params: { eventId: event._id.toString() } }
             });
           });
       }
       request.app.get("io")?.emit("event:cancelled", { eventId: event._id.toString() });
    } else {
       const io = request.app.get("io");
       if (item?.draft && !event.draft) io?.emit("event:deleted", { eventId: item._id.toString() });
       else if (item?.draft) io?.to(`user:${request.user!._id}`).emit("event:updated", { eventId: item._id.toString() });
       else io?.emit(event.draft ? "event:created" : "event:updated", { eventId: item?._id.toString() });
    }

    return sendSuccess(response, item, "Event updated");
  }),
);

eventRouter.post(
  "/:id/register",
  asyncHandler(async (request, response) => {
    const event = await Event.findById(request.params.id);
    if (!event || event.draft || event.status !== "active") throw new AppError(404, "Event not found", "EVENT_NOT_FOUND");
    
    if (event.creator.toString() === request.user!._id.toString()) {
      throw new AppError(400, "Event owners cannot register for their own event.", "BAD_REQUEST");
    }
    
    if (event.registrationDeadline && new Date() > event.registrationDeadline) {
      throw new AppError(400, "Registration is closed for this event", "DEADLINE_PASSED");
    }
    
    const isGoing = event.attendees.some(a => a.user?.toString() === request.user!._id.toString() && a.status === "going");
    if (isGoing) {
      return sendSuccess(response, null, "Already registered");
    }
    
    const goingCount = event.attendees.filter(a => a.status === "going").length;
    if (event.capacity && goingCount >= event.capacity) {
      throw new AppError(400, "Event is full", "EVENT_FULL");
    }

    await Event.updateOne(
      { _id: request.params.id },
      { $pull: { attendees: { user: request.user!._id } } }
    );
    await Event.updateOne(
      { _id: request.params.id },
      { $push: { attendees: { user: request.user!._id, status: "going", registeredAt: new Date() } } }
    );
    
    const notif = await Notification.create({
      user: event.creator,
      actor: request.user!._id,
      type: "event_join",
      title: `${request.user!.name} is going to your event`,
      target: { route: "EventDetails", params: { eventId: event._id.toString() } }
    }).catch(console.error);
    if (notif) {
      void pushService.sendPushNotification(event.creator as any, {
        title: notif.title,
        body: "Tap to view",
        data: { route: "EventDetails", params: { eventId: event._id.toString() } }
      });
    }
    
    const io = request.app.get("io");
    io?.emit("event:updated", { eventId: request.params.id });
    io?.to(`user:${event.creator}`).emit("event:registration_added", { eventId: request.params.id, userId: request.user!._id });
    
    return sendSuccess(response, null, "Registered successfully");
  }),
);

eventRouter.delete(
  "/:id/register",
  asyncHandler(async (request, response) => {
    const event = await Event.findById(request.params.id);
    if (!event) throw new AppError(404, "Event not found", "EVENT_NOT_FOUND");
    
    await Event.updateOne(
      { _id: request.params.id },
      { $pull: { attendees: { user: request.user!._id } } }
    );
    
    const io = request.app.get("io");
    io?.emit("event:updated", { eventId: request.params.id });
    io?.to(`user:${event.creator}`).emit("event:registration_cancelled", { eventId: request.params.id, userId: request.user!._id });
    
    return sendSuccess(response, null, "Registration cancelled");
  }),
);

eventRouter.get(
  "/:id/registrations",
  asyncHandler(async (request, response) => {
    const event = await Event.findById(request.params.id).populate("attendees.user", "name username avatarUrl department year");
    if (!event) throw new AppError(404, "Event not found", "EVENT_NOT_FOUND");
    if (event.creator.toString() !== request.user!._id.toString()) {
      throw new AppError(403, "Not authorized to view registrations", "FORBIDDEN");
    }
    const going = event.attendees.filter(a => a.status === "going");
    return sendSuccess(response, going);
  }),
);

eventRouter.delete(
  "/:id",
  asyncHandler(async (request, response) => {
    const event = await Event.findById(request.params.id);
    if (!event) throw new AppError(404, "Event not found", "EVENT_NOT_FOUND");
    if (event.creator.toString() !== request.user!._id.toString()) {
      throw new AppError(403, "Not authorized to delete this event", "FORBIDDEN");
    }
    
    if (event.imagePublicId) {
       await cloudinaryService.deleteImage(event.imagePublicId).catch(console.error);
    }
    await event.deleteOne();
    await SavedItem.deleteMany({ itemType: "event", item: event._id });
    
    const io = request.app.get("io");
    if (event.draft) io?.to(`user:${request.user!._id}`).emit("event:deleted", { eventId: request.params.id });
    else io?.emit("event:deleted", { eventId: request.params.id });

    return sendSuccess(response, null, "Event deleted");
  }),
);

eventRouter.post(
  "/:id/save",
  asyncHandler(async (request, response) => {
    const { saved } = z.object({ saved: z.boolean() }).parse(request.body);
    const filter = { user: request.user!._id, itemType: "event", item: request.params.id };
    if (saved) {
      const event = await Event.exists({ _id: request.params.id, draft: { $ne: true } });
      if (!event) throw new AppError(404, "Event not found", "EVENT_NOT_FOUND");
      await SavedItem.findOneAndUpdate(filter, filter, { upsert: true });
    } else {
      await SavedItem.findOneAndDelete(filter);
    }
    return sendSuccess(response, { saved });
  }),
);

export const marketplaceRouter = Router();

marketplaceRouter.get(
  "/",
  asyncHandler(async (request, response) => {
    const limit = Math.min(Math.max(Number(request.query.limit) || 16, 1), 40);
    const query = String(request.query.q ?? "").trim();
    const category = request.query.category ? String(request.query.category) : null;
    const sort = String(request.query.sort || "newest");
    const cursorStr = request.query.cursor ? String(request.query.cursor) : null;

    let filter: any = { status: "available" };
    if (category && category !== "All") filter.category = category;
    if (query) filter.$text = { $search: query };

    // Cursor Pagination
    if (cursorStr) {
      try {
        const cursorData = JSON.parse(Buffer.from(cursorStr, 'base64').toString('utf8'));
        if (sort === "price_asc") {
          filter.$or = [
            { price: { $gt: cursorData.price } },
            { price: cursorData.price, _id: { $gt: cursorData._id } }
          ];
        } else if (sort === "price_desc") {
          filter.$or = [
            { price: { $lt: cursorData.price } },
            { price: cursorData.price, _id: { $lt: cursorData._id } }
          ];
        } else {
          // newest
          if (query) {
             filter.score = { $lt: cursorData.score };
          } else {
             filter.$or = [
               { createdAt: { $lt: cursorData.createdAt } },
               { createdAt: cursorData.createdAt, _id: { $lt: cursorData._id } }
             ];
          }
        }
      } catch (e) {
        console.error("Invalid cursor");
      }
    }

    let sortObj: any = { createdAt: -1, _id: -1 };
    if (sort === "price_asc") sortObj = { price: 1, _id: 1 };
    if (sort === "price_desc") sortObj = { price: -1, _id: -1 };
    if (query) {
      sortObj = { score: { $meta: "textScore" } };
    }

    let dbQuery = MarketplaceListing.find(filter)
      .populate("seller", "name username avatarUrl")
      .select("-description -images")
      .sort(sortObj)
      .limit(limit + 1)
      .lean();
      
    if (query) {
      dbQuery = dbQuery.select({ score: { $meta: "textScore" }, description: 0, images: 0 });
    }

    const items = await dbQuery;

    const hasMore = items.length > limit;
    if (hasMore) items.pop();

    let nextCursor = null;
    if (hasMore && items.length > 0) {
      const lastItem = items[items.length - 1];
      if (lastItem) {
        let cursorData: any = {};
        if (sort === "price_asc" || sort === "price_desc") {
          cursorData = { price: lastItem.price, _id: lastItem._id };
        } else {
          if (query) {
             cursorData = { score: (lastItem as any).score };
          } else {
             cursorData = { createdAt: lastItem.createdAt, _id: lastItem._id };
          }
        }
        nextCursor = Buffer.from(JSON.stringify(cursorData)).toString('base64');
      }
    }

    // Apply Cloudinary transformations to coverImage
    const formattedItems = items.map(item => {
      let coverImage = item.imagePublicIds?.[0] 
        ? `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/w_500,c_fill,f_auto,q_auto/${item.imagePublicIds[0]}`
        : null;
      
      const formatted: any = {
        ...item,
        coverImage,
      };
      delete formatted.imagePublicIds;
      return formatted;
    });

    return sendSuccess(response, { items: formattedItems, hasMore, nextCursor });
  })
);

marketplaceRouter.post(
  "/",
  asyncHandler(async (request, response) => {
    const input = z.object({
      title: z.string().min(3).max(180),
      description: z.string().max(4000).optional(),
      category: z.string().min(1).max(80),
      price: z.number().min(0),
      negotiable: z.boolean().default(true),
      images: z.array(z.url()).max(5).default([]),
      imagePublicIds: z.array(z.string()).max(5).default([]),
      condition: z.string().max(80).optional(),
      location: z.object({
        name: z.string().optional(),
        address: z.string().optional(),
        latitude: z.number().nullable().optional(),
        longitude: z.number().nullable().optional(),
      }).optional(),
      draft: z.boolean().default(false),
    }).parse(request.body);

    const item = await MarketplaceListing.create({
      ...input,
      seller: request.user!._id,
      status: input.draft ? "draft" : "available",
    });

    if (!input.draft) {
      request.app.get("io")?.emit("marketplace:listing_updated", { listingId: item._id.toString() });
    }

    return sendSuccess(response, item, "Listing created", 201);
  })
);

marketplaceRouter.get(
  "/mine",
  asyncHandler(async (request, response) => {
    const limit = Math.min(Math.max(Number(request.query.limit) || 16, 1), 40);
    const statusFilter = String(request.query.status || "available");
    const cursorStr = request.query.cursor ? String(request.query.cursor) : null;
    
    let filter: any = { seller: request.user!._id };
    if (statusFilter === "available") {
      filter.status = { $in: ["available", "reserved"] };
    } else if (statusFilter === "draft") {
      filter.status = "draft";
    } else if (statusFilter === "sold") {
      filter.status = "sold";
    }

    if (cursorStr) {
      try {
        const cursorData = JSON.parse(Buffer.from(cursorStr, 'base64').toString('utf8'));
        filter.$or = [
          { createdAt: { $lt: cursorData.createdAt } },
          { createdAt: cursorData.createdAt, _id: { $lt: cursorData._id } }
        ];
      } catch (e) {
        console.error("Invalid cursor");
      }
    }

    const items = await MarketplaceListing.find(filter)
      .select("-description -images")
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1)
      .lean();

    const hasMore = items.length > limit;
    if (hasMore) items.pop();

    let nextCursor = null;
    if (hasMore && items.length > 0) {
      const lastItem = items[items.length - 1];
      if (lastItem) {
        nextCursor = Buffer.from(JSON.stringify({ createdAt: lastItem.createdAt, _id: lastItem._id })).toString('base64');
      }
    }
    
    const formattedItems = items.map(item => {
      let coverImage = item.imagePublicIds?.[0] 
        ? `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/w_500,c_fill,f_auto,q_auto/${item.imagePublicIds[0]}`
        : null;
      return { ...item, coverImage, imagePublicIds: undefined };
    });

    return sendSuccess(response, { items: formattedItems, hasMore, nextCursor });
  })
);

marketplaceRouter.get(
  "/saved",
  asyncHandler(async (request, response) => {
    const limit = Math.min(Math.max(Number(request.query.limit) || 16, 1), 40);
    const cursorStr = request.query.cursor ? String(request.query.cursor) : null;
    
    let savedFilter: any = { user: request.user!._id, itemType: "listing" };
    if (cursorStr) {
      try {
        const cursorData = JSON.parse(Buffer.from(cursorStr, 'base64').toString('utf8'));
        savedFilter.$or = [
          { createdAt: { $lt: cursorData.createdAt } },
          { createdAt: cursorData.createdAt, _id: { $lt: cursorData._id } }
        ];
      } catch (e) {
        // ignore parse error
      }
    }

    const savedItems = await SavedItem.find(savedFilter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1)
      .lean();
      
    const hasMore = savedItems.length > limit;
    if (hasMore) savedItems.pop();
    
    let nextCursor = null;
    if (hasMore && savedItems.length > 0) {
      const lastItem = savedItems[savedItems.length - 1];
      if (lastItem) {
        nextCursor = Buffer.from(JSON.stringify({ createdAt: lastItem.createdAt, _id: lastItem._id })).toString('base64');
      }
    }

    const listingIds = savedItems.map(s => s.item);
    
    const items = await MarketplaceListing.find({ _id: { $in: listingIds }, status: { $ne: "draft" } })
      .populate("seller", "name username avatarUrl verified")
      .select("-description -images")
      .lean();
      
    const formattedItems = items.map(item => {
      let coverImage = item.imagePublicIds?.[0] 
        ? `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/w_500,c_fill,f_auto,q_auto/${item.imagePublicIds[0]}`
        : null;
      return { ...item, coverImage, imagePublicIds: undefined };
    });
      
    // Sort items to match savedItems order
    const orderedItems = savedItems
      .map(s => formattedItems.find(i => i._id.toString() === s.item.toString()))
      .filter(Boolean);

    return sendSuccess(response, { items: orderedItems, hasMore, nextCursor });
  })
);

marketplaceRouter.get(
  "/:id",
  asyncHandler(async (request, response) => {
    const item = await MarketplaceListing.findById(request.params.id)
      .populate("seller", "name username avatarUrl verified")
      .lean();
      
    if (!item) throw new AppError(404, "Listing not found", "LISTING_NOT_FOUND");
    if (item.status === "draft" && item.seller._id.toString() !== request.user!._id.toString())
      throw new AppError(404, "Listing not found", "LISTING_NOT_FOUND");

    if (item.seller._id.toString() !== request.user!._id.toString()) {
      await MarketplaceListing.updateOne(
        { _id: item._id },
        { $addToSet: { viewedBy: request.user!._id } }
      );
    }

    return sendSuccess(response, item);
  })
);

marketplaceRouter.patch(
  "/:id",
  asyncHandler(async (request, response) => {
    const input = z.object({
      title: z.string().min(3).max(180).optional(),
      description: z.string().max(4000).optional(),
      category: z.string().min(1).max(80).optional(),
      price: z.number().min(0).optional(),
      status: z.enum(["available", "sold", "draft", "reserved", "deleted"]).optional(),
      condition: z.string().optional(),
      location: z.object({
        name: z.string().optional(),
        address: z.string().optional(),
        latitude: z.number().nullable().optional(),
        longitude: z.number().nullable().optional(),
      }).optional(),
      images: z.array(z.url()).max(5).optional(),
      imagePublicIds: z.array(z.string()).max(5).optional(),
    }).parse(request.body);

    const oldListing = await MarketplaceListing.findById(request.params.id);
    if (!oldListing) throw new AppError(404, "Listing not found", "LISTING_NOT_FOUND");
    if (oldListing.seller.toString() !== request.user!._id.toString()) {
      throw new AppError(403, "Not authorized", "FORBIDDEN");
    }
    
    const oldIds = oldListing.imagePublicIds || [];
    const newIds = input.imagePublicIds || [];
    const newlyAddedIds = newIds.filter((id) => !oldIds.includes(id));
    const removedIds = oldIds.filter((id) => !newIds.includes(id));

    try {
      const item = await MarketplaceListing.findOneAndUpdate(
        { _id: request.params.id, seller: request.user!._id },
        { $set: input },
        { new: true, runValidators: true }
      ).populate("seller", "name username avatarUrl verified");

      if (item) {
        request.app.get("io")?.emit("marketplace:listing_updated", { listingId: item._id.toString() });
      }
      
      // Cleanup OLD images after success
      if (input.imagePublicIds) {
        for (const removedId of removedIds) {
          cloudinaryService.deleteImage(removedId).catch(console.error);
        }
      }
      
      return sendSuccess(response, item, "Listing updated");
    } catch (error) {
      // Cleanup NEW images if DB update failed
      if (input.imagePublicIds) {
        for (const addedId of newlyAddedIds) {
           cloudinaryService.deleteImage(addedId).catch(console.error);
        }
      }
      throw error;
    }
  })
);

marketplaceRouter.delete(
  "/:id",
  asyncHandler(async (request, response) => {
    const item = await MarketplaceListing.findById(request.params.id);
    if (!item) throw new AppError(404, "Listing not found", "LISTING_NOT_FOUND");
    if (item.seller.toString() !== request.user!._id.toString()) {
      throw new AppError(403, "Not authorized", "FORBIDDEN");
    }

    const publicIdsToDelete = item.imagePublicIds || [];

    // Delete DB first
    await item.deleteOne();
    await SavedItem.deleteMany({ itemType: "listing", item: item._id });

    // Emit event
    request.app.get("io")?.emit("marketplace:listing_deleted", { listingId: request.params.id });
    
    // Cloudinary cleanup AFTER DB success
    if (publicIdsToDelete.length > 0) {
      for (const publicId of publicIdsToDelete) {
        cloudinaryService.deleteImage(publicId).catch(e => {
          console.error(`Failed to clean up cloudinary image ${publicId} for deleted listing ${item._id}`, e);
        });
      }
    }

    return sendSuccess(response, null, "Listing deleted");
  })
);

marketplaceRouter.post(
  "/:id/save",
  asyncHandler(async (request, response) => {
    const item = await MarketplaceListing.findOne({ _id: request.params.id, status: "available" });
    if (!item) throw new AppError(404, "Listing not found", "LISTING_NOT_FOUND");
    if (item.seller.toString() === request.user!._id.toString()) {
      throw new AppError(400, "Cannot save your own listing", "BAD_REQUEST");
    }
    
    await SavedItem.findOneAndUpdate(
      { user: request.user!._id, itemType: "listing", item: item._id },
      { user: request.user!._id, itemType: "listing", item: item._id },
      { upsert: true, new: true }
    );
    return sendSuccess(response, null, "Listing saved");
  })
);

marketplaceRouter.delete(
  "/:id/save",
  asyncHandler(async (request, response) => {
    await SavedItem.findOneAndDelete({
      user: request.user!._id,
      itemType: "listing",
      item: request.params.id
    });
    return sendSuccess(response, null, "Listing unsaved");
  })
);

export const timetableRouter = Router();

timetableRouter.get(
  "/settings",
  asyncHandler(async (request, response) => {
    let settings = await TimetableSettings.findOne({ user: request.user!._id });
    if (!settings) {
      settings = new TimetableSettings({
        user: request.user!._id,
        gridTimeSlots: [
          { id: "1", label: "09:00 - 10:00 AM", start: "09:00", break: false },
          { id: "2", label: "10:00 - 11:00 AM", start: "10:00", break: false },
          { id: "3", label: "11:00 - 11:15 AM", start: "11:00", break: true },
          { id: "4", label: "11:15 - 12:15 PM", start: "11:15", break: false },
          { id: "5", label: "12:15 - 01:15 PM", start: "12:15", break: false },
          { id: "6", label: "01:15 - 02:00 PM (Lunch)", start: "13:15", break: true },
          { id: "7", label: "02:00 - 03:00 PM", start: "14:00", break: false },
          { id: "8", label: "03:00 - 04:00 PM", start: "15:00", break: false },
        ]
      });
    }
    const doc: any = settings.toObject();
    return sendSuccess(response, { gridTimeSlots: doc.gridTimeSlots });
  })
);

  timetableRouter.put(
    "/settings",
    asyncHandler(async (request, response) => {
      const input = z.object({
        gridTimeSlots: z.array(z.object({
          id: z.string(),
          label: z.string(),
          start: z.string(),
          break: z.boolean().optional().default(false)
        }))
      }).parse(request.body);

      const oldSettings = await TimetableSettings.findOne({ user: request.user!._id });

      if (oldSettings) {
        const deletedSlots = oldSettings.gridTimeSlots.filter(
          (oldSlot: any) => !input.gridTimeSlots.some(newSlot => newSlot.id === oldSlot.id)
        );

        if (deletedSlots.length > 0) {
          const parseTime = (timeStr: string) => {
            if (!timeStr) return 0;
            const match = timeStr.match(/(\d+):(\d+)/);
            if (!match) return 0;
            let h = parseInt(match[1] as string, 10);
            const m = parseInt(match[2] as string, 10);
            if (timeStr.toLowerCase().includes("pm") && h < 12) h += 12;
            if (timeStr.toLowerCase().includes("am") && h === 12) h = 0;
            return h * 60 + m;
          };

          const activeBatchId = oldSettings.activeImportBatchId;
          const classQuery: any = { user: request.user!._id };
          if (activeBatchId) {
            classQuery.importBatchId = activeBatchId;
          } else {
            classQuery.importBatchId = { $exists: false };
          }

          const existingClasses = await TimetableEntry.find(classQuery);
          const classIdsToDelete: string[] = [];

          for (const entry of existingClasses) {
            const entryStartMins = parseTime(entry.startTime);
            const entryEndMins = parseTime(entry.endTime);

            for (const slot of deletedSlots) {
              const slotEndMatch = slot.label.match(/-\s*(\d{1,2}:\d{2})/);
              const slotEndStr = slotEndMatch ? slotEndMatch[1] : slot.start;
              
              const slotStartMins = parseTime(slot.start);
              const slotEndMins = parseTime(slotEndStr + " " + slot.label);

              // Positive overlap check
              if (entryStartMins < slotEndMins && entryEndMins > slotStartMins) {
                classIdsToDelete.push(entry._id.toString());
                break;
              }
            }
          }

          if (classIdsToDelete.length > 0) {
            await TimetableEntry.deleteMany({ _id: { $in: classIdsToDelete }, user: request.user!._id });
          }
        }
      }

      const settings = await TimetableSettings.findOneAndUpdate(
        { user: request.user!._id },
        { $set: { gridTimeSlots: input.gridTimeSlots } },
        { upsert: true, new: true }
      );
      const doc: any = settings.toObject();
      return sendSuccess(response, { gridTimeSlots: doc.gridTimeSlots });
    })
  );


  timetableRouter.get(
    "/",
      asyncHandler(async (request, response) => {
        const settings = await TimetableSettings.findOne({ user: request.user!._id });
        
        const query: any = { user: request.user!._id };
        if (settings?.activeImportBatchId) {
          query.importBatchId = settings.activeImportBatchId;
        } else {
          // Legacy fallback: return entries without batch IDs
          query.importBatchId = { $exists: false };
        }

        const items = await TimetableEntry.find(query).sort({
          days: 1,
          startTime: 1,
        });
        return sendSuccess(
          response,
          items.map((item) => {
            const doc: any = item.toObject();
            doc.id = doc._id;
            delete doc._id;
            delete doc.__v;
            delete doc.importBatchId;
            return doc;
          })
        );
      })
  );
timetableRouter.post(
  "/",
    asyncHandler(async (request, response) => {
      const input = z
        .object({
          subject: z.string().min(1).max(160),
          subjectCode: z.string().max(40).optional(),
          room: z.string().max(100).optional(),
          lecturer: z.string().max(120).optional(),
          day: z.number().int().min(0).max(6).optional(),
          days: z.array(z.number().int().min(0).max(6)).min(1, "Days cannot be empty").optional(),
          startTime: z.string().regex(/^\d{2}:\d{2}$/, "Invalid HH:MM format"),
          endTime: z.string().regex(/^\d{2}:\d{2}$/, "Invalid HH:MM format"),
          color: z.string().max(20).optional(),
          repeat: z.string().optional(),
          conflictAction: z.enum(["reject", "replace"]).optional().default("reject"),
          conflictClassId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
        })
        .parse(request.body);
      const days = input.days ?? [input.day ?? 1];
      
      const parseTime = (t: string) => { const [h, m] = t.split(":"); return parseInt(h as string) * 60 + parseInt(m as string); };
      if (parseTime(input.startTime) >= parseTime(input.endTime) || parseTime(input.startTime) >= 1440 || parseTime(input.endTime) > 1440) {
        throw new AppError(400, "End time must be after start time and within 24 hours", "INVALID_TIME");
      }

      const settings = await TimetableSettings.findOne({ user: request.user!._id });
      const activeBatchId = settings?.activeImportBatchId;

      const overlapQuery: any = {
        user: request.user!._id,
        days: { $in: days },
        startTime: { $lt: input.endTime },
        endTime: { $gt: input.startTime },
      };
      if (activeBatchId) {
        overlapQuery.importBatchId = activeBatchId;
      } else {
        overlapQuery.importBatchId = { $exists: false };
      }

      const overlap = await TimetableEntry.findOne(overlapQuery);

      if (overlap) {
        if (input.conflictAction !== "replace" || input.conflictClassId !== overlap._id.toString()) {
          throw new AppError(409, `${input.subject} overlaps with ${overlap.subject}`, "OVERLAPPING_CLASS", {
            conflict: {
              id: overlap._id.toString(),
              subject: overlap.subject,
              startTime: overlap.startTime,
              endTime: overlap.endTime,
            },
            actions: ["move_existing", "replace", "choose_another_time"],
          });
        }
      }

      const entryDocument = {
        subject: input.subject,
        subjectCode: input.subjectCode,
        room: input.room,
        lecturer: input.lecturer,
        startTime: input.startTime,
        endTime: input.endTime,
        color: input.color,
        days,
        user: request.user!._id,
        repeat: input.repeat === "Every week" || input.repeat === "weekly" ? "weekly" : "none",
        importBatchId: activeBatchId, // Tie manual insert to active batch
      };
      const item = overlap
        ? await TimetableEntry.findOneAndUpdate(
            { _id: overlap._id, user: request.user!._id },
            { $set: entryDocument },
            { new: true, runValidators: true },
          )
        : await TimetableEntry.create(entryDocument);
      if (!item) throw new AppError(409, "The conflicting class changed. Please try again.", "STALE_CONFLICT");
      if (overlap) await ScheduleOverride.deleteMany({ timetableClass: overlap._id, user: request.user!._id });
      const doc: any = item.toObject();
      doc.id = doc._id;
      delete doc._id;
      delete doc.__v;
      request.app.get("io")?.to(`user:${request.user!._id}`).emit("schedule:updated", { reason: "class_added" });
      return sendSuccess(response, doc, "Class added", 201);
    }),
);
timetableRouter.patch(
  "/:id",
    asyncHandler(async (request, response) => {
      if (!String(request.params.id).match(/^[0-9a-fA-F]{24}$/)) {
         throw new AppError(400, "Invalid class ID format", "INVALID_ID");
      }
      const input = z
        .object({
          subject: z.string().min(1).max(160).optional(),
          subjectCode: z.string().max(40).optional(),
          room: z.string().max(100).optional(),
          lecturer: z.string().max(120).optional(),
          day: z.number().int().min(0).max(6).optional(),
          days: z.array(z.number().int().min(0).max(6)).min(1, "Days cannot be empty").optional(),
          startTime: z.string().regex(/^\d{2}:\d{2}$/, "Invalid HH:MM format").optional(),
          endTime: z.string().regex(/^\d{2}:\d{2}$/, "Invalid HH:MM format").optional(),
          color: z.string().max(20).optional(),
          repeat: z.string().optional(),
        })
        .parse(request.body);
  
      const currentEntry = await TimetableEntry.findOne({ _id: request.params.id, user: request.user!._id });
      if (!currentEntry) throw new AppError(404, "Class not found", "CLASS_NOT_FOUND");
  
      const days = input.days ?? (input.day !== undefined ? [input.day] : currentEntry.days);
      const startTime = input.startTime ?? currentEntry.startTime;
      const endTime = input.endTime ?? currentEntry.endTime;
  
      const parseTime = (t: string) => { const [h, m] = t.split(":"); return parseInt(h as string) * 60 + parseInt(m as string); };
      if (parseTime(startTime) >= parseTime(endTime) || parseTime(startTime) >= 1440 || parseTime(endTime) > 1440) {
        throw new AppError(400, "End time must be after start time and within 24 hours", "INVALID_TIME");
      }

      const settings = await TimetableSettings.findOne({ user: request.user!._id });
      const activeBatchId = settings?.activeImportBatchId;

      const overlapQuery: any = {
        _id: { $ne: currentEntry._id },
        user: request.user!._id,
        days: { $in: days },
        startTime: { $lt: endTime },
        endTime: { $gt: startTime },
      };
      if (activeBatchId) {
        overlapQuery.importBatchId = activeBatchId;
      } else {
        overlapQuery.importBatchId = { $exists: false };
      }

      const overlap = await TimetableEntry.findOne(overlapQuery);

      if (overlap) {
        throw new AppError(409, `${currentEntry.subject} overlaps with ${overlap.subject}`, "OVERLAPPING_CLASS", {
          conflict: {
            id: overlap._id.toString(),
            subject: overlap.subject,
            startTime: overlap.startTime,
            endTime: overlap.endTime,
          },
          actions: ["reschedule", "choose_another_time"],
        });
      }

    const updatedFields: any = { ...input, days };
    if (input.repeat !== undefined) {
      updatedFields.repeat = input.repeat === "Every week" || input.repeat === "weekly" ? "weekly" : "none";
    }

      const item = await TimetableEntry.findOneAndUpdate(
        { _id: request.params.id, user: request.user!._id },
        { $set: updatedFields },
        { new: true, runValidators: true },
      );
      if (!item) throw new AppError(404, "Class not found", "CLASS_NOT_FOUND");
      
      const doc: any = item.toObject();
      doc.id = doc._id;
      delete doc._id;
      delete doc.__v;
      request.app.get("io")?.to(`user:${request.user!._id}`).emit("schedule:updated", { reason: "class_updated" });
      return sendSuccess(response, doc, "Class updated");
    }),
);
  timetableRouter.delete(
    "/:id",
      asyncHandler(async (request, response) => {
        if (!String(request.params.id).match(/^[0-9a-fA-F]{24}$/)) {
           throw new AppError(400, "Invalid class ID format", "INVALID_ID");
        }

        const settings = await TimetableSettings.findOne({ user: request.user!._id });
        const activeBatchId = settings?.activeImportBatchId;

        const deleteQuery: any = {
          _id: request.params.id,
          user: request.user!._id,
        };

        if (activeBatchId) {
          deleteQuery.importBatchId = activeBatchId;
        } else {
          deleteQuery.importBatchId = { $exists: false };
        }

        const result = await TimetableEntry.deleteOne(deleteQuery);
        
        if (result.deletedCount === 0) {
           throw new AppError(404, "Class not found", "CLASS_NOT_FOUND");
        }
        await ScheduleOverride.deleteMany({ timetableClass: request.params.id, user: request.user!._id });
        request.app.get("io")?.to(`user:${request.user!._id}`).emit("schedule:updated", { reason: "class_deleted" });
        return sendSuccess(response, null, "Class deleted");
      }),
  );



timetableRouter.post(
  "/bulk-replace",
  asyncHandler(async (request, response) => {
    const input = z.object({
      gridTimeSlots: z.array(z.object({
        id: z.string(),
        label: z.string(),
        start: z.string(),
        break: z.boolean().optional().default(false)
      })),
      entries: z.array(z.object({
        subject: z.string().min(1).max(160),
        subjectCode: z.string().max(40).optional().nullable(),
        room: z.string().max(100).optional().nullable(),
        lecturer: z.string().max(120).optional().nullable(),
        day: z.number().int().min(0).max(6).optional(),
        days: z.array(z.number().int().min(0).max(6)).min(1).optional(),
        startTime: z.string().regex(/^\d{2}:\d{2}$/),
        endTime: z.string().regex(/^\d{2}:\d{2}$/),
        color: z.string().max(20).optional(),
        repeat: z.string().optional(),
      }))
    }).parse(request.body);

    const parseTime = (t: string) => { const [h, m] = t.split(":"); return parseInt(h as string) * 60 + parseInt(m as string); };

    // Validate entries
    for (const entry of input.entries) {
      if (parseTime(entry.startTime) >= parseTime(entry.endTime) || parseTime(entry.startTime) >= 1440 || parseTime(entry.endTime) > 1440) {
        throw new AppError(400, "End time must be after start time and within 24 hours", "INVALID_TIME");
      }
    }

    const settings = await TimetableSettings.findOne({ user: request.user!._id });
    const baseRevision = settings?.timetableRevision || 0;
    const prevActiveBatchId = settings?.activeImportBatchId;
    const replacementStartedAt = new Date();

    const importBatchId = Date.now().toString() + Math.random().toString(36).substring(7);

    if (input.entries.length > 0) {
      const documents = input.entries.flatMap((e: any) => (e.days ?? [e.day ?? 1]).map((d: number) => ({
        user: request.user!._id,
        subject: e.subject,
        subjectCode: e.subjectCode,
        room: e.room,
        lecturer: e.lecturer,
        days: [d],
        startTime: e.startTime,
        endTime: e.endTime,
        color: e.color,
        repeat: e.repeat === "Every week" || e.repeat === "weekly" ? "weekly" : "none",
        importBatchId
      })));
      
      await TimetableEntry.insertMany(documents);
    }

    let updatedSettings;
    try {
      if (!settings) {
        try {
          updatedSettings = await TimetableSettings.create({
            user: request.user!._id,
            gridTimeSlots: input.gridTimeSlots,
            activeImportBatchId: importBatchId,
            timetableRevision: 1
          });
        } catch (e: any) {
          if (e.code === 11000) updatedSettings = null; // Concurrent creation
          else throw e;
        }
      } else {
        const revisionQuery = baseRevision === 0 
          ? { $or: [{ timetableRevision: 0 }, { timetableRevision: { $exists: false } }] }
          : { timetableRevision: baseRevision };

        updatedSettings = await TimetableSettings.findOneAndUpdate(
          { 
            user: request.user!._id, 
            ...revisionQuery
          },
          { 
            $set: { 
              gridTimeSlots: input.gridTimeSlots,
              activeImportBatchId: importBatchId
            },
            $inc: {
              timetableRevision: 1
            }
          },
          { new: true }
        );
      }
    } catch (settingsError) {
      await TimetableEntry.deleteMany({
        user: request.user!._id,
        importBatchId
      }).catch(err => console.error("Failed to cleanup orphaned batch on error", err));
      throw settingsError;
    }

    if (!updatedSettings) {
      // CAS failed: Another replacement occurred concurrently
      await TimetableEntry.deleteMany({
        user: request.user!._id,
        importBatchId
      }).catch(err => console.error("Failed to cleanup orphaned batch on conflict", err));
      throw new AppError(409, "Timetable changed during import. Please review and import again.", "CONCURRENT_IMPORT");
    }

    try {
      const cleanupConditions: any[] = [
        { importBatchId: { $exists: false } },
        { createdAt: { $lt: replacementStartedAt } }
      ];
      if (prevActiveBatchId) {
        cleanupConditions.push({ importBatchId: prevActiveBatchId });
      }

      await TimetableEntry.deleteMany({ 
        user: request.user!._id, 
        importBatchId: { $ne: importBatchId },
        $or: cleanupConditions
      });
      await ScheduleOverride.deleteMany({ user: request.user!._id });
    } catch (cleanupError) {
      console.error("Failed to cleanup stale batches", cleanupError);
    }

    const items = await TimetableEntry.find({ 
      user: request.user!._id,
      importBatchId 
    }).sort({ days: 1, startTime: 1 });
    
    const docs = items.map((item) => {
      const doc: any = item.toObject();
      doc.id = doc._id.toString();
      delete doc._id;
      delete doc.user;
      delete doc.importBatchId;
      return doc;
    });

    request.app.get("io")?.to(`user:${request.user!._id}`).emit("schedule:updated", { reason: "timetable_imported" });
    return sendSuccess(response, docs, "Timetable imported successfully", 201);
  })
);
