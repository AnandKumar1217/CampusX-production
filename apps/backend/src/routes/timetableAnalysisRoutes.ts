import { Router } from "express";
import { z } from "zod";
import multer from "multer";
import { AppError, asyncHandler, sendSuccess } from "../utils/http.js";
import { analyzeTimetable } from "../services/timetable/timetableAnalysisService.js";
import { rateLimit } from "express-rate-limit";

export const timetableAnalysisRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024, // 20 MB max
  }
});

const analyzeRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 20, // 20 uploads per hour per user/IP
  message: "Too many timetable imports attempted. Please try again later.",
  standardHeaders: "draft-7",
  legacyHeaders: false,
});

timetableAnalysisRouter.post(
  "/analyze",
  analyzeRateLimiter,
  upload.single("file"),
  asyncHandler(async (request, response) => {
    if (!request.file) {
      throw new AppError(400, "No file provided", "NO_FILE");
    }

    const sourceType = request.body.sourceType as "image" | "camera";
    if (!["image", "camera"].includes(sourceType)) {
      throw new AppError(400, "Invalid sourceType", "INVALID_SOURCE_TYPE");
    }

    const { buffer, mimetype, originalname } = request.file;
    const localOcrJson = request.body.localOcrJson; // Optional

    try {
      const result = await analyzeTimetable(
        buffer,
        mimetype,
        sourceType,
        originalname,
        localOcrJson
      );

      return sendSuccess(response, result, "Analysis complete", 200);
    } catch (e: any) {
      console.error("[TimetableAnalysis] Route Error:", e);
      throw new AppError(500, "Failed to analyze timetable", "ANALYSIS_ERROR");
    }
  })
);
