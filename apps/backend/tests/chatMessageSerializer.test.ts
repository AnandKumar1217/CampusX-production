import { describe, expect, it } from "vitest";

import { serializeChatMessage } from "../src/serializers/chatMessage.js";

describe("serializeChatMessage", () => {
  it("produces a deterministic plain realtime payload", () => {
    const createdAt = new Date("2026-10-04T04:00:00.000Z");
    const payload = serializeChatMessage({
      _id: "message-1",
      conversation: { _id: "conversation-1" },
      sender: { _id: "user-1", name: "Sender" },
      nonce: "client-1",
      text: "hello",
      reactions: [{ user: "user-2", emoji: "❤️" }],
      deliveredTo: [],
      readBy: [{ user: "user-1", readAt: createdAt }],
      createdAt,
      updatedAt: createdAt,
    });

    expect(payload).toMatchObject({
      _id: "message-1",
      conversationId: "conversation-1",
      senderId: "user-1",
      clientMessageId: "client-1",
      type: "text",
      text: "hello",
      reactions: [{ userId: "user-2", emoji: "❤️" }],
      deletedFor: [],
      createdAt: "2026-10-04T04:00:00.000Z",
    });
    expect(JSON.parse(JSON.stringify(payload))).toEqual(payload);
  });
});
