import { Router } from "express";
import { isValidObjectId } from "mongoose";
import { z } from "zod";

import { Conversation, Message } from "../models/Chat.js";
import { AppError, asyncHandler, sendSuccess } from "../utils/http.js";
import { pagination } from "../utils/pagination.js";

export const chatRouter = Router();

chatRouter.get(
  "/",
  asyncHandler(async (request, response) => {
    const conversations = await Conversation.find({
      participants: request.user!._id,
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
    const allowed = await Conversation.exists({
      _id: request.params.conversationId,
      participants: request.user!._id,
    });
    if (!allowed)
      throw new AppError(
        403,
        "You are not a participant in this conversation",
        "FORBIDDEN",
      );
    const { page, limit, skip } = pagination(request.query, 100);
    const items = await Message.find({
      conversation: request.params.conversationId,
      deletedAt: { $exists: false },
    })
      .populate("sender", "name username avatarUrl")
      .populate({ path: "replyTo", select: "sender text", populate: { path: "sender", select: "name" } })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    return sendSuccess(response, { items: items.reverse(), page, limit });
  }),
);

chatRouter.post(
  "/:conversationId/messages",
  asyncHandler(async (request, response) => {
    const input = z
      .object({
        text: z.string().max(4000).default(""),
        replyTo: z.string().optional(),
        attachments: z
          .array(
            z.object({
              url: z.url(),
              name: z.string(),
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
    const message = await Message.create({
      conversation: conversation._id,
      sender: request.user!._id,
      ...input,
      readBy: [{ user: request.user!._id, readAt: new Date() }],
    });
    conversation.lastMessageAt = new Date();
    conversation.lastMessage = message._id as any;
    if (!conversation.participantMetadata) conversation.participantMetadata = [];
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

    request.app
      .get("io")
      ?.to(`conversation:${conversation._id.toString()}`)
      .emit("message:new", message);
    return sendSuccess(response, message, "Message sent", 201);
  }),
);

chatRouter.post(
  "/:conversationId/read",
  asyncHandler(async (request, response) => {
    if (!isValidObjectId(request.params.conversationId)) {
      throw new AppError(404, "Conversation not found", "NOT_FOUND");
    }
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
    request.app
      .get("io")
      ?.to(`conversation:${request.params.conversationId}`)
      .emit("message:read", {
        conversationId: request.params.conversationId,
        userId: request.user!._id.toString(),
      });
    return sendSuccess(response, null, "Messages marked as read");
  }),
);

chatRouter.post(
  "/:conversationId/delivered",
  asyncHandler(async (request, response) => {
    if (!isValidObjectId(request.params.conversationId)) {
      throw new AppError(404, "Conversation not found", "NOT_FOUND");
    }
    await Message.updateMany(
      {
        conversation: request.params.conversationId,
        sender: { $ne: request.user!._id },
        "deliveredTo.user": { $ne: request.user!._id },
      },
      { $push: { deliveredTo: { user: request.user!._id, deliveredAt: new Date() } } },
    );
    request.app
      .get("io")
      ?.to(`conversation:${request.params.conversationId}`)
      .emit("message:delivered", {
        conversationId: request.params.conversationId,
        userId: request.user!._id.toString(),
      });
    return sendSuccess(response, null, "Messages marked as delivered");
  }),
);

chatRouter.post(
  "/:conversationId/messages/:messageId/reaction",
  asyncHandler(async (request, response) => {
    if (!isValidObjectId(request.params.conversationId) || !isValidObjectId(request.params.messageId)) {
      throw new AppError(404, "Message or conversation not found", "NOT_FOUND");
    }
    const { emoji } = z.object({ emoji: z.string() }).parse(request.body);
    const message = await Message.findOne({ _id: request.params.messageId, conversation: request.params.conversationId });
    if (!message) throw new AppError(404, "Message not found");
    
    const reactionIndex = message.reactions.findIndex((r: any) => r.user.toString() === request.user!._id.toString());
    if (reactionIndex > -1) {
      if (emoji) {
        message.reactions[reactionIndex].emoji = emoji;
      } else {
        message.reactions.splice(reactionIndex, 1); // remove reaction
      }
    } else if (emoji) {
      message.reactions.push({ emoji, user: request.user!._id } as any);
    }
    
    await message.save();
    
    request.app.get("io")?.to(`conversation:${request.params.conversationId}`).emit("message:reaction", {
      messageId: message._id,
      reactions: message.reactions
    });
    
    return sendSuccess(response, message.reactions, "Reaction updated");
  })
);
