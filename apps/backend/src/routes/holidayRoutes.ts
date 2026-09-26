import { Router } from "express";
import { z } from "zod";
import { Holiday } from "../models/System.js";
import { asyncHandler } from "../utils/http.js";

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

    const holidays = await Holiday.find({
      date: {
        $gte: startDate,
        $lte: endDate
      }
    }).sort({ date: 1 });

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

    response.json({
      success: true,
      data: formatted
    });
  })
);
