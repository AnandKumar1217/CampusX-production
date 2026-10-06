/**
 * Push Notification Service Tests
 *
 * Tests the pushService without touching production MongoDB.
 * Uses vi.hoisted + vi.mock to intercept the Expo Push API and Mongoose models.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Types } from "mongoose";

// ── vi.hoisted ensures these are available before module mock factories run ──
const { mockFind, mockUpdateOne, mockFindOneAndUpdate } = vi.hoisted(() => ({
  mockFind: vi.fn(),
  mockUpdateOne: vi.fn(),
  mockFindOneAndUpdate: vi.fn(),
}));

// ── Mock the PushDevice Mongoose model ──────────────────────────────────────
vi.mock("../src/models/PushDevice.js", () => ({
  PushDevice: {
    find: mockFind,
    updateOne: mockUpdateOne,
    findOneAndUpdate: mockFindOneAndUpdate,
  },
}));

// ── Mock fetch (Expo Push API) ───────────────────────────────────────────────
const mockFetch = vi.fn();
global.fetch = mockFetch as any;

// ── Import SUT after mocks ───────────────────────────────────────────────────
import { pushService } from "../src/services/pushService.js";

// ── Helpers ─────────────────────────────────────────────────────────────────
function makeDevice(userId: Types.ObjectId, token: string) {
  return { user: userId, expoPushToken: token, active: true };
}

function makeExpoResponse(tickets: { status: "ok" | "error"; error?: string }[]) {
  return {
    ok: true,
    json: async () => ({
      data: tickets.map((t) =>
        t.status === "ok"
          ? { status: "ok", id: "ticket-" + Math.random() }
          : {
              status: "error",
              message: "Error",
              details: { error: t.error ?? "DeviceNotRegistered" },
            }
      ),
    }),
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("pushService.sendPushNotification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFind.mockReturnValue({ lean: vi.fn().mockResolvedValue([]) });
    mockUpdateOne.mockResolvedValue({});
    mockFetch.mockResolvedValue(makeExpoResponse([{ status: "ok" }]));
  });

  it("does nothing when userIds array is empty", async () => {
    await pushService.sendPushNotification([], { title: "Test", body: "Body" });
    expect(mockFind).not.toHaveBeenCalled();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("does nothing when no active devices found", async () => {
    mockFind.mockReturnValue({ lean: vi.fn().mockResolvedValue([]) });
    const userId = new Types.ObjectId();
    await pushService.sendPushNotification(userId, { title: "Test", body: "Body" });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("sends one Expo message per token — NOT batched into a single 'to' array", async () => {
    const uid = new Types.ObjectId();
    const devices = [
      makeDevice(uid, "ExponentPushToken[aaaa]"),
      makeDevice(uid, "ExponentPushToken[bbbb]"),
    ];
    mockFind.mockReturnValue({ lean: vi.fn().mockResolvedValue(devices) });
    mockFetch.mockResolvedValue(makeExpoResponse([{ status: "ok" }, { status: "ok" }]));

    await pushService.sendPushNotification(uid, { title: "Hi", body: "There" });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);

    // Must be an array with one message object per token
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(2);
    expect(body[0].to).toBe("ExponentPushToken[aaaa]");
    expect(body[1].to).toBe("ExponentPushToken[bbbb]");
    // Each 'to' must be a plain string, not an array
    expect(typeof body[0].to).toBe("string");
    expect(typeof body[1].to).toBe("string");
  });

  it("deactivates ONLY the DeviceNotRegistered token, not the healthy ones", async () => {
    const uid = new Types.ObjectId();
    const devices = [
      makeDevice(uid, "ExponentPushToken[good1]"),
      makeDevice(uid, "ExponentPushToken[dead1]"), // dead
      makeDevice(uid, "ExponentPushToken[good2]"),
    ];
    mockFind.mockReturnValue({ lean: vi.fn().mockResolvedValue(devices) });
    mockFetch.mockResolvedValue(
      makeExpoResponse([
        { status: "ok" },
        { status: "error", error: "DeviceNotRegistered" },
        { status: "ok" },
      ])
    );

    await pushService.sendPushNotification(uid, { title: "Hi", body: "Test" });

    // Exactly one deactivation for the dead token
    expect(mockUpdateOne).toHaveBeenCalledTimes(1);
    expect(mockUpdateOne).toHaveBeenCalledWith(
      { expoPushToken: "ExponentPushToken[dead1]" },
      { $set: { active: false } }
    );
  });

  it("sends to multiple users by finding all their active devices", async () => {
    const uid1 = new Types.ObjectId();
    const uid2 = new Types.ObjectId();
    mockFind.mockReturnValue({
      lean: vi.fn().mockResolvedValue([
        makeDevice(uid1, "ExponentPushToken[user1]"),
        makeDevice(uid2, "ExponentPushToken[user2]"),
      ]),
    });
    mockFetch.mockResolvedValue(makeExpoResponse([{ status: "ok" }, { status: "ok" }]));

    await pushService.sendPushNotification([uid1, uid2], { title: "Multi", body: "msg" });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body).toHaveLength(2);
  });

  it("logs error on non-2xx HTTP response and does not throw", async () => {
    const uid = new Types.ObjectId();
    mockFind.mockReturnValue({
      lean: vi.fn().mockResolvedValue([makeDevice(uid, "ExponentPushToken[tok1]")]),
    });
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "Internal Server Error",
    });
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      pushService.sendPushNotification(uid, { title: "T", body: "B" })
    ).resolves.not.toThrow();

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("HTTP error 500")
    );
    consoleSpy.mockRestore();
  });

  it("does NOT deactivate tokens on InvalidCredentials — logs credential error instead", async () => {
    const uid = new Types.ObjectId();
    mockFind.mockReturnValue({
      lean: vi.fn().mockResolvedValue([makeDevice(uid, "ExponentPushToken[tok2]")]),
    });
    mockFetch.mockResolvedValue(
      makeExpoResponse([{ status: "error", error: "InvalidCredentials" }])
    );
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await pushService.sendPushNotification(uid, { title: "T", body: "B" });

    // Must NOT deactivate — this is a server credential issue, not a device issue
    expect(mockUpdateOne).not.toHaveBeenCalled();
    // Must log a clear FCM credential error
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("CREDENTIAL ERROR")
    );

    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it("includes message title/body/data in each individual token's push payload", async () => {
    const uid = new Types.ObjectId();
    mockFind.mockReturnValue({
      lean: vi.fn().mockResolvedValue([makeDevice(uid, "ExponentPushToken[nav1]")]),
    });
    mockFetch.mockResolvedValue(makeExpoResponse([{ status: "ok" }]));

    await pushService.sendPushNotification(uid, {
      title: "New message",
      body: "You have a message",
      data: { route: "Conversation", params: { conversationId: "abc123" } },
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body[0]).toMatchObject({
      to: "ExponentPushToken[nav1]",
      title: "New message",
      body: "You have a message",
      data: { route: "Conversation", params: { conversationId: "abc123" } },
    });
  });
});
