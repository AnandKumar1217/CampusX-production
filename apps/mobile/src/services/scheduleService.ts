import type { QueryClient } from "@tanstack/react-query";

import { api } from "@/services/api";
import type {
  AcademicHoliday,
  ActualSchedule,
  ScheduleClass,
  TimeSlot,
  TimetableEntry,
} from "@/types/domain";

export type ChangeScope = "one_date" | "future" | "all";
export type ConflictAction = "reject" | "swap" | "move_existing" | "replace";

export const scheduleQueryKeys = {
  all: ["actualSchedule"] as const,
  date: (userId: string | undefined, date: string) => ["actualSchedule", userId, date] as const,
  range: (userId: string | undefined, startDate: string, endDate: string) => ["actualScheduleRange", userId, startDate, endDate] as const,
  holidays: (userId: string | undefined, startDate: string, endDate: string) => ["holidays", userId, startDate, endDate] as const,
};

export function toLocalDateKey(value = new Date()) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export async function invalidateScheduleData(queryClient: QueryClient) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["timetable"] }),
    queryClient.invalidateQueries({ queryKey: scheduleQueryKeys.all }),
    queryClient.invalidateQueries({ queryKey: ["actualScheduleRange"] }),
    queryClient.invalidateQueries({ queryKey: ["holidays"] }),
  ]);
}

export const scheduleService = {
  getActualSchedule: async (date: string): Promise<ActualSchedule> => {
    const response = await api.get("/timetable/schedule", { params: { date } });
    return response.data.data;
  },

  getScheduleRange: async (startDate: string, endDate: string): Promise<ActualSchedule[]> => {
    const response = await api.get("/timetable/schedule-range", { params: { startDate, endDate } });
    return response.data.data;
  },

  reschedule: async (classId: string, payload: {
    scope: ChangeScope;
    date: string;
    newDay?: number;
    newStartTime: string;
    newEndTime: string;
    conflictAction?: ConflictAction;
    conflictClassId?: string;
    moveExistingTo?: { day?: number; startTime: string; endTime: string };
    reason?: string;
  }) => {
    const response = await api.post(`/timetable/${classId}/reschedule`, payload);
    return response.data.data;
  },

  cancelOccurrence: async (classId: string, payload: {
    date: string;
    scope?: "one_date" | "future";
    reason?: string;
  }) => {
    const response = await api.post(`/timetable/${classId}/cancel`, payload);
    return response.data.data;
  },

  restoreOriginal: async (classId: string, payload: { date?: string; overrideId?: string }) => {
    const response = await api.post(`/timetable/${classId}/restore`, payload);
    return response.data.data;
  },

  addSpecialClass: async (payload: Omit<ScheduleClass, "id" | "baseClassId" | "source" | "day" | "changed" | "special">) => {
    const response = await api.post("/timetable/special", payload);
    return response.data.data;
  },

  updateSpecialClass: async (id: string, payload: Partial<ScheduleClass>) => {
    const response = await api.patch(`/timetable/special/${id}`, payload);
    return response.data.data;
  },

  deleteSpecialClass: async (id: string) => {
    await api.delete(`/timetable/special/${id}`);
  },

  importTimetable: async (payload: {
    mode: "merge" | "replace";
    entries: (Partial<TimetableEntry> & Pick<TimetableEntry, "subject" | "startTime" | "endTime"> & { day?: number })[];
    gridTimeSlots: TimeSlot[];
  }): Promise<{ added: number; skippedDuplicates: number; mode: "merge" | "replace" }> => {
    const response = await api.post("/timetable/import", payload);
    return response.data.data;
  },

  getHolidays: async (startDate: string, endDate: string): Promise<AcademicHoliday[]> => {
    const response = await api.get("/holidays", { params: { startDate, endDate } });
    return response.data.data;
  },

  addHoliday: async (payload: { date: string; name: string; description?: string }) => {
    const response = await api.post("/holidays", { ...payload, type: "no_class" });
    return response.data.data as AcademicHoliday;
  },

  updateHoliday: async (id: string, payload: Partial<{ date: string; name: string; description: string }>) => {
    const response = await api.patch(`/holidays/${id}`, payload);
    return response.data.data as AcademicHoliday;
  },

  deleteHoliday: async (id: string) => {
    await api.delete(`/holidays/${id}`);
  },
};
