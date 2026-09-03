import { Router } from "express";
import { isValidObjectId } from "mongoose";
import { z } from "zod";

import { FriendRequest, Friendship, Notification } from "../models/Social.js";
import { User } from "../models/User.js";
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
    const excluded = new Set(
      relations.flatMap((item) => item.users.map((id) => id.toString())),
    );
    excluded.add(request.user!._id.toString());
    const suggestions = await User.find({ _id: { $nin: [...excluded] } })
      .select(
        "name username avatarUrl college department academicYear verified",
      )
      .limit(30);
    return sendSuccess(response, suggestions);
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
    const item = await FriendRequest.findOneAndUpdate(
      { requester: request.user!._id, recipient: recipientId },
      {
        $setOnInsert: {
          requester: request.user!._id,
          recipient: recipientId,
          status: "pending",
        },
      },
      { new: true, upsert: true },
    );
    await Notification.create({
      user: recipientId,
      actor: request.user!._id,
      type: "friend_request",
      title: `${request.user!.name} sent you a friend request`,
      target: { route: "FriendRequests" },
    });
    request.app
      .get("io")
      ?.to(`user:${recipientId}`)
      .emit("friend:request", item);
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
    if (action === "accept") {
      const users = [requestItem.requester, requestItem.recipient].sort(
        (a, b) => a.toString().localeCompare(b.toString()),
      );
      await Friendship.updateOne(
        { users: { $all: users } },
        { $setOnInsert: { users, createdBy: request.user!._id } },
        { upsert: true },
      );
      await Notification.create({
        user: requestItem.requester,
        actor: request.user!._id,
        type: "friend_accepted",
        title: `${request.user!.name} accepted your friend request`,
        target: { route: "Friends" },
      });
      request.app
        .get("io")
        ?.to(`user:${requestItem.requester.toString()}`)
        .emit("friend:accepted", { userId: request.user!._id.toString() });
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
