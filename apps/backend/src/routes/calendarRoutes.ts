import { Router } from "express";
import { z } from "zod";

import { CalendarItem } from "../models/Commerce.js";
import { AppError, asyncHandler, sendSuccess } from "../utils/http.js";

export const calendarRouter = Router();

// Zod schemas for validation
const calendarItemBase = z.object({
  title: z.string().min(1).max(200),
  type: z.enum(["exam", "assignment", "reminder", "personal"]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format, must be YYYY-MM-DD"),
  allDay: z.boolean().default(true),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Invalid HH:MM format").optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "Invalid HH:MM format").optional(),
  notes: z.string().max(2000).optional(),
  location: z.string().max(200).optional(),
  color: z.string().max(20).optional(),
}).refine(data => {
  if (data.allDay === false && !data.startTime) {
    return false;
  }
  return true;
}, {
  message: "startTime is required when allDay is false",
  path: ["startTime"]
}).refine(data => {
  if (data.startTime && data.endTime) {
    return data.endTime > data.startTime;
  }
  return true;
}, {
  message: "endTime must be strictly after startTime",
  path: ["endTime"]
});

const calendarItemUpdate = z.object({
  title: z.string().min(1).max(200).optional(),
  type: z.enum(["exam", "assignment", "reminder", "personal"]).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format, must be YYYY-MM-DD").optional(),
  allDay: z.boolean().optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Invalid HH:MM format").optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "Invalid HH:MM format").optional(),
  notes: z.string().max(2000).optional(),
  location: z.string().max(200).optional(),
  color: z.string().max(20).optional(),
});

// GET /api/calendar
calendarRouter.get(
  "/",
  asyncHandler(async (request, response) => {
    const { startDate, endDate } = request.query;

    const filter: any = { user: request.user!._id };

    if (startDate || endDate) {
      filter.date = {};
      if (typeof startDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
        filter.date.$gte = startDate;
      }
      if (typeof endDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
        filter.date.$lte = endDate;
      }
    }

    const items = await CalendarItem.find(filter).sort({ date: 1, startTime: 1 });

    return sendSuccess(
      response,
      items.map(item => {
        const doc: any = item.toObject();
        doc.id = doc._id;
        delete doc._id;
        delete doc.__v;
        delete doc.user;
        return doc;
      })
    );
  })
);

// POST /api/calendar
calendarRouter.post(
  "/",
  asyncHandler(async (request, response) => {
    const input = calendarItemBase.parse(request.body);

    const item = new CalendarItem({
      ...input,
      user: request.user!._id,
    });

    await item.save();

    const doc: any = item.toObject();
    doc.id = doc._id;
    delete doc._id;
    delete doc.__v;
    delete doc.user;

    return sendSuccess(response, doc, "Calendar item created", 201);
  })
);

// PATCH /api/calendar/:id
calendarRouter.patch(
  "/:id",
  asyncHandler(async (request, response) => {
    const input = calendarItemUpdate.parse(request.body);

    const item = await CalendarItem.findOne({ _id: request.params.id, user: request.user!._id });
    if (!item) {
      throw new AppError(404, "Calendar item not found");
    }

    // Check validation manually for partial updates since Zod refine might be bypassed
    const newAllDay = input.allDay !== undefined ? input.allDay : item.allDay;
    const newStartTime = input.startTime !== undefined ? input.startTime : item.startTime;
    const newEndTime = input.endTime !== undefined ? input.endTime : item.endTime;

    if (newAllDay === false && !newStartTime) {
      throw new AppError(400, "startTime is required when allDay is false");
    }

    if (newStartTime && newEndTime && newEndTime <= newStartTime) {
      throw new AppError(400, "endTime must be strictly after startTime");
    }

    Object.assign(item, input);
    await item.save();

    const doc: any = item.toObject();
    doc.id = doc._id;
    delete doc._id;
    delete doc.__v;
    delete doc.user;

    return sendSuccess(response, doc, "Calendar item updated");
  })
);

// DELETE /api/calendar/:id
calendarRouter.delete(
  "/:id",
  asyncHandler(async (request, response) => {
    // Check id length
    if (!request.params.id || request.params.id.length !== 24) {
      throw new AppError(404, "Calendar item not found");
    }
    const item = await CalendarItem.findOneAndDelete({ _id: request.params.id, user: request.user!._id });
    if (!item) {
      throw new AppError(404, "Calendar item not found");
    }

    return sendSuccess(response, null, "Calendar item deleted");
  })
);
