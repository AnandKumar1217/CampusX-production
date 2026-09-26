import { api } from "./api";

export interface Group {
  _id: string;
  id: string;
  name: string;
  description?: string;
  avatarUrl?: string | null;
  avatarPublicId?: string | null;
  category?: string;
  privacy: "public" | "private";
  owner: any;
  memberCount: number;
}

export interface GroupMembership {
  _id: string;
  group: string | Group;
  user: any;
  role: "owner" | "admin" | "moderator" | "member";
  status: "active" | "invited" | "requested";
}

export const groupService = {
  listGroups: async (query: string = "", page: number = 1) => {
    const res = await api.get("/groups", { params: { q: query, page } });
    return res.data;
  },

  getMyGroups: async (query: string = "", filter?: "owned" | "joined") => {
    const params: any = {};
    if (query) params.q = query;
    if (filter) params.filter = filter;
    const res = await api.get("/groups/mine", { params });
    return res.data;
  },

  getGroup: async (groupId: string) => {
    const res = await api.get(`/groups/${groupId}`);
    return res.data;
  },

  createGroup: async (data: Partial<Group>) => {
    const res = await api.post("/groups", data);
    return res.data;
  },

  updateGroup: async (groupId: string, data: Partial<Group>) => {
    const res = await api.patch(`/groups/${groupId}`, data);
    return res.data;
  },

  deleteGroup: async (groupId: string) => {
    const res = await api.delete(`/groups/${groupId}`);
    return res.data;
  },

  joinGroup: async (groupId: string) => {
    const res = await api.post(`/groups/${groupId}/join`);
    return res.data;
  },

  leaveGroup: async (groupId: string) => {
    const res = await api.post(`/groups/${groupId}/leave`);
    return res.data;
  },

  getMembers: async (groupId: string) => {
    const res = await api.get(`/groups/${groupId}/members`);
    return res.data;
  },

  getJoinRequests: async (groupId: string) => {
    const res = await api.get(`/groups/${groupId}/requests`);
    return res.data;
  },

  approveJoinRequest: async (groupId: string, userId: string) => {
    const res = await api.patch(`/groups/${groupId}/requests/${userId}`, { action: "approve" });
    return res.data;
  },

  rejectJoinRequest: async (groupId: string, userId: string) => {
    const res = await api.patch(`/groups/${groupId}/requests/${userId}`, { action: "reject" });
    return res.data;
  },

  inviteUsers: async (groupId: string, userIds: string[]) => {
    const res = await api.post(`/groups/${groupId}/invites`, { userIds });
    return res.data;
  },

  acceptInvite: async (groupId: string, userId: string) => {
    const res = await api.post(`/groups/${groupId}/invites/${userId}/accept`);
    return res.data;
  },

  declineInvite: async (groupId: string, userId: string) => {
    const res = await api.post(`/groups/${groupId}/invites/${userId}/decline`);
    return res.data;
  },

  removeMember: async (groupId: string, userId: string) => {
    const res = await api.delete(`/groups/${groupId}/members/${userId}`);
    return res.data;
  },

  updateMemberRole: async (groupId: string, userId: string, role: "admin" | "moderator" | "member") => {
    const res = await api.patch(`/groups/${groupId}/members/${userId}/role`, { role });
    return res.data;
  },

  getPolls: async (groupId: string) => {
    const res = await api.get(`/groups/${groupId}/polls`);
    return res.data;
  },

  createPoll: async (groupId: string, data: any) => {
    const res = await api.post(`/groups/${groupId}/polls`, data);
    return res.data;
  },

  votePoll: async (groupId: string, pollId: string, option: number) => {
    const res = await api.post(`/groups/${groupId}/polls/${pollId}/vote`, { option });
    return res.data;
  },

  getFiles: async (groupId: string) => {
    const res = await api.get(`/groups/${groupId}/files`);
    return res.data;
  },

  getSessions: async (groupId: string) => {
    const res = await api.get(`/groups/${groupId}/sessions`);
    return res.data;
  },

  createSession: async (groupId: string, data: any) => {
    const res = await api.post(`/groups/${groupId}/sessions`, data);
    return res.data;
  },

  getPosts: async (groupId: string) => {
    const res = await api.get(`/groups/${groupId}/posts`);
    return res.data;
  },

  getMessages: async (groupId: string, page: number = 1) => {
    const res = await api.get(`/groups/${groupId}/messages`, { params: { page, limit: 50 } });
    return res.data;
  },

  sendMessage: async (groupId: string, text: string, attachments: any[] = [], nonce?: string) => {
    const res = await api.post(`/groups/${groupId}/messages`, { text, attachments, nonce });
    return res.data;
  },
};
