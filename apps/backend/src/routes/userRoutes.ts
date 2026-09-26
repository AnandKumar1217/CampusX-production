import { Router } from "express";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { User } from "../models/User.js";
import { Friendship, FriendRequest } from "../models/Social.js";
import { Event } from "../models/Commerce.js";
import { GroupMembership } from "../models/Group.js";
import { AppError, asyncHandler, sendSuccess } from "../utils/http.js";
import { pagination } from "../utils/pagination.js";
import bcrypt from "bcryptjs";
import { deleteUserAccount } from "../services/deleteAccountService.js";

export const userRouter = Router();

userRouter.get(
  "/me",
  asyncHandler(async (request, response) => {
    const user = await User.findById(request.user!._id).select("-passwordHash");
    return sendSuccess(response, user);
  }),
);

userRouter.patch(
  "/me",
  asyncHandler(async (request, response) => {
    const input = z
      .object({
        name: z.string().min(2).max(80).optional(),
        username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_.]+$/).optional(),
        bio: z.string().max(300).optional(),
        avatarUrl: z.url().optional(),
        college: z.string().max(120).optional(),
        department: z.string().max(100).optional(),
        academicYear: z.string().max(30).optional(),
        interests: z.array(z.string().max(50)).max(20).optional(),
      })
      .parse(request.body);
      
    if (input.username) {
      const existing = await User.findOne({ username: input.username });
      if (existing && existing._id.toString() !== request.user!._id.toString()) {
        const suggestions: string[] = [];
        let attempts = 0;
        while (suggestions.length < 3 && attempts < 20) {
          const randomNum = Math.floor(Math.random() * 999) + 1;
          const suggestion = `${input.username}${randomNum}`;
          if (!(await User.exists({ username: suggestion })) && !suggestions.includes(suggestion)) {
            suggestions.push(suggestion);
          }
          attempts++;
        }
        throw new AppError(409, "Username is already taken", "USERNAME_TAKEN", { suggestions });
      }
    }

    const user = await User.findByIdAndUpdate(
      request.user!._id,
      { $set: input },
      { new: true, runValidators: true },
    ).select("-passwordHash");
    
    // Emit profile:updated
    const relations = await Friendship.find({ users: request.user!._id });
    const acceptedFriendIds = relations.flatMap((r) => r.users).filter((id) => id.toString() !== request.user!._id.toString());
    const io = request.app.get("io");
    const payload = { 
      userId: request.user!._id.toString(),
      name: user?.name,
      username: user?.username,
      avatarUrl: (user as any)?.avatarUrl || ""
    };
    io?.to(`user:${request.user!._id.toString()}`).emit("profile:updated", payload);
    acceptedFriendIds.forEach((friendId) => {
      io?.to(`user:${friendId.toString()}`).emit("profile:updated", payload);
    });
    // Global emit for discovery and search screens
    io?.emit("profile:updated", payload);

    return sendSuccess(response, user, "Profile updated");
  }),
);

userRouter.delete(
  "/me",
  asyncHandler(async (request, response) => {
    const input = z.object({ password: z.string().min(1) }).parse(request.body);
    const user = await User.findById(request.user!._id).select("+passwordHash");
    if (!user) throw new AppError(404, "User not found");

    const valid = await bcrypt.compare(input.password, user.passwordHash);
    if (!valid) throw new AppError(401, "Invalid password");

    await deleteUserAccount(request.user!._id.toString());

    // Broadcast user:deleted
    const io = request.app.get("io");
    if (io) {
      io.emit("user:deleted", { userId: request.user!._id.toString() });
    }

    return sendSuccess(response, null, "Account deleted successfully");
  }),
);

userRouter.get(
  "/search",
  asyncHandler(async (request, response) => {
    const query = String(request.query.q ?? "").trim().slice(0, 100)
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const { limit, skip, page } = pagination(request.query, 1000);
    const filter = query
      ? {
          $and: [
            { _id: { $ne: request.user!._id } },
            {
              $or: [
                { name: { $regex: query, $options: "i" } },
                { username: { $regex: query, $options: "i" } },
                { college: { $regex: query, $options: "i" } },
                { department: { $regex: query, $options: "i" } },
              ],
            },
          ],
        }
      : { _id: { $ne: request.user!._id } };
    const [items, total] = await Promise.all([
      User.find(filter)
        .select(
          "name username avatarUrl college department academicYear verified",
        )
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);
    
    // Attach friendship status for all returned items
    const itemIds = items.map((i) => i._id);
    
    // We need FriendRequest and Friendship. Let's make sure they're available or import them dynamically.
    // They are exported from Social.js or we can use mongoose.model.
    const mongoose = await import("mongoose");
    const FriendRequest = mongoose.model("FriendRequest");
    const Friendship = mongoose.model("Friendship");

    const [friendships, outgoing, incoming] = await Promise.all([
      Friendship.find({ users: request.user!._id }).select("users"),
      FriendRequest.find({
        requester: request.user!._id,
        recipient: { $in: itemIds },
        status: "pending",
      }).select("recipient"),
      FriendRequest.find({
        recipient: request.user!._id,
        requester: { $in: itemIds },
        status: "pending",
      }).select("requester"),
    ]);

    const friendIds = new Set(
      friendships
        .flatMap((f: any) => f.users.map((id: any) => id.toString()))
        .filter((id) => id !== request.user!._id.toString()),
    );
    const outgoingIds = new Set(outgoing.map((r: any) => r.recipient.toString()));
    const incomingIds = new Set(incoming.map((r: any) => r.requester.toString()));

    const itemsWithStatus = items.map((user) => {
      const idStr = user._id.toString();
      let friendshipStatus = "NONE";
      if (friendIds.has(idStr)) {
        friendshipStatus = "FRIENDS";
      } else if (outgoingIds.has(idStr)) {
        friendshipStatus = "OUTGOING";
      } else if (incomingIds.has(idStr)) {
        friendshipStatus = "INCOMING";
      }
      return { ...user, friendshipStatus };
    });

    return sendSuccess(response, { items: itemsWithStatus, page, limit, total });
  }),
);

userRouter.get(
  "/qr/:qrToken",
  asyncHandler(async (request, response) => {
    const { qrToken } = request.params;
    if (!qrToken) throw new AppError(400, "Invalid QR token", "INVALID_TOKEN");
    
    const user = await User.findOne({ qrToken }).select(
      "name username avatarUrl bio college department academicYear interests verified",
    );
    
    if (!user) throw new AppError(404, "CampusX profile not found", "USER_NOT_FOUND");
    
    // Check friendship status using the existing logic 
    // We need to see if Friendship models are imported
    // The previous code already imports `Friendship` from `../models/Social.js`
    // We also need to import `FriendRequest` from `../models/Social.js`
    
    // Check for self
    if (user._id.toString() === request.user!._id.toString()) {
      return sendSuccess(response, { user, friendshipStatus: "SELF" });
    }
    
    const isFriend = await Friendship.exists({
      users: { $all: [request.user!._id, user._id] },
    });
    
    let friendshipStatus = "NONE";
    if (isFriend) {
      friendshipStatus = "FRIENDS";
    } else {
      // Import FriendRequest dynamically or assume it's exported from Social.js
      // Wait, we need to import FriendRequest at the top. Let's do it inline with mongoose.model
      const mongoose = await import("mongoose");
      const FriendRequest = mongoose.model("FriendRequest");
      
      const requestOut = await FriendRequest.findOne({
        requester: request.user!._id,
        recipient: user._id,
        status: "pending",
      });
      if (requestOut) {
        friendshipStatus = "OUTGOING";
      } else {
        const requestIn = await FriendRequest.findOne({
          requester: user._id,
          recipient: request.user!._id,
          status: "pending",
        });
        if (requestIn) {
          friendshipStatus = "INCOMING";
        }
      }
    }
    
    return sendSuccess(response, { user, friendshipStatus });
  })
);

userRouter.get(
  "/:id",
  asyncHandler(async (request, response) => {
    if (!isValidObjectId(request.params.id))
      throw new AppError(400, "Invalid user id", "INVALID_ID");
    const targetId = String(request.params.id);
    const canSeePresence = targetId === request.user!._id.toString() || Boolean(await Friendship.exists({
      users: { $all: [request.user!._id, targetId] },
    }));
    const user = await User.findById(request.params.id).select(
      `name username avatarUrl bio college department academicYear interests verified${canSeePresence ? " online lastSeenAt" : ""}`,
    );
    if (!user) throw new AppError(404, "User not found", "USER_NOT_FOUND");
    return sendSuccess(response, user);
  }),
);
userRouter.get(
  "/:id/profile-summary",
  asyncHandler(async (request, response) => {
    if (!isValidObjectId(request.params.id))
      throw new AppError(400, "Invalid user id", "INVALID_ID");
      
    const user = await User.findById(request.params.id).select(
      "name username avatarUrl bio college department academicYear interests verified online lastSeenAt",
    ).lean();
    
    if (!user) throw new AppError(404, "User not found", "USER_NOT_FOUND");
    
    const isSelf = user._id.toString() === request.user!._id.toString();

    // Stats
    const eventsQuery: any = { creator: user._id, draft: { $ne: true } };
    if (!isSelf) {
      eventsQuery.$or = [
        { endsAt: { $gte: new Date() } },
        { endsAt: null, startsAt: { $gte: new Date() } },
        { endsAt: { $exists: false }, startsAt: { $gte: new Date() } }
      ];
    }

    const [eventsCount, friendsCount, groupsCount] = await Promise.all([
      Event.countDocuments(eventsQuery),
      Friendship.countDocuments({ users: user._id }),
      GroupMembership.countDocuments({ user: user._id, status: "active" })
    ]);
    
    // Friendship Status
    let friendshipStatus = "NONE";
    
    if (isSelf) {
      friendshipStatus = "SELF";
    } else {
      const isFriend = await Friendship.exists({
        users: { $all: [request.user!._id, user._id] },
      });
      
      if (isFriend) {
        friendshipStatus = "FRIENDS";
      } else {
        const requestOut = await FriendRequest.findOne({
          requester: request.user!._id,
          recipient: user._id,
          status: "pending",
        });
        if (requestOut) {
          friendshipStatus = "OUTGOING";
        } else {
          const requestIn = await FriendRequest.findOne({
            requester: user._id,
            recipient: request.user!._id,
            status: "pending",
          });
          if (requestIn) {
            friendshipStatus = "INCOMING";
          }
        }
      }
    }
    
    const visibleUser: any = { ...user };
    if (friendshipStatus !== "SELF" && friendshipStatus !== "FRIENDS") {
      delete visibleUser.online;
      delete visibleUser.lastSeenAt;
    }

    return sendSuccess(response, {
      user: visibleUser,
      stats: {
        eventsCount,
        friendsCount,
        groupsCount
      },
      friendshipStatus
    });
  }),
);
