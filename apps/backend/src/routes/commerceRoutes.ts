import { Router } from "express";
import { z } from "zod";

import {
  Event,
  MarketplaceListing,
  TimetableEntry,
  TimetableSettings,
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
      $or: [
        { 
          draft: { $ne: true },
          $or: [
            { endsAt: { $gte: new Date() } },
            { endsAt: null, startsAt: { $gte: new Date() } },
            { endsAt: { $exists: false }, startsAt: { $gte: new Date() } }
          ]
        },
        { creator: request.user!._id }
      ]
    };
    if (request.query.category) {
      filter.category = request.query.category;
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
        description: z.string().max(5000).optional(),
        imageUrl: z.url().optional(),
        imagePublicId: z.string().optional(),
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
    const item = await Event.create({ ...input, creator: request.user!._id });
    const io = request.app.get("io");
    if (!item.draft) io?.emit("event:created", { eventId: item._id.toString() });
    
    return sendSuccess(
      response,
      item,
      "Event created",
      201,
    );
  }),
);
eventRouter.get(
  "/saved",
  asyncHandler(async (request, response) => {
    const saved = await SavedItem.find({ user: request.user!._id, itemType: "event" })
      .sort({ createdAt: -1 });
    const ids = saved.map((entry) => entry.item);
    const events = await Event.find({ _id: { $in: ids }, draft: { $ne: true } })
      .populate("creator", "name username avatarUrl");
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
    if (item.draft && item.creator._id.toString() !== request.user!._id.toString())
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
      draft: z.boolean().optional(),
    }).parse(request.body);
    const event = await Event.findById(request.params.id);
    if (!event)
      throw new AppError(404, "Event not found", "EVENT_NOT_FOUND");
    
    if (event.creator.toString() !== request.user!._id.toString()) {
      throw new AppError(403, "Not authorized to modify this event", "FORBIDDEN");
    }
    
    const oldPublicId = event.imagePublicId;
    const item = await Event.findByIdAndUpdate(
      event._id,
      { $set: input },
      { new: true, runValidators: true },
    );
    
    if (input.imagePublicId && oldPublicId && input.imagePublicId !== oldPublicId) {
      await cloudinaryService.deleteImage(oldPublicId).catch(console.error);
    }
    
    if (item && !item.draft && item.attendees && item.attendees.length > 0) {
      const goingAttendees = item.attendees.filter((a: any) => a.status === "going").map((a: any) => a.user);
      if (goingAttendees.length > 0) {
        const notifs = goingAttendees.map((userId: any) => ({
          user: userId,
          actor: request.user!._id,
          type: "event_update",
          title: `Event updated: ${item.title}`,
          target: { route: "EventDetails", params: { eventId: item._id.toString() } }
        }));
        await Notification.insertMany(notifs).catch(console.error);
      }
    }
    
    const io = request.app.get("io");
    if (item?.draft && !event.draft) io?.emit("event:deleted", { eventId: item._id.toString() });
    else if (item?.draft) io?.to(`user:${request.user!._id}`).emit("event:updated", { eventId: item._id.toString() });
    else io?.emit(event.draft ? "event:created" : "event:updated", { eventId: item?._id.toString() });

    return sendSuccess(response, item, "Event updated");
  }),
);
eventRouter.post(
  "/:id/attendance",
  asyncHandler(async (request, response) => {
    const { status } = z
      .object({ status: z.enum(["none", "maybe", "going"]) })
      .parse(request.body);
    const visibleEvent = await Event.exists({ _id: request.params.id, draft: { $ne: true } });
    if (!visibleEvent) throw new AppError(404, "Event not found", "EVENT_NOT_FOUND");
    await Event.updateOne(
      { _id: request.params.id },
      { $pull: { attendees: { user: request.user!._id } } },
    );
    if (status !== "none") {
      await Event.updateOne(
        { _id: request.params.id },
        { $push: { attendees: { user: request.user!._id, status } } },
      );
    }
    
    if (status === "going") {
      const event = await Event.findById(request.params.id);
      if (event && event.creator.toString() !== request.user!._id.toString()) {
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
      }
    }
    
    const io = request.app.get("io");
    io?.emit("event:updated", { eventId: request.params.id });
    
    return sendSuccess(response, { status }, "Attendance updated");
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
    
    const goingAttendees = event.attendees.filter((a: any) => a.status === "going").map((a: any) => a.user);
    if (goingAttendees.length > 0) {
       const notifs = goingAttendees.map((userId: any) => ({
           user: userId,
           actor: request.user!._id,
           type: "event_cancel",
           title: `Event cancelled: ${event.title}`
       }));
       await Notification.insertMany(notifs).catch(console.error);
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
      await SavedItem.updateOne(filter, { $setOnInsert: filter }, { upsert: true });
    } else {
      await SavedItem.deleteOne(filter);
    }
    request.app.get("io")?.to(`user:${request.user!._id}`).emit("event:saved", { eventId: request.params.id, saved });
    return sendSuccess(response, { saved }, saved ? "Event saved" : "Event removed from saved");
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
        imagePublicIds: z.array(z.string()).max(5).default([]),
        condition: z.string().max(80).optional(),
        location: z.string().max(200).optional(),
        draft: z.boolean().default(false),
      })
      .parse(request.body);
    const item = await MarketplaceListing.create({
      ...input,
      seller: request.user!._id,
      status: input.draft ? "draft" : "active",
    });

    if (!input.draft) {
      const io = request.app.get("io");
      io?.emit("listing:created", { listingId: item._id.toString() });
    }

    return sendSuccess(
      response,
      item,
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
  "/saved",
  asyncHandler(async (request, response) => {
    const savedItems = await SavedItem.find({ user: request.user!._id, itemType: "listing" });
    const listingIds = savedItems.map(s => s.item);
    
    const items = await MarketplaceListing.find({ _id: { $in: listingIds }, status: { $ne: "draft" } })
      .populate("seller", "name username avatarUrl verified")
      .sort({ createdAt: -1 });
      
    return sendSuccess(response, items);
  })
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
    if (item.status === "draft" && item.seller._id.toString() !== request.user!._id.toString())
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
        imagePublicIds: z.array(z.string()).max(5).optional(),
      })
      .parse(request.body);

    const oldListing = await MarketplaceListing.findById(request.params.id);

    if (!oldListing)
      throw new AppError(
        404,
        "Listing not found",
        "LISTING_NOT_FOUND",
      );

    if (oldListing.seller.toString() !== request.user!._id.toString()) {
      throw new AppError(
        403,
        "Not authorized to modify this listing",
        "FORBIDDEN",
      );
    }

    const item = await MarketplaceListing.findOneAndUpdate(
      { _id: request.params.id, seller: request.user!._id },
      { $set: input },
      { new: true, runValidators: true },
    );

    if (input.imagePublicIds && item) {
      const oldIds = oldListing.imagePublicIds || [];
      const newIds = input.imagePublicIds;
      const removedIds = oldIds.filter((id: string) => !newIds.includes(id));
      for (const removedId of removedIds) {
        await cloudinaryService.deleteImage(removedId).catch(console.error);
      }
    }

    if (input.status === "sold" && oldListing.status !== "sold" && item) {
      const savedItems = await SavedItem.find({ itemType: "listing", item: item._id });
      const userIds = savedItems.map(s => s.user.toString()).filter(id => id !== request.user!._id.toString());
      
      if (userIds.length > 0) {
        const notifs = userIds.map(userId => ({
          user: userId,
          actor: request.user!._id,
          type: "listing_sold",
          title: `An item you saved was sold: ${item.title}`,
          target: { route: "ListingDetails", params: { listingId: item._id.toString() } }
        }));
        await Notification.insertMany(notifs).catch(console.error);
      }
      const io = request.app.get("io");
      if (oldListing.status === "draft") io?.to(`user:${request.user!._id}`).emit("listing:updated", { listingId: item._id.toString() });
      else io?.emit("listing:sold", { listingId: item._id.toString() });
    } else if (item) {
      const io = request.app.get("io");
      if (item.status === "draft" && oldListing.status === "draft") io?.to(`user:${request.user!._id}`).emit("listing:updated", { listingId: item._id.toString() });
      else io?.emit("listing:updated", { listingId: item._id.toString() });
    }

    return sendSuccess(response, item, "Listing updated");
  }),
);
marketplaceRouter.delete(
  "/:id",
  asyncHandler(async (request, response) => {
    const item = await MarketplaceListing.findById(request.params.id);
    if (!item)
      throw new AppError(
        404,
        "Listing not found",
        "LISTING_NOT_FOUND",
      );

    if (item.seller.toString() !== request.user!._id.toString()) {
      throw new AppError(
        403,
        "Not authorized to delete this listing",
        "FORBIDDEN",
      );
    }

    if (item.imagePublicIds && item.imagePublicIds.length > 0) {
      for (const publicId of item.imagePublicIds) {
        await cloudinaryService.deleteImage(publicId).catch(console.error);
      }
    }

    await item.deleteOne();
    await SavedItem.deleteMany({ itemType: "listing", item: item._id });

    const io = request.app.get("io");
    if (item.status === "draft") io?.to(`user:${request.user!._id}`).emit("listing:deleted", { listingId: request.params.id });
    else io?.emit("listing:deleted", { listingId: request.params.id });

    return sendSuccess(response, null, "Listing deleted");
  }),
);

marketplaceRouter.post(
  "/:id/save",
  asyncHandler(async (request, response) => {
    const item = await MarketplaceListing.findOne({ _id: request.params.id, status: "active" });
    if (!item) throw new AppError(404, "Listing not found", "LISTING_NOT_FOUND");
    
    if (item.seller.toString() === request.user!._id.toString()) {
      throw new AppError(400, "Cannot save your own listing", "BAD_REQUEST");
    }
    
    await SavedItem.findOneAndUpdate(
      { user: request.user!._id, itemType: "listing", item: item._id },
      { user: request.user!._id, itemType: "listing", item: item._id },
      { upsert: true, new: true }
    );
    request.app.get("io")?.to(`user:${request.user!._id}`).emit("listing:saved", { listingId: item._id.toString(), saved: true });
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
    request.app.get("io")?.to(`user:${request.user!._id}`).emit("listing:saved", { listingId: request.params.id, saved: false });
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
          room: z.string().max(100).optional(),
          lecturer: z.string().max(120).optional(),
          day: z.number().int().min(0).max(6).optional(),
          days: z.array(z.number().int().min(0).max(6)).min(1, "Days cannot be empty").optional(),
          startTime: z.string().regex(/^\d{2}:\d{2}$/, "Invalid HH:MM format"),
          endTime: z.string().regex(/^\d{2}:\d{2}$/, "Invalid HH:MM format"),
          color: z.string().max(20).optional(),
          repeat: z.string().optional(),
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
        throw new AppError(409, "This class overlaps with another class.", "OVERLAPPING_CLASS");
      }

      const item = await TimetableEntry.create({
        ...input,
        days,
        user: request.user!._id,
        repeat: input.repeat === "Every week" ? "weekly" : "none",
        importBatchId: activeBatchId, // Tie manual insert to active batch
      });
      const doc: any = item.toObject();
      doc.id = doc._id;
      delete doc._id;
      delete doc.__v;
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
        throw new AppError(409, "This class overlaps with another class.", "OVERLAPPING_CLASS");
      }

    const updatedFields: any = { ...input, days };
    if (input.repeat !== undefined) {
      updatedFields.repeat = input.repeat === "Every week" ? "weekly" : "none";
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
        room: e.room,
        lecturer: e.lecturer,
        days: [d],
        startTime: e.startTime,
        endTime: e.endTime,
        color: e.color,
        repeat: e.repeat === "Every week" ? "weekly" : "none",
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

    return sendSuccess(response, docs, "Timetable imported successfully", 201);
  })
);
