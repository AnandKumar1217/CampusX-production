import { Socket } from "socket.io-client";
import { queryClient } from "@/query/queryClient";

export interface SocketEventDependencies {
  removeFriendLocation: (userId: string) => void;
  updateFriendIdentity: (userId: string, name?: string, avatarUrl?: string, username?: string) => void;
  fetchInitialFriendLocations: () => void;
}

export function setupSocketInvalidations(socket: Socket, deps: SocketEventDependencies) {
  // --- PRESENCE & IDENTITY ---

  socket.on("presence:changed", (data: { userId: string, status: "online" | "offline", lastSeenAt?: string }) => {
    queryClient.invalidateQueries({ queryKey: ["friends"] });
    queryClient.invalidateQueries({ queryKey: ["user", data.userId] });
  });

  socket.on("user:deleted", (data: { userId: string }) => {
    // Aggressively remove traces of this user from local UI state
    deps.removeFriendLocation(data.userId);
    queryClient.removeQueries({ queryKey: ["user", data.userId] });
    queryClient.invalidateQueries({ queryKey: ["friends"] });
    queryClient.invalidateQueries({ queryKey: ["friendRequests"] });
    queryClient.invalidateQueries({ queryKey: ["citySearch"] });
    queryClient.invalidateQueries({ queryKey: ["feed"] });
    queryClient.invalidateQueries({ queryKey: ["post"] });
    queryClient.invalidateQueries({ queryKey: ["chats"] });
    queryClient.invalidateQueries({ queryKey: ["groups"] });
    queryClient.invalidateQueries({ queryKey: ["events"] });
    queryClient.invalidateQueries({ queryKey: ["marketplace"] });
    queryClient.invalidateQueries({ queryKey: ["profile-summary", data.userId] });
  });


  socket.on("profile:updated", (data: { userId: string, name?: string, avatarUrl?: string, username?: string }) => {
    deps.updateFriendIdentity(data.userId, data.name, data.avatarUrl, data.username);
    queryClient.invalidateQueries({ queryKey: ["user", data.userId] });
    queryClient.invalidateQueries({ queryKey: ["friends"] });
    queryClient.invalidateQueries({ queryKey: ["friendRequests"] });
    queryClient.invalidateQueries({ queryKey: ["citySearch"] });
    queryClient.invalidateQueries({ queryKey: ["feed"] });
    queryClient.invalidateQueries({ queryKey: ["chats"] });
    queryClient.invalidateQueries({ queryKey: ["groups"] });
    queryClient.invalidateQueries({ queryKey: ["profile-summary", data.userId] });
    queryClient.invalidateQueries({ queryKey: ["events"] });
    queryClient.invalidateQueries({ queryKey: ["listings"] });
    queryClient.invalidateQueries({ queryKey: ["trips"] });
  });

  // --- FRIENDSHIPS ---
  const invalidateFriends = () => {
    queryClient.invalidateQueries({ queryKey: ["friends"] });
    queryClient.invalidateQueries({ queryKey: ["friendRequests"] });
    queryClient.invalidateQueries({ queryKey: ["profile-summary"] });
  };

  socket.on("friend:request", invalidateFriends);

  socket.on("friend:accepted", invalidateFriends);

  socket.on("friend:removed", invalidateFriends);

  socket.on("friend:request_cancelled", invalidateFriends);

  socket.on("friend:request_rejected", invalidateFriends);

  socket.on("notification:read", () => {
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
  });

  // --- LOCATION SHARING ---

  socket.on("location:sharing_changed", (data: { userId: string, enabled: boolean }) => {
    if (!data.enabled) {
      deps.removeFriendLocation(data.userId);
    } else {
      // Safety fallback if friend_updated is delayed
      deps.fetchInitialFriendLocations();
    }
  });

  // --- POSTS / FEED ---
  const invalidateFeed = () => {
    queryClient.invalidateQueries({ queryKey: ["feed"] });
    queryClient.invalidateQueries({ queryKey: ["post"] });
    queryClient.invalidateQueries({ queryKey: ["myPosts"] });
    queryClient.invalidateQueries({ queryKey: ["savedPosts"] });
    queryClient.invalidateQueries({ queryKey: ["profile-summary"] });
  };

  socket.on("post:created", invalidateFeed);

  socket.on("post:updated", invalidateFeed);

  socket.on("post:deleted", invalidateFeed);

  socket.on("post:like", invalidateFeed);

  socket.on("post:comment", invalidateFeed);
  socket.on("post:saved", () => {
    queryClient.invalidateQueries({ queryKey: ["post"] });
    queryClient.invalidateQueries({ queryKey: ["savedPosts"] });
    queryClient.invalidateQueries({ queryKey: ["feed"] });
  });

  // --- EVENTS ---
  const invalidateEvents = () => {
    queryClient.invalidateQueries({ queryKey: ["events"] });
    queryClient.invalidateQueries({ queryKey: ["savedEvents"] });
  };

  socket.on("event:created", invalidateEvents);

  socket.on("event:updated", invalidateEvents);

  socket.on("event:deleted", invalidateEvents);
  socket.on("event:saved", () => queryClient.invalidateQueries({ queryKey: ["savedEvents"] }));

  // --- MARKETPLACE ---
  const invalidateMarketplace = () => {
    queryClient.invalidateQueries({ queryKey: ["listings"] });
    queryClient.invalidateQueries({ queryKey: ["listing"] });
    queryClient.invalidateQueries({ queryKey: ["myListings"] });
    queryClient.invalidateQueries({ queryKey: ["savedListings"] });
  };

  socket.on("listing:created", invalidateMarketplace);

  socket.on("listing:updated", invalidateMarketplace);

  socket.on("listing:sold", invalidateMarketplace);

  socket.on("listing:deleted", invalidateMarketplace);
  socket.on("listing:saved", invalidateMarketplace);

  // --- GROUPS ---
  const invalidateGroups = () => {
    queryClient.invalidateQueries({ queryKey: ["groups"] });
    queryClient.invalidateQueries({ queryKey: ["myGroups"] });
    queryClient.invalidateQueries({ queryKey: ["group"] });
    queryClient.invalidateQueries({ queryKey: ["groupMembers"] });
    queryClient.invalidateQueries({ queryKey: ["groupRequests"] });
    queryClient.invalidateQueries({ queryKey: ["profile-summary"] });
  };

  socket.on("group:created", invalidateGroups);

  socket.on("group:updated", invalidateGroups);

  socket.on("group:deleted", () => {
    invalidateGroups();
    queryClient.invalidateQueries({ queryKey: ["feed"] });
    queryClient.invalidateQueries({ queryKey: ["savedPosts"] });
    queryClient.invalidateQueries({ queryKey: ["post"] });
  });

  socket.on("group:membership:changed", invalidateGroups);

  const invalidateTrips = () => {
    queryClient.invalidateQueries({ queryKey: ["trips"] });
    queryClient.invalidateQueries({ queryKey: ["trip"] });
  };
  socket.on("trip:invite", invalidateTrips);
  socket.on("trip:updated", invalidateTrips);
  socket.on("trip:rsvp", invalidateTrips);
  socket.on("trip:memberRemoved", invalidateTrips);
  socket.on("trip:cancelled", invalidateTrips);
  socket.on("trip:update", invalidateTrips);

  // --- TIMETABLE / ACADEMIC CALENDAR ---
  socket.on("schedule:updated", () => {
    queryClient.invalidateQueries({ queryKey: ["timetable"] });
    queryClient.invalidateQueries({ queryKey: ["actualSchedule"] });
    queryClient.invalidateQueries({ queryKey: ["actualScheduleRange"] });
    queryClient.invalidateQueries({ queryKey: ["holidays"] });
  });
}
