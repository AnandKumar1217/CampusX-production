import { api } from "./api";
import { EventItem, User } from "../types/domain";

export function mapEvent(backendEvent: any): EventItem & { attendees: any[], imagePublicId?: string } {
  const dateObj = new Date(backendEvent.startsAt);
  const day = String(dateObj.getDate()).padStart(2, "0");
  const month = String(dateObj.getMonth() + 1).padStart(2, "0");
  const year = dateObj.getFullYear();
  const dateString = `${day}/${month}/${year}`;

  let hours = dateObj.getHours();
  const minutes = String(dateObj.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12;
  const timeString = `${String(hours).padStart(2, "0")}:${minutes} ${ampm}`;

  return {
    id: backendEvent._id,
    title: backendEvent.title,
    description: backendEvent.description,
    date: dateString,
    time: timeString,
    location: backendEvent.location?.name || "",
    coordinates: backendEvent.location?.coordinates
      ? {
          lat: backendEvent.location.coordinates[1],
          lng: backendEvent.location.coordinates[0],
        }
      : undefined,
    category: backendEvent.category || "Other",
    image: backendEvent.imageUrl || undefined,
    interested: backendEvent.attendees?.filter((attendee: any) => attendee.status === "going").length || 0,
    organizer: backendEvent.creator
      ? {
          ...backendEvent.creator,
          id: backendEvent.creator._id || backendEvent.creator.id,
        }
      : undefined,
    public: !backendEvent.draft,
    attendees: backendEvent.attendees || [],
    imagePublicId: backendEvent.imagePublicId,
    capacity: backendEvent.capacity,
    registrationDeadline: backendEvent.registrationDeadline,
    status: backendEvent.status || (backendEvent.draft ? "draft" : "active"),
    startsAt: backendEvent.startsAt,
    endsAt: backendEvent.endsAt,
  };
}

export const eventService = {
  listEvents: async (
    params?: { category?: string; page?: number; limit?: number },
  ): Promise<{
    items: ReturnType<typeof mapEvent>[];
    total: number;
    page: number;
    limit: number;
  }> => {
    const res = await api.get("/events", { params });
    return {
      items: res.data.data.items.map(mapEvent),
      total: res.data.data.total,
      page: res.data.data.page,
      limit: res.data.data.limit,
    };
  },

  getEvent: async (id: string) => {
    const res = await api.get(`/events/${id}`);
    return mapEvent(res.data.data);
  },

  getSavedEvents: async () => {
    const res = await api.get<{ data: any[] }>("/events/saved");
    return res.data.data.map(mapEvent);
  },

  setSaved: async (id: string, saved: boolean) => {
    const res = await api.post<{ data: { saved: boolean } }>(`/events/${id}/save`, { saved });
    return res.data.data.saved;
  },

  createEvent: async (payload: any) => {
    const res = await api.post("/events", payload);
    return mapEvent(res.data.data);
  },

  updateEvent: async (id: string, payload: any) => {
    const res = await api.patch(`/events/${id}`, payload);
    return mapEvent(res.data.data);
  },

  deleteEvent: async (id: string) => {
    const res = await api.delete(`/events/${id}`);
    return res.data;
  },

  setAttendance: async (id: string, status: "none" | "maybe" | "going") => {
    if (status === "going") {
      const res = await api.post(`/events/${id}/register`);
      return res.data;
    } else {
      const res = await api.delete(`/events/${id}/register`);
      return res.data;
    }
  },

  getRegistrations: async (id: string) => {
    const res = await api.get<{ data: any[] }>(`/events/${id}/registrations`);
    return res.data.data;
  }
};
