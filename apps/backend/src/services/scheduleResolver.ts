import type { Types } from "mongoose";

import {
  CustomHoliday,
  ScheduleOverride,
  SpecialClass,
  TimetableEntry,
  TimetableSettings,
} from "../models/Commerce.js";
import { Holiday } from "../models/System.js";

export const LOCAL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export function dayOfWeekForDate(date: string) {
  return new Date(`${date}T12:00:00.000Z`).getUTCDay();
}

export function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours! * 60 + minutes!;
}

export function timesOverlap(
  firstStart: string,
  firstEnd: string,
  secondStart: string,
  secondEnd: string,
) {
  return timeToMinutes(firstStart) < timeToMinutes(secondEnd)
    && timeToMinutes(firstEnd) > timeToMinutes(secondStart);
}

export async function getActiveTimetableEntries(userId: string | Types.ObjectId) {
  const settings = await TimetableSettings.findOne({ user: userId });
  const query: Record<string, unknown> = { user: userId };
  query.importBatchId = settings?.activeImportBatchId
    ? settings.activeImportBatchId
    : { $exists: false };
  return TimetableEntry.find(query).sort({ days: 1, startTime: 1 });
}

function serializeBaseClass(entry: any) {
  return {
    id: entry._id.toString(),
    subject: entry.subject,
    subjectCode: entry.subjectCode,
    room: entry.room,
    lecturer: entry.lecturer,
    days: entry.days,
    startTime: entry.startTime,
    endTime: entry.endTime,
    color: entry.color,
    repeat: entry.repeat,
  };
}

function serializeHoliday(holiday: any, custom: boolean) {
  return {
    id: holiday._id.toString(),
    name: holiday.name,
    date: holiday.date,
    type: holiday.type,
    description: holiday.description,
    custom,
  };
}

function resolveLoadedSchedule(
  date: string,
  baseEntries: any[],
  overrides: any[],
  specials: any[],
  institutionalHoliday: any | null,
  customHoliday: any | null,
) {
  const dayOfWeek = dayOfWeekForDate(date);
  const holiday = customHoliday ?? institutionalHoliday;
  if (holiday) {
    return {
      date,
      dayOfWeek,
      holiday: serializeHoliday(holiday, Boolean(customHoliday)),
      classes: [] as any[],
    };
  }

  const relevantOverrides = overrides.filter((override) =>
    (override.scope === "one_date" && override.date === date)
    || (override.scope === "future" && override.effectiveFrom <= date),
  );
  const overridesByClass = new Map<string, any[]>();
  for (const override of relevantOverrides) {
    const key = override.timetableClass.toString();
    overridesByClass.set(key, [...(overridesByClass.get(key) ?? []), override]);
  }

  const classes: any[] = [];
  for (const entry of baseEntries) {
    const base = serializeBaseClass(entry);
    const classOverrides = overridesByClass.get(entry._id.toString()) ?? [];
    const futureOverride = [...classOverrides]
      .filter((item) => item.scope === "future")
      .sort((a, b) => String(b.effectiveFrom).localeCompare(String(a.effectiveFrom)))[0];
    const dateOverride = [...classOverrides]
      .filter((item) => item.scope === "one_date" && item.date === date)
      .sort((a, b) => Number(b.createdAt) - Number(a.createdAt))[0];
    const appliedOverride = dateOverride ?? futureOverride;

    const resolvedDays = futureOverride?.newDay !== undefined
      ? [futureOverride.newDay]
      : base.days;
    const occursToday = dateOverride
      ? base.days.includes(dayOfWeek) || resolvedDays.includes(dayOfWeek)
      : resolvedDays.includes(dayOfWeek);
    if (!occursToday || appliedOverride?.cancelled) continue;

    classes.push({
      ...base,
      source: "base",
      baseClassId: base.id,
      date,
      day: dayOfWeek,
      startTime: appliedOverride?.newStartTime ?? base.startTime,
      endTime: appliedOverride?.newEndTime ?? base.endTime,
      changed: Boolean(appliedOverride),
      overrideId: appliedOverride?._id?.toString(),
      changedFrom: appliedOverride?.date ?? appliedOverride?.effectiveFrom,
      original: appliedOverride
        ? { day: base.days[0], startTime: base.startTime, endTime: base.endTime }
        : undefined,
    });
  }

  for (const item of specials.filter((special) => special.date === date)) {
    classes.push({
      id: item._id.toString(),
      source: "special",
      date,
      day: dayOfWeek,
      subject: item.subject,
      subjectCode: item.subjectCode,
      room: item.room,
      lecturer: item.lecturer,
      startTime: item.startTime,
      endTime: item.endTime,
      color: item.color,
      changed: false,
      special: true,
    });
  }

  classes.sort((a, b) => a.startTime.localeCompare(b.startTime));
  return { date, dayOfWeek, holiday: null, classes };
}

export type ActualScheduleResult = Awaited<ReturnType<typeof getActualSchedule>>;

/**
 * Resolves the authoritative schedule for a local YYYY-MM-DD date.
 * All timetable, calendar and Home consumers must use this result rather than
 * deriving weekly classes independently.
 */
export async function getActualSchedule(
  userId: string | Types.ObjectId,
  date: string,
) {
  const [institutionalHoliday, customHoliday, baseEntries, overrides, specials] = await Promise.all([
    Holiday.findOne({ date }).sort({ createdAt: 1 }),
    CustomHoliday.findOne({ user: userId, date }),
    getActiveTimetableEntries(userId),
    ScheduleOverride.find({
      user: userId,
      $or: [
        { scope: "one_date", date },
        { scope: "future", effectiveFrom: { $lte: date } },
      ],
    }).sort({ effectiveFrom: 1, createdAt: 1 }),
    SpecialClass.find({ user: userId, date }).sort({ startTime: 1 }),
  ]);
  return resolveLoadedSchedule(date, baseEntries, overrides, specials, institutionalHoliday, customHoliday);
}

export async function getActualScheduleRange(
  userId: string | Types.ObjectId,
  startDate: string,
  endDate: string,
) {
  const [institutionalHolidays, customHolidays, baseEntries, overrides, specials] = await Promise.all([
    Holiday.find({ date: { $gte: startDate, $lte: endDate } }),
    CustomHoliday.find({ user: userId, date: { $gte: startDate, $lte: endDate } }),
    getActiveTimetableEntries(userId),
    ScheduleOverride.find({
      user: userId,
      $or: [
        { scope: "one_date", date: { $gte: startDate, $lte: endDate } },
        { scope: "future", effectiveFrom: { $lte: endDate } },
      ],
    }).sort({ effectiveFrom: 1, createdAt: 1 }),
    SpecialClass.find({ user: userId, date: { $gte: startDate, $lte: endDate } }).sort({ date: 1, startTime: 1 }),
  ]);

  const schedules = [];
  const cursor = new Date(`${startDate}T12:00:00.000Z`);
  const end = new Date(`${endDate}T12:00:00.000Z`);
  while (cursor <= end) {
    const date = cursor.toISOString().slice(0, 10);
    schedules.push(resolveLoadedSchedule(
      date,
      baseEntries,
      overrides,
      specials,
      institutionalHolidays.find((holiday) => holiday.date === date) ?? null,
      customHolidays.find((holiday) => holiday.date === date) ?? null,
    ));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return schedules;
}
