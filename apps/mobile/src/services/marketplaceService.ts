import { api } from "./api";
import type { Listing, User } from "@/types/domain";

const mapUser = (seller: any): User => {
  if (!seller) return {} as User;
  if (typeof seller === 'string') return { id: seller } as User;
  return {
    id: seller._id || seller.id,
    name: seller.name,
    username: seller.username,
    avatar: seller.avatarUrl,
    verified: seller.verified,
  };
};

const mapListing = (item: any): Listing => ({
  ...item,
  id: item._id || item.id,
  seller: mapUser(item.seller),
  images: (item.images && item.images.length > 0) ? item.images : (item.coverImage ? [item.coverImage] : (item.image ? [item.image] : [])),
  views: item.views || 0,
});

export const marketplaceService = {
  listListings: async (params?: { page?: number; limit?: number; q?: string; category?: string }) => {
    const res = await api.get<{ data: { items: any[]; total: number; page: number; limit: number } }>("/marketplace", { params });
    return {
      ...res.data.data,
      items: res.data.data.items.map(mapListing)
    };
  },

  getMyListings: async () => {
    const res = await api.get<{ data: any[] }>("/marketplace/mine");
    return res.data.data.map(mapListing);
  },

  getListing: async (id: string) => {
    const res = await api.get<{ data: any }>(`/marketplace/${id}`);
    return mapListing(res.data.data);
  },

  createListing: async (payload: any) => {
    const res = await api.post<{ data: any }>("/marketplace", payload);
    return mapListing(res.data.data);
  },

  updateListing: async (id: string, payload: any) => {
    const res = await api.patch<{ data: any }>(`/marketplace/${id}`, payload);
    return mapListing(res.data.data);
  },

  deleteListing: async (id: string) => {
    const res = await api.delete(`/marketplace/${id}`);
    return res.data;
  },

  saveListing: async (id: string) => {
    const res = await api.post(`/marketplace/${id}/save`);
    return res.data;
  },

  unsaveListing: async (id: string) => {
    const res = await api.delete(`/marketplace/${id}/save`);
    return res.data;
  },

  getSavedListings: async () => {
    const res = await api.get<{ data: any[] }>("/marketplace/saved");
    return res.data.data.map(mapListing);
  }
};

export const marketplaceKeys = {
  all: ["marketplace"] as const,
  feed: (filters?: any) => ["marketplace", "feed", filters] as const,
  detail: (listingId: string) => ["marketplace", "detail", listingId] as const,
  myListings: (status?: string) => ["marketplace", "myListings", status] as const,
  saved: () => ["marketplace", "saved"] as const,
  search: (query: string, filters?: any) => ["marketplace", "search", query, filters] as const,
};

