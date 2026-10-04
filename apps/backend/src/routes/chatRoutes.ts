import { Router } from "express";
import { isValidObjectId } from "mongoose";
import { z } from "zod";

import { Conversation, Message } from "../models/Chat.js";
import { Friendship } from "../models/Social.js";
import { AppError, asyncHandler, sendSuccess } from "../utils/http.js";
import { pushService } from "../services/pushService.js";
import { serializeChatMessage } from "../serializers/chatMessage.js";

export const chatRouter = Router();

chatRouter.get(
  "/",
  asyncHandler(async (request, response) => {
    const conversations = await Conversation.find({
      participants: request.user!._id,
      participantMetadata: { $not: { $elemMatch: { user: request.user!._id, hidden: true } } }
    })
      .populate("participants", "name username avatarUrl online lastSeenAt")
      .populate("lastMessage")
      .sort({ lastMessageAt: -1 });
    return sendSuccess(response, conversations);
  }),
);

chatRouter.post(
  "/",
  asyncHandler(async (request, response) => {
    const { participantId } = z
      .object({ participantId: z.string() })
      .parse(request.body);
    if (!isValidObjectId(participantId) || participantId === request.user!._id.toString()) {
      throw new AppError(400, "Choose another user", "BAD_REQUEST");
    }
    let conversation = await Conversation.findOne({
      type: "direct",
      participants: { $all: [request.user!._id, participantId], $size: 2 },
    });
    if (!conversation) {
      conversation = await Conversation.create({
        type: "direct",
        participants: [request.user!._id, participantId],
        participantMetadata: [
          { user: request.user!._id, unreadCount: 0 },
          { user: participantId, unreadCount: 0 },
        ],
        createdBy: request.user!._id,
      });
      const io = request.app.get("io");
      [request.user!._id.toString(), participantId].forEach((id) =>
        io?.to(`user:${id}`).emit("chat:conversation:new", { conversationId: conversation!._id.toString() })
      );
    }
    return sendSuccess(response, conversation, "Conversation ready", 201);
  }),
);

chatRouter.post(
  "/groups",
  asyncHandler(async (request, response) => {
    const { title, participantIds } = z
      .object({
        title: z.string().min(1).max(50),
        participantIds: z.array(z.string()).min(1)
      })
      .parse(request.body);

    const participants = Array.from(new Set([request.user!._id.toString(), ...participantIds]));
    if (participants.some((id) => !isValidObjectId(id))) {
      throw new AppError(400, "Invalid participant", "BAD_REQUEST");
    }
    const peers = participants.filter((id) => id !== request.user!._id.toString());
    const friendships = await Promise.all(peers.map((id) =>
      Friendship.exists({ users: { $all: [request.user!._id, id] } })
    ));
    if (friendships.some((friendship) => !friendship)) {
      throw new AppError(403, "You can only add friends to a chat", "FORBIDDEN");
    }

    const participantMetadata = participants.map(userId => ({
      user: userId,
      unreadCount: 0
    }));

    const conversation = await Conversation.create({
      type: "group",
      title,
      participants,
      participantMetadata,
      admins: [request.user!._id],
      createdBy: request.user!._id,
    });
    const io = request.app.get("io");
    participants.forEach((id) => io?.to(`user:${id}`).emit("chat:conversation:new", { conversationId: conversation._id.toString() }));

    return sendSuccess(response, conversation, "Group created", 201);
  }),
);

chatRouter.get(
  "/:conversationId",
  asyncHandler(async (request, response) => {
    if (!isValidObjectId(request.params.conversationId)) {
      throw new AppError(404, "Conversation not found", "NOT_FOUND");
    }
    const conversation = await Conversation.findOne({
      _id: request.params.conversationId,
      participants: request.user!._id,
    }).populate("participants", "name username avatarUrl online lastSeenAt");

    if (!conversation) {
      throw new AppError(404, "Conversation not found", "NOT_FOUND");
    }

    return sendSuccess(response, conversation);
  }),
);

chatRouter.get(
  "/:conversationId/messages",
  asyncHandler(async (request, response) => {
    if (!isValidObjectId(request.params.conversationId)) {
      throw new AppError(404, "Conversation not found", "NOT_FOUND");
    }
    const conversation = await Conversation.findOne({
      _id: request.params.conversationId,
      participants: request.user!._id,
    });
    if (!conversation)
      throw new AppError(
        403,
        "You are not a participant in this conversation",
        "FORBIDDEN",
      );
    const cursorQuery = z.object({
      limit: z.coerce.number().int().min(1).max(50).default(30),
      beforeCreatedAt: z.string().datetime().optional(),
      beforeId: z.string().optional(),
    }).parse(request.query);
    if (cursorQuery.beforeId && !isValidObjectId(cursorQuery.beforeId)) {
      throw new AppError(400, "Invalid message cursor", "BAD_REQUEST");
    }
    const myMeta = conversation.participantMetadata.find(p => p.user?.toString() === request.user!._id.toString());
    const filter: any = {
      conversation: request.params.conversationId,
      deletedAt: { $exists: false },
      deletedFor: { $ne: request.user!._id },
    };
    if (myMeta?.clearedAt) {
      filter.createdAt = { $gt: myMeta.clearedAt };
    }
    if (cursorQuery.beforeCreatedAt) {
      const before = new Date(cursorQuery.beforeCreatedAt);
      filter.$or = cursorQuery.beforeId
        ? [
            { createdAt: { $lt: before } },
            { createdAt: before, _id: { $lt: cursorQuery.beforeId } },
          ]
        : [{ createdAt: { $lt: before } }];
    }
    const items = await Message.find(filter)
      .populate("sender", "name username avatarUrl")
      .populate({ path: "replyTo", select: "sender text", populate: { path: "sender", select: "name" } })
      .sort({ createdAt: -1 })
      .limit(cursorQuery.limit + 1);
    const hasMore = items.length > cursorQuery.limit;
    const pageItems = hasMore ? items.slice(0, cursorQuery.limit) : items;
    const oldest = pageItems[pageItems.length - 1];
    return sendSuccess(response, {
      items: pageItems,
      hasMore,
      nextCursor: hasMore && oldest
        ? { createdAt: oldest.createdAt.toISOString(), id: oldest._id.toString() }
        : null,
    });
  }),
);

chatRouter.post(
  "/:conversationId/messages",
  asyncHandler(async (request, response) => {
    const input = z
      .object({
        text: z.string().max(4000).default(""),
        replyTo: z.string().optional(),
        nonce: z.string().optional(),
        attachments: z
          .array(
            z.object({
              url: z.string().url(),
              name: z.string().optional(),
              publicId: z.string().optional(),
              mimeType: z.string().optional(),
              size: z.number().optional(),
            }),
          )
          .max(10)
          .default([]),
      })
      .refine(
        (value) => value.text.trim() || value.attachments.length,
        "Message cannot be empty",
      )
      .parse(request.body);
    if (process.env.NODE_ENV !== "production") {
      console.info("[CHAT_HTTP_RECEIVED]", {
        clientMessageId: input.nonce,
        conversationId: request.params.conversationId,
      });
    }
    if (!isValidObjectId(request.params.conversationId)) {
      throw new AppError(404, "Conversation not found", "NOT_FOUND");
    }
    const conversation = await Conversation.findOne({
      _id: request.params.conversationId,
      participants: request.user!._id,
    });
    if (!conversation)
      throw new AppError(
        403,
        "You are not a participant in this conversation",
        "FORBIDDEN",
      );
    if (conversation.type === "direct") {
      const peerId = conversation.participants.find((id) => id.toString() !== request.user!._id.toString());
      const stillFriends = peerId && await Friendship.exists({
        users: { $all: [request.user!._id, peerId] },
      });
      if (!stillFriends) {
        throw new AppError(403, "You can only message friends", "FORBIDDEN");
      }
    }
    if (input.replyTo) {
      if (!isValidObjectId(input.replyTo) || !await Message.exists({
        _id: input.replyTo,
        conversation: conversation._id,
      })) {
        throw new AppError(400, "Reply target is not in this conversation", "BAD_REQUEST");
      }
    }
    if (input.nonce) {
      const existing = await Message.findOne({
        conversation: conversation._id,
        sender: request.user!._id,
        nonce: input.nonce,
      }).populate("sender", "name username avatarUrl");
      if (existing) return sendSuccess(response, serializeChatMessage(existing), "Message already sent");
    }
    const message = await Message.create({
      conversation: conversation._id,
      sender: request.user!._id,
      ...input,
      readBy: [{ user: request.user!._id, readAt: new Date() }],
    });
    if (process.env.NODE_ENV !== "production") {
      console.info("[CHAT_DB_SAVED]", {
        messageId: message._id.toString(),
        conversationId: conversation._id.toString(),
      });
    }
    conversation.lastMessageAt = message.createdAt;
    conversation.lastMessage = message._id as any;
    if (!conversation.participantMetadata) {
      (conversation as any).participantMetadata = [];
    }
    conversation.participantMetadata.forEach((meta: any) => {
      meta.hidden = false;
    });
    for (const p of conversation.participants) {
      if (p.toString() !== request.user!._id.toString()) {
        const meta = conversation.participantMetadata.find((m: any) => m.user.toString() === p.toString());
        if (meta) {
          meta.unreadCount = (meta.unreadCount || 0) + 1;
        } else {
          conversation.participantMetadata.push({ user: p, unreadCount: 1, muted: false, pinned: false, archived: false } as any);
        }
      }
    }
    await conversation.save();

    await message.populate("sender", "name username avatarUrl");
    if (message.replyTo) {
      await message.populate({ path: "replyTo", select: "sender text", populate: { path: "sender", select: "name" } });
    }

    const msgPayload = serializeChatMessage(message);
    const io = request.app.get("io");
    if (io) {
      const { Notification } = await import("../models/Social.js");
      for (const p of conversation.participants) {
        const participantId = p.toString();
        io.to(`user:${participantId}`).emit("chat:updated", { conversationId: conversation._id.toString() });
        io.to(`user:${participantId}`).emit("message:new", msgPayload);
        if (process.env.NODE_ENV !== "production") {
          console.info("[CHAT_SOCKET_EMIT]", {
            messageId: message._id.toString(),
            conversationId: conversation._id.toString(),
            receiverUserId: participantId,
          });
        }
        if (participantId !== request.user!._id.toString()) {

          const notification = await Notification.findOneAndUpdate(
            { user: p, type: "message", $or: [{ "target.params.conversationId": conversation._id.toString() }, { "target.params.groupId": conversation._id.toString() }] },
            {
              $set: {
                actor: request.user!._id,
                title: conversation.type === "group" ? conversation.title || "Group Chat" : request.user!.name,
                body: message.text || "Sent an attachment",
                target: { 
                  route: conversation.type === "group" ? "GroupConversation" : "Conversation", 
                  params: conversation.type === "group" 
                    ? { groupId: conversation._id.toString() } 
                    : { conversationId: conversation._id.toString() } 
                }
              },
              $unset: { readAt: "" }
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
          ).populate("actor", "name username avatarUrl");

          io.to(`user:${p.toString()}`).emit("notification:new", notification);

          const participantMeta = conversation.participantMetadata.find(
            (entry: any) => entry.user?.toString() === participantId,
          );
          const participantSockets = await io.in(`user:${participantId}`).fetchSockets();
          const activelyViewing = participantSockets.some(
            (participantSocket: any) => participantSocket.data.activeConversationId === conversation._id.toString(),
          );
          if (!participantMeta?.muted && !activelyViewing) {
            void pushService.sendPushNotification(p, {
              title: notification.title,
              body: notification.body || "New Message",
              data: {
                route: notification.target?.route,
                params: notification.target?.params,
                notificationId: notification._id.toString()
              }
            });
          }
        }
      }
    }
    return sendSuccess(response, msgPayload, "Message sent", 201);
  }),
);

chatRouter.post(
  "/:conversationId/read",
  asyncHandler(async (request, response) => {
    if (!isValidObjectId(request.params.conversationId)) {
      throw new AppError(404, "Conversation not found", "NOT_FOUND");
    }
    const allowed = await Conversation.findOne({
      _id: request.params.conversationId,
      participants: request.user!._id,
    }).select("participants");
    if (!allowed)
      throw new AppError(403, "You are not a participant", "FORBIDDEN");
    await Message.updateMany(
      {
        conversation: request.params.conversationId,
        sender: { $ne: request.user!._id },
        "readBy.user": { $ne: request.user!._id },
      },
      { $push: { readBy: { user: request.user!._id, readAt: new Date() } } },
    );
    await Conversation.updateOne(
      { _id: request.params.conversationId, "participantMetadata.user": request.user!._id },
      {
        $set: {
          "participantMetadata.$.unreadCount": 0,
          "participantMetadata.$.lastReadAt": new Date()
        }
      }
    );
    const { Notification } = await import("../models/Social.js");
    const io = request.app.get("io");
    const notification = await Notification.findOneAndUpdate(
      { user: request.user!._id, type: "message", "target.params.conversationId": request.params.conversationId, readAt: { $exists: false } },
      { $set: { readAt: new Date() } },
      { new: true }
    );
    if (notification && io) {
      io.to(`user:${request.user!._id.toString()}`).emit("notification:read", notification);
    }
    io?.to(`user:${request.user!._id.toString()}`).emit("chat:updated", { conversationId: request.params.conversationId });
    for (const participant of allowed.participants) {
      io?.to(`user:${participant.toString()}`).emit("message:read", {
        conversationId: request.params.conversationId,
        userId: request.user!._id.toString(),
      });
    }
    return sendSuccess(response, null, "Messages marked as read");
  }),
);

chatRouter.post(
  "/:conversationId/delivered",
  asyncHandler(async (request, response) => {
    if (!isValidObjectId(request.params.conversationId)) {
      throw new AppError(404, "Conversation not found", "NOT_FOUND");
    }
    const allowed = await Conversation.findOne({
      _id: request.params.conversationId,
      participants: request.user!._id,
    }).select("participants");
    if (!allowed)
      throw new AppError(403, "You are not a participant", "FORBIDDEN");
    await Message.updateMany(
      {
        conversation: request.params.conversationId,
        sender: { $ne: request.user!._id },
        "deliveredTo.user": { $ne: request.user!._id },
      },
      { $push: { deliveredTo: { user: request.user!._id, deliveredAt: new Date() } } },
    );
    for (const participant of allowed.participants) {
      request.app.get("io")?.to(`user:${participant.toString()}`).emit("message:delivered", {
        conversationId: request.params.conversationId,
        userId: request.user!._id.toString(),
      });
    }
    return sendSuccess(response, null, "Messages marked as delivered");
  }),
);

chatRouter.post(
  "/:conversationId/messages/:messageId/reaction",
  asyncHandler(async (request, response) => {
    if (!isValidObjectId(request.params.conversationId) || !isValidObjectId(request.params.messageId)) {
      throw new AppError(404, "Message or conversation not found", "NOT_FOUND");
    }
    const allowed = await Conversation.findOne({
      _id: request.params.conversationId,
      participants: request.user!._id,
    }).select("participants");
    if (!allowed)
      throw new AppError(403, "You are not a participant", "FORBIDDEN");
    const { emoji } = z.object({ emoji: z.string() }).parse(request.body);
    const message = await Message.findOne({ _id: request.params.messageId, conversation: request.params.conversationId });
    if (!message) throw new AppError(404, "Message not found");

    if (!message.reactions) (message as any).reactions = [];
    const reactionIndex = message.reactions!.findIndex((r: any) => r.user.toString() === request.user!._id.toString());
    if (reactionIndex > -1) {
      if (emoji) {
        (message as any).reactions[reactionIndex].emoji = emoji;
      } else {
        message.reactions!.splice(reactionIndex, 1); // remove reaction
      }
    } else if (emoji) {
      message.reactions!.push({ emoji, user: request.user!._id } as any);
    }

    await message.save();

    const payload = {
      messageId: message._id.toString(),
      conversationId: request.params.conversationId,
      reactions: message.reactions?.map((reaction: any) => ({
        userId: reaction.user.toString(),
        emoji: reaction.emoji,
      })) ?? [],
    };
    for (const participant of allowed.participants) {
      request.app.get("io")?.to(`user:${participant.toString()}`).emit("message:reaction_updated", payload);
    }

    return sendSuccess(response, payload.reactions, "Reaction updated");
  })
);

chatRouter.patch(
  "/:conversationId/messages/:messageId",
  asyncHandler(async (request, response) => {
    if (!isValidObjectId(request.params.conversationId) || !isValidObjectId(request.params.messageId)) {
      throw new AppError(404, "Message or conversation not found", "NOT_FOUND");
    }
    const { text } = z.object({ text: z.string().trim().min(1).max(4000) }).parse(request.body);
    const conversation = await Conversation.findOne({
      _id: request.params.conversationId,
      participants: request.user!._id,
    });
    if (!conversation) throw new AppError(403, "You are not a participant", "FORBIDDEN");
    const message = await Message.findOne({
      _id: request.params.messageId,
      conversation: conversation._id,
      sender: request.user!._id,
      deletedForEveryoneAt: { $exists: false },
    });
    if (!message) throw new AppError(403, "Only the sender can edit this message", "FORBIDDEN");
    if (message.attachments.length) throw new AppError(400, "Image messages cannot be edited", "BAD_REQUEST");

    message.text = text;
    message.editedAt = new Date();
    await message.save();
    await message.populate("sender", "name username avatarUrl");
    const payload = serializeChatMessage(message);
    for (const participant of conversation.participants) {
      request.app.get("io")?.to(`user:${participant.toString()}`).emit("message:edited", payload);
    }
    return sendSuccess(response, payload, "Message edited");
  }),
);

chatRouter.delete(
  "/:conversationId/messages/:messageId",
  asyncHandler(async (request, response) => {
    if (!isValidObjectId(request.params.conversationId) || !isValidObjectId(request.params.messageId)) {
      throw new AppError(404, "Message or conversation not found", "NOT_FOUND");
    }

    const conversation = await Conversation.findOne({
      _id: request.params.conversationId,
      participants: request.user!._id,
    });
    if (!conversation) throw new AppError(403, "You are not a participant", "FORBIDDEN");

    const message = await Message.findOne({
      _id: request.params.messageId,
      conversation: request.params.conversationId,
    });
    if (!message) throw new AppError(404, "Message not found");

    const scope = request.query.scope === "me" ? "me" : "everyone";
    if (scope === "everyone" && message.sender.toString() !== request.user!._id.toString()) {
      throw new AppError(403, "You can only delete your own messages for everyone", "FORBIDDEN");
    }

    if (scope === "me") {
      if (!message.deletedFor?.some((id: any) => id.toString() === request.user!._id.toString())) {
        message.deletedFor = [...(message.deletedFor ?? []), request.user!._id] as any;
      }
    } else {
      message.deletedForEveryoneAt = new Date();
      message.text = "";
      message.attachments = [] as any;
    }
    await message.save();

    if (scope === "everyone") {
      for (const participant of conversation.participants) {
        request.app.get("io")?.to(`user:${participant.toString()}`).emit("message:deleted", {
          messageId: message._id.toString(),
          conversationId: message.conversation.toString(),
          deletedForEveryoneAt: message.deletedForEveryoneAt?.toISOString(),
        });
      }
    }

    return sendSuccess(response, null, scope === "me" ? "Message hidden" : "Message deleted for everyone");
  })
);

chatRouter.patch(
  "/:conversationId/preferences",
  asyncHandler(async (request, response) => {
    if (!isValidObjectId(request.params.conversationId)) {
      throw new AppError(404, "Conversation not found", "NOT_FOUND");
    }
    const preferences = z.object({
      pinned: z.boolean().optional(),
      muted: z.boolean().optional(),
      archived: z.boolean().optional(),
    }).refine((value) => Object.keys(value).length > 0, "No preference supplied").parse(request.body);

    const conversation = await Conversation.findOne({
      _id: request.params.conversationId,
      participants: request.user!._id,
    });
    if (!conversation) throw new AppError(404, "Conversation not found", "NOT_FOUND");

    let metadata = conversation.participantMetadata.find(
      (entry: any) => entry.user?.toString() === request.user!._id.toString(),
    );
    if (!metadata) {
      conversation.participantMetadata.push({ user: request.user!._id } as any);
      metadata = conversation.participantMetadata[conversation.participantMetadata.length - 1];
    }
    Object.assign(metadata!, preferences);
    await conversation.save();

    request.app.get("io")?.to(`user:${request.user!._id.toString()}`).emit("chat:updated", {
      conversationId: conversation._id.toString(),
    });
    return sendSuccess(response, preferences, "Chat preferences updated");
  }),
);

chatRouter.delete(
  "/:conversationId",
  asyncHandler(async (request, response) => {
    if (!isValidObjectId(request.params.conversationId)) {
      throw new AppError(404, "Conversation not found", "NOT_FOUND");
    }

    const conversation = await Conversation.findOne({
      _id: request.params.conversationId,
      participants: request.user!._id,
    });
    
    if (!conversation) {
      throw new AppError(404, "Conversation not found", "NOT_FOUND");
    }

    const meta = conversation.participantMetadata.find(
      (m: any) => m.user.toString() === request.user!._id.toString()
    );

    if (meta) {
      meta.hidden = true;
      meta.clearedAt = new Date();
      await conversation.save();
    }

    request.app.get("io")?.to(`user:${request.user!._id.toString()}`).emit("conversation:deleted", {
      conversationId: conversation._id,
    });

    return sendSuccess(response, null, "Chat deleted successfully");
  })
);
