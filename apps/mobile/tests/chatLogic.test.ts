import { describe, expect, it } from "vitest";

import { getChatDateLabel, mergeChatMessages } from "../src/services/chatLogic";

describe("Chat V2 message logic", () => {
  it("merges a canonical socket/HTTP message into its optimistic client message", () => {
    const result = mergeChatMessages(
      [{ _id: "temp-1", clientMessageId: "client-1", text: "pending", createdAt: "2026-10-04T04:00:00.000Z" }],
      [{ _id: "server-1", clientMessageId: "client-1", text: "saved", createdAt: "2026-10-04T04:00:01.000Z" }],
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ _id: "server-1", clientMessageId: "client-1", text: "saved" });
  });

  it("labels today and yesterday without creating a separator per message", () => {
    const now = new Date("2026-10-04T12:00:00.000Z");
    expect(getChatDateLabel("2026-10-04T04:00:00.000Z", now)).toBe("Today");
    expect(getChatDateLabel("2026-10-03T04:00:00.000Z", now)).toBe("Yesterday");
  });
});
