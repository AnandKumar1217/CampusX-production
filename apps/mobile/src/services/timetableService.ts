import { api } from "@/services/api";
import type { TimetableEntry, TimeSlot } from "@/types/domain";

export const timetableService = {
  getTimetable: async (): Promise<TimetableEntry[]> => {
    const response = await api.get("/timetable");
    return response.data.data;
  },

  createEntry: async (
    payload: Omit<TimetableEntry, "id" | "createdAt" | "updatedAt"> & {
      conflictAction?: "reject" | "replace";
      conflictClassId?: string;
    }
  ): Promise<TimetableEntry> => {
    const response = await api.post("/timetable", payload);
    return response.data.data;
  },

  updateEntry: async (
    id: string,
    payload: Partial<Omit<TimetableEntry, "id" | "createdAt" | "updatedAt">>
  ): Promise<TimetableEntry> => {
    const response = await api.patch(`/timetable/${id}`, payload);
    return response.data.data;
  },

  deleteEntry: async (id: string): Promise<void> => {
    await api.delete(`/timetable/${id}`);
  },

  clearTimetable: async (): Promise<void> => {
    await api.delete("/timetable");
  },

  getSettings: async (): Promise<{ gridTimeSlots: TimeSlot[] }> => {
    const response = await api.get("/timetable/settings");
    return response.data.data;
  },

  updateSettings: async (payload: { gridTimeSlots: TimeSlot[] }): Promise<{ gridTimeSlots: TimeSlot[] }> => {
    const response = await api.put("/timetable/settings", payload);
    return response.data.data;
  },

  bulkReplaceTimetable: async (payload: { gridTimeSlots: TimeSlot[], entries: any[] }): Promise<TimetableEntry[]> => {
    const response = await api.post("/timetable/bulk-replace", payload);
    return response.data.data;
  },

  analyzeTimetable: async (
    fileUri: string,
    mimeType: string,
    sourceType: "image" | "camera",
    localOcrJson?: string
  ): Promise<any> => {
    const formData = new FormData();
    const filename = fileUri.split("/").pop() || "upload";
    
    formData.append("file", {
      uri: fileUri,
      name: filename,
      type: mimeType
    } as any);
    
    formData.append("sourceType", sourceType);
    if (localOcrJson) formData.append("localOcrJson", localOcrJson);

    const response = await api.post("/timetable/analyze", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 30000,
    });
    
    return response.data.data;
  }
};
