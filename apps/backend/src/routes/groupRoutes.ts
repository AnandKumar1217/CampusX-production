import { Router } from "express";
import type { Request } from "express";
import { z } from "zod";

import {
  Group,
  GroupFile,
  GroupMembership,
  Poll,
  StudySession,
  GroupMessage,
} from "../models/Group.js";
import { Notification, Post, Friendship } from "../models/Social.js";
import { AppError, asyncHandler, sendSuccess } from "../utils/http.js";
import { pagination } from "../utils/pagination.js";
import { cloudinaryService } from "../services/cloudinary.js";
import { pushService } from "../services/pushService.js";
import { formatPosts } from "./postRoutes.js";
import { emitNotificationChanged } from "../utils/notificationEvents.js";

export const groupRouter = Router();

async function requireGroupContentAccess(groupId: string, userId: string) {
  const group = await Group.findById(groupId).select("privacy");
  if (!group) throw new AppError(404, "Group not found", "GROUP_NOT_FOUND");
  if (group.privacy === "private") {
    const member = await GroupMembership.exists({ group: groupId, user: userId, status: "active" });
    if (!member) throw new AppError(403, "Only members can view private group content", "FORBIDDEN");
  }
}

function emitMembershipChanged(request: Request, groupId: string, userId: string) {
  request.app.get("io")?.to(`user:${userId}`).emit("group:membership:changed", { groupId, userId });
}

function evictGroupSockets(request: Request, groupId: string, userId: string) {
  request.app.get("io")?.in(`user:${userId}`).socketsLeave(`group:${groupId}`);
}

async function emitGroupChanged(request: Request, groupId: string, event: string, isPublic: boolean) {
  const io = request.app.get("io");
  if (isPublic) {
    io?.emit(event, { groupId });
  } else {
    const members = await GroupMembership.find({ group: groupId, status: "active" }).select("user");
    members.forEach((member) => io?.to(`user:${member.user}`).emit(event, { groupId }));
  }
}

async function emitToActiveGroupMembers(request: Request, groupId: string, event: string, payload: object) {
  const members = await GroupMembership.find({ group: groupId, status: "active" }).select("user");
  const io = request.app.get("io");
  members.forEach((member) => io?.to(`user:${member.user}`).emit(event, payload));
}

groupRouter.get(
  "/",
  asyncHandler(async (request, response) => {
    const { page, limit, skip } = pagination(request.query);
    const query = String(request.query.q ?? "").trim().slice(0, 100)
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const filter = query ? {
      privacy: "public",
      $or: [
        { name: { $regex: query, $options: "i" } },
        { description: { $regex: query, $options: "i" } },
        { category: { $regex: query, $options: "i" } }
      ]
    } : { privacy: "public" };
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

groupRouter.get(
  "/mine",
  asyncHandler(async (request, response) => {
    const query = String(request.query.q ?? "").trim().slice(0, 100)
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const filterType = request.query.filter as string | undefined;

    let roleFilter: any = { $in: ["owner", "admin", "moderator", "member"] };
    if (filterType === "owned") {
      roleFilter = "owner";
    } else if (filterType === "joined") {
      roleFilter = { $in: ["admin", "moderator", "member"] };
    }

    const memberships = await GroupMembership.find({
      user: request.user!._id,
      status: "active",
      role: roleFilter,
    }).populate({
      path: "group",
      match: query ? {
        $or: [
          { name: { $regex: query, $options: "i" } },
          { description: { $regex: query, $options: "i" } },
          { category: { $regex: query, $options: "i" } }
        ]
      } : undefined,
      populate: { path: "owner", select: "name username avatarUrl" }
    });

    // Filter out memberships where group is null (due to match filter)
    const groups = memberships.filter(m => m.group).map(m => m.group);
    return sendSuccess(response, groups);
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
        avatarUrl: z.string().url().optional(),
        avatarPublicId: z.string().optional(),
      })
      .parse(request.body);

    try {
      const group = await Group.create({ ...input, owner: request.user!._id });
      await GroupMembership.create({
        group: group._id,
        user: request.user!._id,
        role: "owner",
        status: "active",
      });

      const io = request.app.get("io");
      if (group.privacy === "public") io?.emit("group:created", { groupId: group._id.toString() });
      else io?.to(`user:${request.user!._id.toString()}`).emit("group:created", { groupId: group._id.toString() });
      emitMembershipChanged(request, group._id.toString(), request.user!._id.toString());

      return sendSuccess(response, group, "Group created", 201);
    } catch (err) {
      if (input.avatarPublicId) {
        await cloudinaryService.deleteImage(input.avatarPublicId).catch(console.error);
      }
      throw err;
    }
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
    if (group.privacy === "private" && membership?.status !== "active") {
      if (!membership) throw new AppError(404, "Group not found", "GROUP_NOT_FOUND");
      return sendSuccess(response, {
        group: {
          _id: group._id,
          name: group.name,
          avatarUrl: group.avatarUrl,
          privacy: group.privacy,
          memberCount: group.memberCount,
        },
        membership,
      });
    }
    return sendSuccess(response, { group, membership });
  }),
);

groupRouter.patch(
  "/:groupId",
  asyncHandler(async (request, response) => {
    const input = z
      .object({
        name: z.string().min(3).max(100).optional(),
        description: z.string().max(1000).optional(),
        category: z.string().max(80).optional(),
        privacy: z.enum(["public", "private"]).optional(),
        avatarUrl: z.string().url().optional().nullable(),
        avatarPublicId: z.string().optional().nullable(),
      })
      .parse(request.body);

    const group = await Group.findById(request.params.groupId);
    if (!group) throw new AppError(404, "Group not found", "NOT_FOUND");

    const membership = await GroupMembership.findOne({
      group: group._id,
      user: request.user!._id,
    });

    const isOwner = group.owner.toString() === request.user!._id.toString();
    const isAdmin =
      isOwner ||
      (membership?.status === "active" && membership.role === "admin");

    if (!isAdmin) {
      throw new AppError(403, "You do not have permission to edit this group", "FORBIDDEN");
    }

    const oldPublicId = group.avatarPublicId;
    const wasPublic = group.privacy === "public";

    Object.assign(group, input);
    await group.save();

    if (input.avatarPublicId !== undefined && oldPublicId && oldPublicId !== group.avatarPublicId) {
      await cloudinaryService.deleteImage(oldPublicId).catch(console.error);
    }

    await emitGroupChanged(request, group._id.toString(), "group:updated", wasPublic || group.privacy === "public");

    return sendSuccess(response, group, "Group updated");
  }),
);

groupRouter.delete(
  "/:groupId",
  asyncHandler(async (request, response) => {
    const group = await Group.findOne({ _id: request.params.groupId, owner: request.user!._id });
    if (!group) throw new AppError(404, "Group not found or you are not the owner", "NOT_FOUND");

    const groupId = group._id;
    const memberIds = (await GroupMembership.find({ group: groupId }).select("user"))
      .map((member) => member.user.toString());
    const publicId = group.avatarPublicId;

    await Promise.all([
      GroupMembership.deleteMany({ group: groupId }),
      Poll.deleteMany({ group: groupId }),
      GroupFile.deleteMany({ group: groupId }),
      StudySession.deleteMany({ group: groupId }),
      GroupMessage.deleteMany({ group: groupId }),
      Post.deleteMany({ group: groupId, visibility: "group" }), // Clean up group posts only
      group.deleteOne()
    ]);

    if (publicId) {
      await cloudinaryService.deleteImage(publicId).catch(console.error);
    }

    const io = request.app.get("io");
    if (group.privacy === "public") io?.emit("group:deleted", { groupId: groupId.toString() });
    memberIds.forEach((id) => {
      evictGroupSockets(request, groupId.toString(), id);
      io?.to(`user:${id}`).emit("group:deleted", { groupId: groupId.toString() });
      emitMembershipChanged(request, groupId.toString(), id);
    });

    return sendSuccess(response, null, "Group deleted");
  }),
);

groupRouter.post(
  "/:groupId/join",
  asyncHandler(async (request, response) => {
    const group = await Group.findById(request.params.groupId);
    if (!group) throw new AppError(404, "Group not found", "GROUP_NOT_FOUND");
    const status = group.privacy === "public" ? "active" : "requested";

    const existing = await GroupMembership.findOne({ group: group._id, user: request.user!._id });
    if (existing) {
      return sendSuccess(response, existing, "Already requested or joined");
    }

    const membership = await GroupMembership.create({
      group: group._id,
      user: request.user!._id,
      role: "member",
      status,
    });

    if (status === "active") {
      await Group.updateOne({ _id: group._id }, { $inc: { memberCount: 1 } });
      await emitGroupChanged(request, group._id.toString(), "group:updated", group.privacy === "public");
    } else {
      const admins = await GroupMembership.find({
        group: group._id,
        role: { $in: ["owner", "admin"] },
        status: "active"
      });
      if (admins.length > 0) {
        await Notification.insertMany(
          admins.map(admin => ({
            user: admin.user,
            actor: request.user!._id,
            type: "group_join_request",
            title: `${request.user!.name} requested to join ${group.name}`,
            target: { route: "GroupDetails", params: { groupId: group._id } }
          }))
        );
        emitNotificationChanged(request, admins.map((admin) => admin.user.toString()));

        void pushService.sendPushNotification(admins.map(a => a.user as any), {
          title: `${request.user!.name} requested to join ${group.name}`,
          body: "Tap to review",
          data: {
            route: "GroupDetails",
            params: { groupId: group._id }
          }
        });
      }
    }
    emitMembershipChanged(request, group._id.toString(), request.user!._id.toString());

    return sendSuccess(
      response,
      membership,
      status === "active" ? "Joined group" : "Join request sent",
    );
  }),
);

groupRouter.post(
  "/:groupId/leave",
  asyncHandler(async (request, response) => {
    const membership = await GroupMembership.findOne({ group: request.params.groupId, user: request.user!._id });
    if (!membership || membership.status !== "active") {
      throw new AppError(400, "You are not an active member of this group");
    }
    if (membership.role === "owner") {
      throw new AppError(400, "Owner cannot leave the group. Transfer ownership or delete the group.");
    }

    await membership.deleteOne();
    evictGroupSockets(request, String(request.params.groupId), request.user!._id.toString());
    await Group.updateOne({ _id: request.params.groupId }, { $inc: { memberCount: -1 } });
    emitMembershipChanged(request, String(request.params.groupId), request.user!._id.toString());
    const group = await Group.findById(request.params.groupId).select("privacy");
    await emitGroupChanged(request, String(request.params.groupId), "group:updated", group?.privacy === "public");

    return sendSuccess(response, null, "Left group successfully");
  }),
);

groupRouter.get(
  "/:groupId/members",
  asyncHandler(async (request, response) => {
    await requireGroupContentAccess(String(request.params.groupId), request.user!._id.toString());
    const items = await GroupMembership.find({
      group: request.params.groupId,
      status: "active",
    })
      .populate(
        "user",
        "name username avatarUrl department academicYear",
      )
      .sort({ role: 1, createdAt: 1 });
    return sendSuccess(response, items);
  }),
);

groupRouter.get(
  "/:groupId/requests",
  asyncHandler(async (request, response) => {
    const admin = await GroupMembership.exists({
      group: request.params.groupId,
      user: request.user!._id,
      role: { $in: ["owner", "admin"] },
      status: "active",
    });
    if (!admin) throw new AppError(403, "Only group admins can view requests", "FORBIDDEN");

    const items = await GroupMembership.find({
      group: request.params.groupId,
      status: "requested",
    })
      .populate("user", "name username avatarUrl department academicYear")
      .sort({ createdAt: -1 });

    return sendSuccess(response, items);
  }),
);

groupRouter.patch(
  "/:groupId/requests/:userId",
  asyncHandler(async (request, response) => {
    const { action } = z.object({ action: z.enum(["approve", "reject"]) }).parse(request.body);

    const admin = await GroupMembership.exists({
      group: request.params.groupId,
      user: request.user!._id,
      role: { $in: ["owner", "admin"] },
      status: "active",
    });
    if (!admin) throw new AppError(403, "Only group admins can manage requests", "FORBIDDEN");

    const membership = await GroupMembership.findOne({
      group: request.params.groupId,
      user: request.params.userId,
      status: "requested",
    });

    if (!membership) throw new AppError(404, "Request not found");

    if (action === "approve") {
      membership.status = "active";
      await membership.save();
      await Group.updateOne({ _id: request.params.groupId }, { $inc: { memberCount: 1 } });
      emitMembershipChanged(request, String(request.params.groupId), membership.user.toString());
      const group = await Group.findById(request.params.groupId).select("name privacy");
      await emitGroupChanged(request, String(request.params.groupId), "group:updated", group?.privacy === "public");
      await Notification.create({
        user: membership.user,
        actor: request.user!._id,
        type: "group_join_accepted",
        title: `Your request to join ${group?.name} was approved!`,
        target: { route: "GroupDetails", params: { groupId: request.params.groupId } }
      });
      emitNotificationChanged(request, [membership.user.toString()]);
      return sendSuccess(response, membership, "Request approved");
    } else {
      await membership.deleteOne();
      emitMembershipChanged(request, String(request.params.groupId), membership.user.toString());
      const group = await Group.findById(request.params.groupId).select("name");
      await Notification.create({
        user: membership.user,
        actor: request.user!._id,
        type: "group_join_rejected",
        title: `Your request to join ${group?.name} was rejected.`,
        target: { route: "Home" }
      });
      emitNotificationChanged(request, [membership.user.toString()]);
      return sendSuccess(response, null, "Request rejected");
    }
  }),
);

groupRouter.delete(
  "/:groupId/members/:userId",
  asyncHandler(async (request, response) => {
    const ownerMembership = await GroupMembership.findOne({
      group: request.params.groupId,
      user: request.user!._id,
      status: "active",
    });

    if (!ownerMembership || ownerMembership.role !== "owner") {
      throw new AppError(403, "Only group owner can remove members", "FORBIDDEN");
    }

    if (request.user!._id.toString() === request.params.userId) {
      throw new AppError(400, "You cannot remove yourself. Use the leave group action instead.");
    }

    const targetMembership = await GroupMembership.findOne({
      group: request.params.groupId,
      user: request.params.userId,
      status: "active",
    });

    if (!targetMembership) throw new AppError(404, "Member not found");

    if (targetMembership.role === "owner") {
      throw new AppError(403, "Cannot remove the group owner");
    }

    await targetMembership.deleteOne();
    evictGroupSockets(request, String(request.params.groupId), String(request.params.userId));
    await Group.updateOne({ _id: request.params.groupId }, { $inc: { memberCount: -1 } });
    emitMembershipChanged(request, String(request.params.groupId), String(request.params.userId));
    const privacy = (await Group.findById(request.params.groupId).select("privacy"))?.privacy;
    await emitGroupChanged(request, String(request.params.groupId), "group:updated", privacy === "public");

    const group = await Group.findById(request.params.groupId).select("name");
    await Notification.create({
      user: request.params.userId,
      actor: request.user!._id,
      type: "group_removed",
      title: `You were removed from ${group?.name}`,
      target: { route: "Home" }
    });
    emitNotificationChanged(request, [String(request.params.userId)]);

    return sendSuccess(response, null, "Member removed");
  }),
);

groupRouter.patch(
  "/:groupId/members/:userId/role",
  asyncHandler(async (request, response) => {
    const { role } = z.object({ role: z.enum(["admin", "moderator", "member"]) }).parse(request.body);

    const ownerMembership = await GroupMembership.findOne({
      group: request.params.groupId,
      user: request.user!._id,
      status: "active",
      role: "owner"
    });

    if (!ownerMembership) {
      throw new AppError(403, "Only the group owner can manage roles", "FORBIDDEN");
    }

    if (request.user!._id.toString() === request.params.userId) {
      throw new AppError(400, "Owner cannot change their own role");
    }

    const targetMembership = await GroupMembership.findOne({
      group: request.params.groupId,
      user: request.params.userId,
      status: "active",
    });

    if (!targetMembership) throw new AppError(404, "Member not found");
    if (targetMembership.role === "owner") throw new AppError(400, "Cannot change owner role");

    targetMembership.role = role;
    await targetMembership.save();

    const group = await Group.findById(request.params.groupId).select("name");
    await Notification.create({
      user: request.params.userId,
      actor: request.user!._id,
      type: "group_role_changed",
      title: `Your role in ${group?.name} was changed to ${role}`,
      target: { route: "GroupDetails", params: { groupId: request.params.groupId } }
    });
    emitNotificationChanged(request, [String(request.params.userId)]);

    return sendSuccess(response, targetMembership, "Role updated");
  }),
);

groupRouter.post(
  "/:groupId/invites",
  asyncHandler(async (request, response) => {
    const { userIds } = z
      .object({ userIds: z.array(z.string()).min(1).max(50) })
      .parse(request.body);

    const group = await Group.findById(request.params.groupId);
    if (!group) throw new AppError(404, "Group not found");

    const inviterMembership = await GroupMembership.findOne({
      group: request.params.groupId,
      user: request.user!._id,
      status: "active",
    });

    if (!inviterMembership)
      throw new AppError(403, "Only active group members can invite", "FORBIDDEN");

    // Validate that the users being invited are accepted friends
    const friendships = await Friendship.find({ users: request.user!._id });
    const friendIds = new Set(
      friendships.flatMap((f) => f.users.map((u) => u.toString()))
    );

    const validUserIds = userIds.filter((userId) => {
      // Must be a friend and cannot be the inviter themselves
      return friendIds.has(userId) && userId !== request.user!._id.toString();
    });

    if (validUserIds.length === 0) {
      throw new AppError(400, "None of the users provided are valid friends to invite");
    }

    // Filter out users who are already in the group (any status)
    const existingMemberships = await GroupMembership.find({
      group: request.params.groupId,
      user: { $in: validUserIds }
    });
    const existingMemberIds = new Set(existingMemberships.map(m => m.user.toString()));

    const finalUserIdsToInvite = validUserIds.filter(id => !existingMemberIds.has(id));

    if (finalUserIdsToInvite.length === 0) {
      return sendSuccess(response, { invited: 0 }, "Users are already members or invited");
    }

    await GroupMembership.insertMany(
      finalUserIdsToInvite.map((userId) => ({
        group: request.params.groupId,
        user: userId,
        role: "member",
        status: "invited",
        invitedBy: request.user!._id
      }))
    );
    finalUserIdsToInvite.forEach((id) => emitMembershipChanged(request, String(request.params.groupId), id));

    await Notification.insertMany(
      finalUserIdsToInvite.map((userId) => ({
        user: userId,
        actor: request.user!._id,
        type: "group_invite",
        title: `${request.user!.name} invited you to join ${group.name}`,
        target: {
          route: "GroupDetails",
          params: { groupId: request.params.groupId },
        },
      })),
    );
    emitNotificationChanged(request, finalUserIdsToInvite);
    return sendSuccess(
      response,
      { invited: finalUserIdsToInvite.length },
      "Invitations sent",
    );
  }),
);

groupRouter.post(
  "/:groupId/invites/:userId/accept",
  asyncHandler(async (request, response) => {
    // Note: userId is typically request.user._id, but could be admin accepting for someone else?
    // Wait, the invitee accepts it themselves. So we ensure they are the one accepting.
    if (request.params.userId !== request.user!._id.toString()) {
       throw new AppError(403, "You can only accept your own invites");
    }

    const group = await Group.findById(request.params.groupId);
    if (!group) throw new AppError(404, "Group not found");

    const membership = await GroupMembership.findOne({
      group: request.params.groupId,
      user: request.user!._id,
      status: "invited"
    }).populate("invitedBy", "name");

    if (!membership) {
      throw new AppError(404, "Invite not found or already processed");
    }

    let newStatus = "active";
    let message = "Joined group successfully";

    if (group.privacy === "private") {
      // Need to check inviter's role
      const inviterRoleMembership = await GroupMembership.findOne({
        group: request.params.groupId,
        user: membership.invitedBy,
        status: "active"
      });

      if (!inviterRoleMembership || !["owner", "admin"].includes(inviterRoleMembership.role)) {
        newStatus = "requested";
        message = "Join request sent to admins for approval";
      }
    }

    membership.status = newStatus as "active" | "requested";
    await membership.save();

    if (newStatus === "active") {
      await Group.updateOne({ _id: group._id }, { $inc: { memberCount: 1 } });
      emitMembershipChanged(request, group._id.toString(), request.user!._id.toString());
      await emitGroupChanged(request, group._id.toString(), "group:updated", group.privacy === "public");
    } else {
      // Notify admins
      const admins = await GroupMembership.find({
        group: group._id,
        role: { $in: ["owner", "admin"] },
        status: "active"
      });
      if (admins.length > 0) {
        await Notification.insertMany(
          admins.map(admin => ({
            user: admin.user,
            actor: request.user!._id,
            type: "group_join_request",
            title: `${request.user!.name} accepted an invite and requested to join ${group.name}`,
            target: { route: "GroupDetails", params: { groupId: group._id } }
          }))
        );
        emitNotificationChanged(request, admins.map((admin) => admin.user.toString()));
      }
    }

    return sendSuccess(response, membership, message);
  })
);

groupRouter.post(
  "/:groupId/invites/:userId/decline",
  asyncHandler(async (request, response) => {
    if (request.params.userId !== request.user!._id.toString()) {
       throw new AppError(403, "You can only decline your own invites");
    }

    const membership = await GroupMembership.findOneAndDelete({
      group: request.params.groupId,
      user: request.user!._id,
      status: "invited"
    });

    if (!membership) {
      throw new AppError(404, "Invite not found or already processed");
    }

    emitMembershipChanged(request, String(request.params.groupId), request.user!._id.toString());

    return sendSuccess(response, null, "Invite declined");
  })
);

groupRouter.get(
  "/:groupId/polls",
  asyncHandler(async (request, response) => {
    await requireGroupContentAccess(String(request.params.groupId), request.user!._id.toString());
    return sendSuccess(
      response,
      await Poll.find({ group: request.params.groupId })
        .populate("author", "name username avatarUrl")
        .sort({ createdAt: -1 }),
    );
  }),
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
    await emitToActiveGroupMembers(request, String(request.params.groupId), "poll:update", poll);
    return sendSuccess(response, poll, "Poll created", 201);
  }),
);

groupRouter.post(
  "/:groupId/polls/:pollId/vote",
  asyncHandler(async (request, response) => {
    const { option } = z
      .object({ option: z.number().int().min(0) })
      .parse(request.body);
    const membership = await GroupMembership.exists({
      group: request.params.groupId,
      user: request.user!._id,
      status: "active",
    });
    if (!membership) throw new AppError(403, "You must be a member to vote", "FORBIDDEN");
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
    await emitToActiveGroupMembers(request, String(request.params.groupId), "poll:update", poll);
    return sendSuccess(response, poll, "Vote recorded");
  }),
);

groupRouter.get(
  "/:groupId/files",
  asyncHandler(async (request, response) => {
    await requireGroupContentAccess(String(request.params.groupId), request.user!._id.toString());
    return sendSuccess(
      response,
      await GroupFile.find({ group: request.params.groupId })
        .populate("uploadedBy", "name username avatarUrl")
        .sort({ createdAt: -1 }),
    );
  }),
);
groupRouter.get(
  "/:groupId/sessions",
  asyncHandler(async (request, response) => {
    await requireGroupContentAccess(String(request.params.groupId), request.user!._id.toString());
    return sendSuccess(
      response,
      await StudySession.find({
        group: request.params.groupId,
        startsAt: { $gte: new Date() },
      }).sort({ startsAt: 1 }),
    );
  }),
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
    const membership = await GroupMembership.exists({
      group: request.params.groupId,
      user: request.user!._id,
      status: "active",
    });
    if (!membership) throw new AppError(403, "You must be a member to create a session", "FORBIDDEN");

    const item = await StudySession.create({
      ...input,
      group: request.params.groupId,
      createdBy: request.user!._id,
    });
    return sendSuccess(response, item, "Study session created", 201);
  }),
);

groupRouter.get(
  "/:groupId/posts",
  asyncHandler(async (request, response) => {
    const group = await Group.findById(request.params.groupId);
    if (!group) throw new AppError(404, "Group not found", "GROUP_NOT_FOUND");

    const membership = await GroupMembership.exists({
      group: group._id,
      user: request.user!._id,
      status: "active",
    });
    if (!membership) {
      throw new AppError(403, "You must be a member to view group posts", "FORBIDDEN");
    }

    const { page, limit, skip } = pagination(request.query);
    const [items, total] = await Promise.all([
      Post.find({ group: group._id, deletedAt: { $exists: false } })
        .populate("author", "name username avatarUrl department academicYear verified")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Post.countDocuments({ group: group._id, deletedAt: { $exists: false } }),
    ]);

    const formattedItems = await formatPosts(items, request.user?._id?.toString());
    return sendSuccess(response, { items: formattedItems, page, limit, total });
  }),
);

groupRouter.get(
  "/:groupId/messages",
  asyncHandler(async (request, response) => {
    const membership = await GroupMembership.exists({
      group: request.params.groupId,
      user: request.user!._id,
      status: "active",
    });
    if (!membership) {
      throw new AppError(403, "You must be an active member to view messages", "FORBIDDEN");
    }

    const { page, limit, skip } = pagination(request.query);
    const [items, total] = await Promise.all([
      GroupMessage.find({ group: request.params.groupId, deletedAt: { $exists: false } })
        .populate("sender", "name username avatarUrl")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      GroupMessage.countDocuments({ group: request.params.groupId, deletedAt: { $exists: false } }),
    ]);

    return sendSuccess(response, { items, page, limit, total });
  }),
);

groupRouter.post(
  "/:groupId/messages",
  asyncHandler(async (request, response) => {
    const input = z
      .object({
        text: z.string().max(4000).optional(),
        nonce: z.string().max(100).optional(),
        attachments: z.array(z.object({
          url: z.string(),
          name: z.string().optional(),
          mimeType: z.string().optional(),
          size: z.number().optional()
        })).optional()
      })
      .refine(data => data.text || (data.attachments && data.attachments.length > 0), {
        message: "Message must contain text or attachments"
      })
      .parse(request.body);

    const groupIdParam = request.params.groupId;
    const groupId = Array.isArray(groupIdParam) ? groupIdParam[0] : groupIdParam;
    if (!groupId) {
      throw new AppError(400, "Group id is required", "INVALID_GROUP_ID");
    }

    const membership = await GroupMembership.exists({
      group: groupId,
      user: request.user!._id,
      status: "active",
    });
    if (!membership) {
      throw new AppError(403, "You must be an active member to send messages", "FORBIDDEN");
    }

    const message = await GroupMessage.create({
      group: groupId,
      sender: request.user!._id,
      text: input.text || "",
      nonce: input.nonce,
      attachments: input.attachments || [],
    });

    const populatedMessage = await message.populate("sender", "name username avatarUrl");

    await emitToActiveGroupMembers(request, groupId, "group:message:new", populatedMessage);

    const group = await Group.findById(groupId).select("name");
    const members = await GroupMembership.find({ group: groupId, status: "active" }).select("user");
    
    for (const member of members) {
      if (member.user.toString() !== request.user!._id.toString()) {
        const notification = await Notification.findOneAndUpdate(
          { user: member.user, type: "message", "target.params.groupId": groupId },
          {
            $set: {
              actor: request.user!._id,
              title: group?.name || "Group Chat",
              body: message.text || "Sent an attachment",
              target: {
                route: "GroupConversation",
                params: { groupId },
              },
            },
            $unset: { readAt: "" }
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        ).populate("actor", "name username avatarUrl");

        const io = request.app.get("io");
        io?.to(`user:${member.user.toString()}`).emit("notification:new", notification);
        
        void pushService.sendPushNotification(member.user, {
          title: notification.title,
          body: notification.body || "New Message",
          data: {
            route: notification.target?.route,
            params: notification.target?.params,
            notificationId: notification._id.toString()
          },
        });
      }
    }

    return sendSuccess(response, populatedMessage, "Message sent", 201);
  }),
);
