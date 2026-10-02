import { Router } from "express";
import { z } from "zod";
import { Holiday } from "../models/System.js";
import { CustomHoliday } from "../models/Commerce.js";
import { AppError, asyncHandler, sendSuccess } from "../utils/http.js";

export const holidayRouter = Router();

const dateRangeSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format, must be YYYY-MM-DD"),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format, must be YYYY-MM-DD"),
}).refine(data => {
  return data.startDate <= data.endDate;
}, {
  message: "endDate must be strictly after or equal to startDate",
  path: ["endDate"]
});

// GET /api/holidays
holidayRouter.get(
  "/",
  asyncHandler(async (request, response) => {
    const { startDate, endDate } = dateRangeSchema.parse(request.query);

    const [holidays, customHolidays] = await Promise.all([
      Holiday.find({ date: { $gte: startDate, $lte: endDate } }).sort({ date: 1 }),
      CustomHoliday.find({
        user: request.user!._id,
        date: { $gte: startDate, $lte: endDate },
      }).sort({ date: 1 }),
    ]);

    const formatted = holidays.map(h => {
      const doc = h.toObject();
      return {
        id: doc._id,
        name: doc.name,
        date: doc.date,
        type: doc.type,
        description: doc.description,
      };
    });

    const customFormatted = customHolidays.map((holiday) => ({
      id: holiday._id,
      name: holiday.name,
      date: holiday.date,
      type: holiday.type,
      description: holiday.description,
      custom: true,
    }));

    response.json({
      success: true,
      data: [...formatted.map((holiday) => ({ ...holiday, custom: false })), ...customFormatted]
        .sort((a, b) => a.date.localeCompare(b.date))
    });
  })
);

const customHolidaySchema = z.object({
  date: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format, must be YYYY-MM-DD")
    .refine((value) => {
      const parsed = new Date(`${value}T12:00:00.000Z`);
      return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
    }, "Date is not a valid calendar date"),
  name: z.string().trim().min(1).max(160),
  type: z.enum(["custom", "no_class"]).default("no_class"),
  description: z.string().trim().max(500).optional(),
});

holidayRouter.post(
  "/",
  asyncHandler(async (request, response) => {
    const input = customHolidaySchema.parse(request.body);
    const holiday = await CustomHoliday.findOneAndUpdate(
      { user: request.user!._id, date: input.date },
      { $set: { ...input, user: request.user!._id } },
      { upsert: true, new: true, runValidators: true },
    );
    request.app.get("io")?.to(`user:${request.user!._id}`).emit("schedule:updated", { reason: "holiday_added" });
    return sendSuccess(response, holiday, "No-class day saved", 201);
  }),
);

holidayRouter.patch(
  "/:id",
  asyncHandler(async (request, response) => {
    const id = z.string().regex(/^[0-9a-fA-F]{24}$/).parse(request.params.id);
    const input = customHolidaySchema.partial().parse(request.body);
    const holiday = await CustomHoliday.findOneAndUpdate(
      { _id: id, user: request.user!._id },
      { $set: input },
      { new: true, runValidators: true },
    );
    if (!holiday) throw new AppError(404, "Custom holiday not found", "HOLIDAY_NOT_FOUND");
    request.app.get("io")?.to(`user:${request.user!._id}`).emit("schedule:updated", { reason: "holiday_updated" });
    return sendSuccess(response, holiday, "No-class day updated");
  }),
);

holidayRouter.delete(
  "/:id",
  asyncHandler(async (request, response) => {
    const id = z.string().regex(/^[0-9a-fA-F]{24}$/).parse(request.params.id);
    const holiday = await CustomHoliday.findOneAndDelete({ _id: id, user: request.user!._id });
    if (!holiday) throw new AppError(404, "Custom holiday not found", "HOLIDAY_NOT_FOUND");
    request.app.get("io")?.to(`user:${request.user!._id}`).emit("schedule:updated", { reason: "holiday_deleted" });
    return sendSuccess(response, null, "No-class day removed");
  }),
);
