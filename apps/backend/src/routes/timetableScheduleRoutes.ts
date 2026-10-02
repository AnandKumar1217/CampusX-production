import { Router } from "express";
import { z } from "zod";
import mongoose from "mongoose";

import {
  ScheduleOverride,
  SpecialClass,
  TimetableEntry,
  TimetableSettings,
} from "../models/Commerce.js";
import {
  getActiveTimetableEntries,
  getActualSchedule,
  getActualScheduleRange,
  LOCAL_DATE_PATTERN,
  TIME_PATTERN,
  timesOverlap,
  timeToMinutes,
} from "../services/scheduleResolver.js";
import { AppError, asyncHandler, sendSuccess } from "../utils/http.js";

export const timetableScheduleRouter = Router();

const dateValue = z.string()
  .regex(LOCAL_DATE_PATTERN, "Date must be YYYY-MM-DD")
  .refine((value) => {
    const parsed = new Date(`${value}T12:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, "Date is not a valid calendar date");
const timeValue = z.string().regex(TIME_PATTERN, "Time must be HH:MM");
const objectIdValue = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid ID");

function ensureTimeRange(startTime: string, endTime: string) {
  if (timeToMinutes(startTime) >= timeToMinutes(endTime)) {
    throw new AppError(400, "End time must be after start time", "INVALID_TIME");
  }
}

function emitScheduleUpdated(request: any, reason: string) {
  request.app.get("io")?.to(`user:${request.user!._id}`).emit("schedule:updated", { reason });
}

function conflictDetails(item: any) {
  return {
    id: item.id,
    baseClassId: item.baseClassId,
    source: item.source,
    subject: item.subject,
    startTime: item.startTime,
    endTime: item.endTime,
  };
}

function dateOnOrAfterForDay(date: string, day: number) {
  const value = new Date(`${date}T12:00:00.000Z`);
  const distance = (day - value.getUTCDay() + 7) % 7;
  value.setUTCDate(value.getUTCDate() + distance);
  return value.toISOString().slice(0, 10);
}

async function createOverride(
  userId: any,
  timetableClass: any,
  scope: "one_date" | "future",
  date: string,
  values: {
    newDay?: number;
    newStartTime?: string;
    newEndTime?: string;
    cancelled?: boolean;
    reason?: string;
    operationId?: string;
  },
) {
  const identity = scope === "one_date"
    ? { user: userId, timetableClass, scope, date }
    : { user: userId, timetableClass, scope, effectiveFrom: date };
  return ScheduleOverride.findOneAndUpdate(
    identity,
    {
      $set: {
        ...identity,
        ...values,
        ...(scope === "future" ? { effectiveFrom: date } : {}),
      },
    },
    { upsert: true, new: true, runValidators: true },
  );
}

async function applyChange(
  userId: any,
  entry: any,
  scope: "one_date" | "future" | "all",
  date: string,
  values: { newDay?: number; newStartTime?: string; newEndTime?: string; cancelled?: boolean; reason?: string; operationId?: string },
) {
  if (scope === "all") {
    if (values.cancelled) {
      await TimetableEntry.deleteOne({ _id: entry._id, user: userId });
      await ScheduleOverride.deleteMany({ timetableClass: entry._id, user: userId });
      return null;
    }
    const update: Record<string, unknown> = {};
    if (values.newDay !== undefined) update.days = [values.newDay];
    if (values.newStartTime) update.startTime = values.newStartTime;
    if (values.newEndTime) update.endTime = values.newEndTime;
    const changed = await TimetableEntry.findOneAndUpdate(
      { _id: entry._id, user: userId },
      { $set: update },
      { new: true, runValidators: true },
    );
    await ScheduleOverride.deleteMany({ timetableClass: entry._id, user: userId });
    return changed;
  }
  return createOverride(userId, entry._id, scope, date, values);
}

timetableScheduleRouter.get(
  "/schedule",
  asyncHandler(async (request, response) => {
    const { date } = z.object({ date: dateValue }).parse(request.query);
    return sendSuccess(response, await getActualSchedule(request.user!._id, date));
  }),
);

timetableScheduleRouter.get(
  "/schedule-range",
  asyncHandler(async (request, response) => {
    const { startDate, endDate } = z.object({ startDate: dateValue, endDate: dateValue })
      .refine((value) => value.startDate <= value.endDate, { path: ["endDate"], message: "End date must follow start date" })
      .refine((value) => {
        const days = (Date.parse(`${value.endDate}T12:00:00Z`) - Date.parse(`${value.startDate}T12:00:00Z`)) / 86_400_000;
        return days <= 42;
      }, { path: ["endDate"], message: "Date range cannot exceed 42 days" })
      .parse(request.query);
    return sendSuccess(response, await getActualScheduleRange(request.user!._id, startDate, endDate));
  }),
);

const rescheduleSchema = z.object({
  scope: z.enum(["one_date", "future", "all"]),
  date: dateValue,
  newDay: z.number().int().min(0).max(6).optional(),
  newStartTime: timeValue,
  newEndTime: timeValue,
  conflictAction: z.enum(["reject", "swap", "move_existing", "replace"]).default("reject"),
  conflictClassId: z.string().optional(),
  moveExistingTo: z.object({
    day: z.number().int().min(0).max(6).optional(),
    startTime: timeValue,
    endTime: timeValue,
  }).optional(),
  reason: z.string().max(300).optional(),
});

timetableScheduleRouter.post(
  "/:id/reschedule",
  asyncHandler(async (request, response) => {
    const id = objectIdValue.parse(request.params.id);
    const input = rescheduleSchema.parse(request.body);
    ensureTimeRange(input.newStartTime, input.newEndTime);
    const entry = await TimetableEntry.findOne({ _id: id, user: request.user!._id });
    if (!entry) throw new AppError(404, "Class not found", "CLASS_NOT_FOUND");

    const conflictDate = input.scope !== "one_date" && input.newDay !== undefined
      ? dateOnOrAfterForDay(input.date, input.newDay)
      : input.date;
    const actual = await getActualSchedule(request.user!._id, conflictDate);
    const conflict = actual.classes.find((item: any) =>
      item.baseClassId !== id
      && item.id !== id
      && timesOverlap(input.newStartTime, input.newEndTime, item.startTime, item.endTime),
    );
    if (conflict && input.conflictAction === "reject") {
      throw new AppError(409, `${entry.subject} overlaps with ${conflict.subject}`, "SCHEDULE_CONFLICT", {
        requested: { subject: entry.subject, startTime: input.newStartTime, endTime: input.newEndTime },
        conflict: conflictDetails(conflict),
        actions: ["swap", "move_existing", "replace", "choose_another_time"],
      });
    }

    const operationId = conflict && input.scope !== "all"
      ? `schedule-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      : undefined;
    if (conflict) {
      if (input.conflictClassId && ![conflict.id, conflict.baseClassId].includes(input.conflictClassId)) {
        throw new AppError(409, "The conflicting class changed. Please try again.", "STALE_CONFLICT");
      }
      if (conflict.source === "special" && input.scope !== "one_date") {
        throw new AppError(409, "A one-date special class occupies this time", "SPECIAL_CLASS_CONFLICT", conflictDetails(conflict));
      }
      const conflictingEntry = conflict.source === "base"
        ? await TimetableEntry.findOne({ _id: conflict.baseClassId, user: request.user!._id })
        : null;

      if (input.conflictAction === "replace") {
        if (conflict.source === "special") await SpecialClass.deleteOne({ _id: conflict.id, user: request.user!._id });
        else if (conflictingEntry) await applyChange(request.user!._id, conflictingEntry, input.scope, input.date, { cancelled: true, operationId });
      } else if (input.conflictAction === "swap") {
        if (!conflictingEntry) throw new AppError(409, "Special classes cannot be swapped", "SWAP_NOT_SUPPORTED");
        const current = actual.classes.find((item: any) => item.baseClassId === id || item.id === id);
        if (!current) throw new AppError(409, "The selected occurrence is not scheduled on this date", "OCCURRENCE_NOT_FOUND");
        await applyChange(request.user!._id, conflictingEntry, input.scope, input.date, {
          newDay: input.newDay ?? current.day,
          newStartTime: current.startTime,
          newEndTime: current.endTime,
          reason: `Swapped with ${entry.subject}`,
          operationId,
        });
      } else if (input.conflictAction === "move_existing") {
        if (!conflictingEntry || !input.moveExistingTo) {
          throw new AppError(422, "Choose a new time for the existing class", "MOVE_TIME_REQUIRED");
        }
        ensureTimeRange(input.moveExistingTo.startTime, input.moveExistingTo.endTime);
        const moveTargetConflict = actual.classes.find((item: any) =>
          item.baseClassId !== id
          && item.id !== id
          && item.baseClassId !== conflictingEntry._id.toString()
          && item.id !== conflictingEntry._id.toString()
          && timesOverlap(input.moveExistingTo!.startTime, input.moveExistingTo!.endTime, item.startTime, item.endTime),
        );
        if (moveTargetConflict) {
          throw new AppError(409, `${conflictingEntry.subject} would overlap with ${moveTargetConflict.subject}`, "MOVE_TARGET_CONFLICT", {
            conflict: conflictDetails(moveTargetConflict),
          });
        }
        await applyChange(request.user!._id, conflictingEntry, input.scope, input.date, {
          newDay: input.moveExistingTo.day,
          newStartTime: input.moveExistingTo.startTime,
          newEndTime: input.moveExistingTo.endTime,
          reason: `Moved to make room for ${entry.subject}`,
          operationId,
        });
      }
    }

    const result = await applyChange(request.user!._id, entry, input.scope, input.date, {
      newDay: input.newDay,
      newStartTime: input.newStartTime,
      newEndTime: input.newEndTime,
      reason: input.reason,
      operationId,
    });
    emitScheduleUpdated(request, "class_rescheduled");
    return sendSuccess(response, result, "Class rescheduled");
  }),
);

timetableScheduleRouter.post(
  "/:id/cancel",
  asyncHandler(async (request, response) => {
    const id = objectIdValue.parse(request.params.id);
    const input = z.object({
      scope: z.enum(["one_date", "future"]).default("one_date"),
      date: dateValue,
      reason: z.string().max(300).optional(),
    }).parse(request.body);
    const entry = await TimetableEntry.findOne({ _id: id, user: request.user!._id });
    if (!entry) throw new AppError(404, "Class not found", "CLASS_NOT_FOUND");
    const result = await applyChange(request.user!._id, entry, input.scope, input.date, {
      cancelled: true,
      reason: input.reason,
    });
    emitScheduleUpdated(request, "class_cancelled");
    return sendSuccess(response, result, "Class cancelled");
  }),
);

timetableScheduleRouter.post(
  "/:id/restore",
  asyncHandler(async (request, response) => {
    const id = objectIdValue.parse(request.params.id);
    const input = z.object({ date: dateValue.optional(), overrideId: objectIdValue.optional() })
      .refine((value) => Boolean(value.date || value.overrideId), "Date or overrideId is required")
      .parse(request.body);
    const entry = await TimetableEntry.findOne({ _id: id, user: request.user!._id });
    if (!entry) throw new AppError(404, "Class not found", "CLASS_NOT_FOUND");
    const query: Record<string, unknown> = { user: request.user!._id, timetableClass: entry._id };
    if (input.overrideId) query._id = input.overrideId;
    else query.$or = [{ date: input.date }, { effectiveFrom: input.date }];
    const matchingOverrides = await ScheduleOverride.find(query).select("operationId");
    const operationIds = matchingOverrides.flatMap((override) => override.operationId ? [override.operationId] : []);
    const removed = operationIds.length
      ? await ScheduleOverride.deleteMany({ user: request.user!._id, operationId: { $in: operationIds } })
      : await ScheduleOverride.deleteMany(query);
    emitScheduleUpdated(request, "schedule_restored");
    return sendSuccess(response, { removed: removed.deletedCount }, "Original schedule restored");
  }),
);

const specialClassSchema = z.object({
  date: dateValue,
  subject: z.string().trim().min(1).max(160),
  subjectCode: z.string().trim().max(40).optional(),
  room: z.string().trim().max(100).optional(),
  lecturer: z.string().trim().max(120).optional(),
  startTime: timeValue,
  endTime: timeValue,
  color: z.string().max(20).optional(),
});

timetableScheduleRouter.post(
  "/special",
  asyncHandler(async (request, response) => {
    const input = specialClassSchema.parse(request.body);
    ensureTimeRange(input.startTime, input.endTime);
    const schedule = await getActualSchedule(request.user!._id, input.date);
    if (schedule.holiday) {
      throw new AppError(409, `${schedule.holiday.name} is a no-class day`, "NO_CLASS_DAY", schedule.holiday);
    }
    const conflict = schedule.classes.find((item: any) => timesOverlap(input.startTime, input.endTime, item.startTime, item.endTime));
    if (conflict) {
      throw new AppError(409, `${input.subject} overlaps with ${conflict.subject}`, "SCHEDULE_CONFLICT", {
        conflict: conflictDetails(conflict), actions: ["choose_another_time"],
      });
    }
    const item = await SpecialClass.create({ ...input, user: request.user!._id });
    emitScheduleUpdated(request, "special_class_added");
    return sendSuccess(response, item, "Special class added", 201);
  }),
);

timetableScheduleRouter.patch(
  "/special/:id",
  asyncHandler(async (request, response) => {
    const id = objectIdValue.parse(request.params.id);
    const input = specialClassSchema.partial().parse(request.body);
    const current = await SpecialClass.findOne({ _id: id, user: request.user!._id });
    if (!current) throw new AppError(404, "Special class not found", "SPECIAL_CLASS_NOT_FOUND");
    const start = input.startTime ?? current.startTime;
    const end = input.endTime ?? current.endTime;
    const date = input.date ?? current.date;
    ensureTimeRange(start, end);
    const schedule = await getActualSchedule(request.user!._id, date);
    if (schedule.holiday) {
      throw new AppError(409, `${schedule.holiday.name} is a no-class day`, "NO_CLASS_DAY", schedule.holiday);
    }
    const conflict = schedule.classes.find((item: any) =>
      item.id !== id && timesOverlap(start, end, item.startTime, item.endTime),
    );
    if (conflict) {
      throw new AppError(409, `${current.subject} overlaps with ${conflict.subject}`, "SCHEDULE_CONFLICT", {
        conflict: conflictDetails(conflict), actions: ["choose_another_time"],
      });
    }
    const item = await SpecialClass.findOneAndUpdate(
      { _id: id, user: request.user!._id }, { $set: input }, { new: true, runValidators: true },
    );
    emitScheduleUpdated(request, "special_class_updated");
    return sendSuccess(response, item, "Special class updated");
  }),
);

timetableScheduleRouter.delete(
  "/special/:id",
  asyncHandler(async (request, response) => {
    const id = objectIdValue.parse(request.params.id);
    const item = await SpecialClass.findOneAndDelete({ _id: id, user: request.user!._id });
    if (!item) throw new AppError(404, "Special class not found", "SPECIAL_CLASS_NOT_FOUND");
    emitScheduleUpdated(request, "special_class_deleted");
    return sendSuccess(response, null, "Special class deleted");
  }),
);

const importEntrySchema = z.object({
  subject: z.string().trim().min(1).max(160),
  subjectCode: z.string().trim().max(40).optional().nullable(),
  room: z.string().trim().max(100).optional().nullable(),
  lecturer: z.string().trim().max(120).optional().nullable(),
  day: z.number().int().min(0).max(6).optional(),
  days: z.array(z.number().int().min(0).max(6)).min(1).optional(),
  startTime: timeValue,
  endTime: timeValue,
  color: z.string().max(20).optional(),
});

timetableScheduleRouter.post(
  "/import",
  asyncHandler(async (request, response) => {
    const input = z.object({
      mode: z.enum(["merge", "replace"]).default("replace").optional(),
      gridTimeSlots: z.array(z.object({
        id: z.string(), label: z.string(), start: timeValue, end: timeValue.optional(), break: z.boolean().optional().default(false),
      })).default([]),
      entries: z.array(importEntrySchema).min(1),
    }).parse(request.body);
    const normalized = input.entries.flatMap((entry) => (entry.days ?? [entry.day ?? 1]).map((day) => ({ ...entry, day })));
    for (const entry of normalized) ensureTimeRange(entry.startTime, entry.endTime);
    const seen = new Set<string>();
    let duplicateInputCount = 0;
    const unique = normalized.filter((entry) => {
      const lowerSubject = entry.subject.trim().toLowerCase();
      if (["break", "short break", "lunch", "interval"].includes(lowerSubject)) return false;
      const key = `${entry.subject.toLocaleLowerCase().replace(/[^a-z0-9]/g, "")}|${entry.day}|${entry.startTime}|${entry.endTime}`;
      if (seen.has(key)) { duplicateInputCount += 1; return false; }
      seen.add(key);
      return true;
    });

    const conflicts: any[] = [];
    for (let index = 0; index < unique.length; index += 1) {
      for (let otherIndex = index + 1; otherIndex < unique.length; otherIndex += 1) {
        const candidate = unique[index]!;
        const other = unique[otherIndex]!;
        if (candidate.day === other.day && timesOverlap(candidate.startTime, candidate.endTime, other.startTime, other.endTime)) {
          conflicts.push({ candidate, existing: { subject: other.subject, startTime: other.startTime, endTime: other.endTime, source: "import" } });
        }
      }
    }
    
    if (conflicts.length) {
      throw new AppError(409, `${conflicts.length} imported classes conflict with each other`, "IMPORT_CONFLICTS", { conflicts, duplicates: [] });
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    let addedCount = 0;
    try {
      await TimetableEntry.deleteMany({ user: request.user!._id }, { session });
      await ScheduleOverride.deleteMany({ user: request.user!._id }, { session });
      await SpecialClass.deleteMany({ user: request.user!._id }, { session });

      const importBatchId = `import-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      
      await TimetableSettings.findOneAndUpdate(
        { user: request.user!._id },
        { $set: { activeImportBatchId: importBatchId, gridTimeSlots: input.gridTimeSlots }, $inc: { timetableRevision: 1 } },
        { upsert: true, new: true, session },
      );

      const documents = unique.map((entry) => ({
        user: request.user!._id,
        subject: entry.subject,
        subjectCode: entry.subjectCode,
        room: entry.room,
        lecturer: entry.lecturer,
        days: [entry.day],
        startTime: entry.startTime,
        endTime: entry.endTime,
        color: entry.color,
        repeat: "weekly",
        importBatchId,
      }));

      if (documents.length) {
        await TimetableEntry.insertMany(documents, { session });
        addedCount = documents.length;
      }

      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }

    emitScheduleUpdated(request, "timetable_imported");
    return sendSuccess(response, { added: addedCount, skippedDuplicates: duplicateInputCount, mode: "replace" }, "Timetable imported", 201);
  }),
);
