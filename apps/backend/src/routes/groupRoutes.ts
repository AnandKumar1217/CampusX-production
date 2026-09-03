import { Router } from "express";
import { z } from "zod";

import {
  Group,
  GroupFile,
  GroupMembership,
  Poll,
  StudySession,
} from "../models/Group.js";
import { Notification } from "../models/Social.js";
import { AppError, asyncHandler, sendSuccess } from "../utils/http.js";
import { pagination } from "../utils/pagination.js";

export const groupRouter = Router();

groupRouter.get(
  "/",
  asyncHandler(async (request, response) => {
    const { page, limit, skip } = pagination(request.query);
    const query = String(request.query.q ?? "").trim();
    const filter = query ? { $text: { $search: query } } : {};
    const [items, total] = await Promise.all([
      Group.find(filter)
        .populate("owner", "name username avatarUrl")
        .sort({ memberCount: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Group.countDocuments(filter),
    ]);
    return sendSuccess(response, { items, page, limit, total });
  }),
);

groupRouter.post(
  "/",
  asyncHandler(async (request, response) => {
    const input = z
      .object({
        name: z.string().min(3).max(100),
        description: z.string().max(1000).optional(),
        category: z.string().max(80).optional(),
        privacy: z.enum(["public", "private"]).default("public"),
        avatarUrl: z.url().optional(),
      })
      .parse(request.body);
    const group = await Group.create({ ...input, owner: request.user!._id });
    await GroupMembership.create({
      group: group._id,
      user: request.user!._id,
      role: "owner",
      status: "active",
    });
    return sendSuccess(response, group, "Group created", 201);
  }),
);

groupRouter.get(
  "/:groupId",
  asyncHandler(async (request, response) => {
    const [group, membership] = await Promise.all([
      Group.findById(request.params.groupId).populate(
        "owner",
        "name username avatarUrl",
      ),
      GroupMembership.findOne({
        group: request.params.groupId,
        user: request.user!._id,
      }),
    ]);
    if (!group) throw new AppError(404, "Group not found", "GROUP_NOT_FOUND");
    return sendSuccess(response, { group, membership });
  }),
);

groupRouter.post(
  "/:groupId/join",
  asyncHandler(async (request, response) => {
    const group = await Group.findById(request.params.groupId);
    if (!group) throw new AppError(404, "Group not found", "GROUP_NOT_FOUND");
    const status = group.privacy === "public" ? "active" : "requested";
    const membership = await GroupMembership.findOneAndUpdate(
      { group: group._id, user: request.user!._id },
      {
        $setOnInsert: {
          group: group._id,
          user: request.user!._id,
          role: "member",
          status,
        },
      },
      { new: true, upsert: true },
    );
    if (status === "active")
      await Group.updateOne({ _id: group._id }, { $inc: { memberCount: 1 } });
    return sendSuccess(
      response,
      membership,
      status === "active" ? "Joined group" : "Join request sent",
    );
  }),
);

groupRouter.get(
  "/:groupId/members",
  asyncHandler(async (request, response) => {
    const items = await GroupMembership.find({
      group: request.params.groupId,
      status: "active",
    })
      .populate(
        "user",
        "name username avatarUrl department academicYear online",
      )
      .sort({ role: 1, createdAt: 1 });
    return sendSuccess(response, items);
  }),
);

groupRouter.post(
  "/:groupId/invites",
  asyncHandler(async (request, response) => {
    const { userIds } = z
      .object({ userIds: z.array(z.string()).min(1).max(50) })
      .parse(request.body);
    const admin = await GroupMembership.exists({
      group: request.params.groupId,
      user: request.user!._id,
      role: { $in: ["owner", "admin", "moderator"] },
      status: "active",
    });
    if (!admin)
      throw new AppError(
        403,
        "Only group staff can invite members",
        "FORBIDDEN",
      );
    await Promise.all(
      userIds.map((userId) =>
        GroupMembership.updateOne(
          { group: request.params.groupId, user: userId },
          {
            $setOnInsert: {
              group: request.params.groupId,
              user: userId,
              role: "member",
              status: "invited",
            },
          },
          { upsert: true },
        ),
      ),
    );
    await Notification.insertMany(
      userIds.map((userId) => ({
        user: userId,
        actor: request.user!._id,
        type: "group_invite",
        title: `${request.user!.name} invited you to a study group`,
        target: {
          route: "GroupDetails",
          params: { groupId: request.params.groupId },
        },
      })),
    );
    return sendSuccess(
      response,
      { invited: userIds.length },
      "Invitations sent",
    );
  }),
);

groupRouter.get(
  "/:groupId/polls",
  asyncHandler(async (request, response) =>
    sendSuccess(
      response,
      await Poll.find({ group: request.params.groupId })
        .populate("author", "name username avatarUrl")
        .sort({ createdAt: -1 }),
    ),
  ),
);
groupRouter.post(
  "/:groupId/polls",
  asyncHandler(async (request, response) => {
    const input = z
      .object({
        question: z.string().min(3).max(400),
        options: z.array(z.string().min(1).max(150)).min(2).max(10),
        multiple: z.boolean().default(false),
        closesAt: z.coerce.date().optional(),
      })
      .parse(request.body);
    const membership = await GroupMembership.exists({
      group: request.params.groupId,
      user: request.user!._id,
      status: "active",
    });
    if (!membership)
      throw new AppError(
        403,
        "Join this group before creating a poll",
        "FORBIDDEN",
      );
    const poll = await Poll.create({
      group: request.params.groupId,
      author: request.user!._id,
      question: input.question,
      options: input.options.map((label) => ({ label, voters: [] })),
      multiple: input.multiple,
      closesAt: input.closesAt,
    });
    request.app
      .get("io")
      ?.to(`group:${request.params.groupId}`)
      .emit("poll:update", poll);
    return sendSuccess(response, poll, "Poll created", 201);
  }),
);

groupRouter.post(
  "/:groupId/polls/:pollId/vote",
  asyncHandler(async (request, response) => {
    const { option } = z
      .object({ option: z.number().int().min(0) })
      .parse(request.body);
    const poll = await Poll.findOne({
      _id: request.params.pollId,
      group: request.params.groupId,
      closedAt: { $exists: false },
    });
    if (!poll || !poll.options[option])
      throw new AppError(404, "Poll or option not found", "POLL_NOT_FOUND");
    poll.options.forEach((item) => {
      item.voters = item.voters.filter(
        (id) => id.toString() !== request.user!._id.toString(),
      );
    });
    poll.options[option].voters.push(request.user!._id);
    await poll.save();
    request.app
      .get("io")
      ?.to(`group:${request.params.groupId}`)
      .emit("poll:update", poll);
    return sendSuccess(response, poll, "Vote recorded");
  }),
);

groupRouter.get(
  "/:groupId/files",
  asyncHandler(async (request, response) =>
    sendSuccess(
      response,
      await GroupFile.find({ group: request.params.groupId })
        .populate("uploadedBy", "name username avatarUrl")
        .sort({ createdAt: -1 }),
    ),
  ),
);
groupRouter.get(
  "/:groupId/sessions",
  asyncHandler(async (request, response) =>
    sendSuccess(
      response,
      await StudySession.find({
        group: request.params.groupId,
        startsAt: { $gte: new Date() },
      }).sort({ startsAt: 1 }),
    ),
  ),
);
groupRouter.post(
  "/:groupId/sessions",
  asyncHandler(async (request, response) => {
    const input = z
      .object({
        title: z.string().min(3).max(160),
        description: z.string().max(1000).optional(),
        startsAt: z.coerce.date(),
        endsAt: z.coerce.date().optional(),
        location: z.string().max(200).optional(),
        meetingUrl: z.url().optional(),
      })
      .parse(request.body);
    const item = await StudySession.create({
      ...input,
      group: request.params.groupId,
      createdBy: request.user!._id,
    });
    return sendSuccess(response, item, "Study session created", 201);
  }),
);
