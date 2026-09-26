import { Router } from "express";
import { isValidObjectId } from "mongoose";
import { z } from "zod";

import { FriendRequest, Friendship, Notification } from "../models/Social.js";
import { User } from "../models/User.js";
import { pushService } from "../services/pushService.js";
import { AppError, asyncHandler, sendSuccess } from "../utils/http.js";

export const friendRouter = Router();

friendRouter.get(
  "/",
  asyncHandler(async (request, response) => {
    const relations = await Friendship.find({
      users: request.user!._id,
    }).populate(
      "users",
      "name username avatarUrl department academicYear verified online",
    );
    const friends = relations
      .flatMap((relation) => relation.users)
      .filter((user) => user._id.toString() !== request.user!._id.toString());
    return sendSuccess(response, friends);
  }),
);

friendRouter.get(
  "/requests",
  asyncHandler(async (request, response) => {
    const [received, sent] = await Promise.all([
      FriendRequest.find({
        recipient: request.user!._id,
        status: "pending",
      }).populate(
        "requester",
        "name username avatarUrl department academicYear",
      ),
      FriendRequest.find({
        requester: request.user!._id,
        status: "pending",
      }).populate(
        "recipient",
        "name username avatarUrl department academicYear",
      ),
    ]);
    return sendSuccess(response, { received, sent });
  }),
);

friendRouter.get(
  "/suggestions",
  asyncHandler(async (request, response) => {
    const relations = await Friendship.find({
      users: request.user!._id,
    }).select("users");
    
    // Also exclude pending requests
    const pendingRequests = await FriendRequest.find({
      $or: [
        { requester: request.user!._id, status: "pending" },
        { recipient: request.user!._id, status: "pending" }
      ]
    }).select("requester recipient");
    
    const excluded = new Set(
      relations.flatMap((item) => item.users.map((id) => id.toString())),
    );
    
    pendingRequests.forEach(req => {
      excluded.add(req.requester.toString());
      excluded.add(req.recipient.toString());
    });
    
    excluded.add(request.user!._id.toString());
    const currentUser = await User.findById(request.user!._id).select("college department");
    
    // Try to find users from the same college or department first
    let suggestions = await User.find({
      _id: { $nin: [...excluded] },
      ...(currentUser?.college || currentUser?.department ? {
        $or: [
          ...(currentUser.college ? [{ college: currentUser.college }] : []),
          ...(currentUser.department ? [{ department: currentUser.department }] : [])
        ]
      } : {})
    })
      .select("name username avatarUrl college department academicYear verified")
      .limit(10);

    // If not enough suggestions, fill with others
    if (suggestions.length < 10) {
      const moreExcluded = new Set([...excluded, ...suggestions.map(s => s._id.toString())]);
      const more = await User.find({ _id: { $nin: [...moreExcluded] } })
        .select("name username avatarUrl college department academicYear verified")
        .limit(10 - suggestions.length);
      suggestions = [...suggestions, ...more];
    }
    
    // Ensure we only select the fields frontend expects
    const formatted = suggestions.map(u => ({
      _id: u._id,
      name: u.name,
      username: u.username,
      avatarUrl: u.avatarUrl,
      college: u.college,
      department: u.department,
      academicYear: u.academicYear,
      verified: u.verified
    }));
    
    return sendSuccess(response, formatted);
  }),
);

friendRouter.get(
  "/mutual/:userId",
  asyncHandler(async (request, response) => {
    if (!isValidObjectId(request.params.userId))
      throw new AppError(400, "Invalid user id", "INVALID_ID");
    const [mine, theirs] = await Promise.all([
      Friendship.find({ users: request.user!._id }).select("users"),
      Friendship.find({ users: request.params.userId }).select("users"),
    ]);
    const mineIds = new Set(
      mine.flatMap((item) => item.users.map((id) => id.toString())),
    );
    const mutualIds = [
      ...new Set(
        theirs.flatMap((item) => item.users.map((id) => id.toString())),
      ),
    ].filter(
      (id) =>
        mineIds.has(id) &&
        id !== request.user!._id.toString() &&
        id !== request.params.userId,
    );
    return sendSuccess(
      response,
      await User.find({ _id: { $in: mutualIds } }).select(
        "name username avatarUrl department academicYear",
      ),
    );
  }),
);

friendRouter.post(
  "/requests",
  asyncHandler(async (request, response) => {
    const { recipientId } = z
      .object({ recipientId: z.string() })
      .parse(request.body);
    if (
      !isValidObjectId(recipientId) ||
      recipientId === request.user!._id.toString()
    )
      throw new AppError(
        400,
        "Choose another valid CampusX user",
        "INVALID_RECIPIENT",
      );
    if (
      await Friendship.exists({
        users: { $all: [request.user!._id, recipientId] },
      })
    )
      throw new AppError(409, "You are already friends", "ALREADY_FRIENDS");

    const existingReq = await FriendRequest.findOne({ requester: request.user!._id, recipient: recipientId, status: "pending" });
    if (existingReq) {
      return sendSuccess(response, existingReq, "Friend request already sent", 200);
    }

    const oppositeReq = await FriendRequest.findOne({ requester: recipientId, recipient: request.user!._id, status: "pending" });
    if (oppositeReq) {
      throw new AppError(409, "You have a pending request from this user. Please accept it instead.", "OPPOSITE_REQUEST_EXISTS");
    }

    const item = await FriendRequest.findOneAndUpdate(
      { requester: request.user!._id, recipient: recipientId },
      {
        $setOnInsert: {
          requester: request.user!._id,
          recipient: recipientId,
        },
        $set: {
          status: "pending",
        },
      },
      { new: true, upsert: true },
    );
    const notification = await Notification.findOneAndUpdate(
      { user: recipientId, actor: request.user!._id, type: "friend_request" },
      {
        $set: {
          title: `${request.user!.name} sent you a friend request`,
          target: { route: "People" }
        },
        $unset: { readAt: "" }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).populate("actor", "name username avatarUrl");

    request.app
      .get("io")
      ?.to(`user:${recipientId}`)
      .emit("friend:request", item);
    request.app
      .get("io")
      ?.to(`user:${recipientId}`)
      .emit("notification:new", notification);
      
    void pushService.sendPushNotification(recipientId as any, {
      title: notification.title,
      body: "Tap to view",
      data: {
        route: notification.target?.route,
        params: notification.target?.params,
        notificationId: notification._id.toString()
      }
    });
    return sendSuccess(response, item, "Friend request sent", 201);
  }),
);

friendRouter.post(
  "/requests/:id/:action",
  asyncHandler(async (request, response) => {
    const action = z.enum(["accept", "reject"]).parse(request.params.action);
    const requestItem = await FriendRequest.findOne({
      $or: [
        { _id: request.params.id },
        { requester: request.params.id, recipient: request.user!._id },
      ],
      recipient: request.user!._id,
      status: "pending",
    });
    if (!requestItem)
      throw new AppError(404, "Friend request not found", "REQUEST_NOT_FOUND");
    requestItem.status = action === "accept" ? "accepted" : "rejected";
    await requestItem.save();

    if (action === "reject") {
      await Notification.deleteMany({
        user: request.user!._id,
        actor: requestItem.requester,
        type: "friend_request"
      });
      request.app
        .get("io")
        ?.to(`user:${requestItem.requester.toString()}`)
        .emit("friend:request_rejected", { userId: request.user!._id.toString() });
    }
    if (action === "accept") {
      const sortedUsers = [
        request.user!._id.toString(),
        requestItem.requester.toString(),
      ].sort();

      await Friendship.updateOne(
        { users: sortedUsers },
        {
          $setOnInsert: {
            users: sortedUsers,
            createdBy: requestItem.requester,
          },
        },
        { upsert: true },
      );
      const notification = await Notification.findOneAndUpdate(
        { user: requestItem.requester, actor: request.user!._id, type: "friend_accepted" },
        {
          $set: {
            title: `${request.user!.name} accepted your friend request`,
            target: { route: "UserProfile", params: { userId: request.user!._id.toString() } }
          },
          $unset: { readAt: "" }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      ).populate("actor", "name username avatarUrl");

      request.app
        .get("io")
        ?.to(`user:${requestItem.requester.toString()}`)
        .emit("friend:accepted", { userId: request.user!._id.toString() });
      request.app
        .get("io")
        ?.to(`user:${requestItem.requester.toString()}`)
        .emit("notification:new", notification);
        
      void pushService.sendPushNotification(requestItem.requester, {
        title: notification.title,
        body: "Tap to view",
        data: {
          route: notification.target?.route,
          params: notification.target?.params,
          notificationId: notification._id.toString()
        }
      });
    }
    return sendSuccess(
      response,
      requestItem,
      action === "accept"
        ? "Friend request accepted"
        : "Friend request rejected",
    );
  }),
);

friendRouter.delete(
  "/:id",
  asyncHandler(async (request, response) => {
    if (!isValidObjectId(request.params.id))
      throw new AppError(400, "Invalid user id", "INVALID_ID");

    const friendship = await Friendship.findOneAndDelete({
      users: { $all: [request.user!._id, request.params.id] },
    });

    if (friendship) {
      request.app
        .get("io")
        ?.to(`user:${request.params.id}`)
        .emit("friend:removed", { userId: request.user!._id.toString() });
        
      request.app
        .get("io")
        ?.to(`user:${request.params.id}`)
        .emit("location:friend_unavailable", { userId: request.user!._id.toString() });
        
      request.app
        .get("io")
        ?.to(`user:${request.user!._id.toString()}`)
        .emit("location:friend_unavailable", { userId: request.params.id });
    }

    return sendSuccess(response, null, "Friend removed");
  }),
);

friendRouter.delete(
  "/requests/:id",
  asyncHandler(async (request, response) => {
    if (!isValidObjectId(request.params.id))
      throw new AppError(400, "Invalid user id", "INVALID_ID");

    const deleted = await FriendRequest.findOneAndDelete({
      requester: request.user!._id,
      recipient: request.params.id,
      status: "pending",
    });

    if (deleted) {
      await Notification.deleteMany({
        user: request.params.id,
        actor: request.user!._id,
        type: "friend_request"
      });
      request.app
        .get("io")
        ?.to(`user:${request.params.id}`)
        .emit("friend:request_cancelled", { userId: request.user!._id.toString() });
    }

    return sendSuccess(response, null, "Friend request cancelled");
  }),
);
