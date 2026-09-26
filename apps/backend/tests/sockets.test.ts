import { describe, expect, it, beforeAll, afterAll, beforeEach } from "vitest";
import { createServer } from "http";
import { io as Client, Socket as ClientSocket } from "socket.io-client";
import mongoose from "mongoose";
import { randomBytes } from "crypto";

import { User } from "../src/models/User.js";
import { Conversation } from "../src/models/Chat.js";
import { Friendship } from "../src/models/Social.js";
import { Group, GroupMembership } from "../src/models/Group.js";
import { Trip, TripMember } from "../src/models/Trip.js";
import { createAccessToken } from "../src/services/tokenService.js";
import { createSocketServer } from "../src/sockets/index.js";
import { connectToTestDatabase } from "./testDatabase.js";

describe("Sockets API Hardening", () => {
  let io: any;
  let httpServer: any;
  let port: number;
  let userAId: string, userBId: string, userCId: string;
  let userAToken: string, userBToken: string, userCToken: string;
  let persistedConversationId: string;
  let friendConversationId: string;
  let testGroupId: string;
  let testTripId: string;

  let clientA: ClientSocket;
  let clientB: ClientSocket;
  let clientC: ClientSocket;

  beforeAll(async () => {
    await connectToTestDatabase();

    const suffix = randomBytes(4).toString("hex");

    // Create User A
    const userA = await User.create({
      email: `sock-a-${suffix}@test.com`,
      username: `sock-a-${suffix}`,
      name: "Sock A",
      passwordHash: "dummy",
      college: "Test",
      department: "Test",
      academicYear: "1"
    });
    userAId = userA._id.toString();
    userAToken = createAccessToken(userAId);

    // Create User B (Friend of A)
    const userB = await User.create({
      email: `sock-b-${suffix}@test.com`,
      username: `sock-b-${suffix}`,
      name: "Sock B",
      passwordHash: "dummy",
      college: "Test",
      department: "Test",
      academicYear: "1"
    });
    userBId = userB._id.toString();
    userBToken = createAccessToken(userBId);

    // Create User C (Not friend of A)
    const userC = await User.create({
      email: `sock-c-${suffix}@test.com`,
      username: `sock-c-${suffix}`,
      name: "Sock C",
      passwordHash: "dummy",
      college: "Test",
      department: "Test",
      academicYear: "1"
    });
    userCId = userC._id.toString();
    userCToken = createAccessToken(userCId);

    await Friendship.create({
      users: [userAId, userBId],
      createdBy: userAId,
      status: "accepted"
    });

    // Create a persisted conversation between A and C
    const conv = await Conversation.create({
      type: "direct",
      participants: [userAId, userCId],
      createdBy: userAId
    });
    persistedConversationId = conv._id.toString();
    const friendConv = await Conversation.create({ type: "direct", participants: [userAId, userBId], createdBy: userAId });
    friendConversationId = friendConv._id.toString();

    // Setup a Group for group socket tests
    const grp = await Group.create({
      name: "Socket Group",
      privacy: "public",
      owner: userAId,
      memberCount: 1
    });
    testGroupId = grp._id.toString();

    await GroupMembership.create({
      group: testGroupId,
      user: userAId,
      role: "owner",
      status: "active"
    });

    await GroupMembership.create({
      group: testGroupId,
      user: userBId,
      role: "member",
      status: "requested"
    });

    const trip = await Trip.create({
      title: "Socket Trip",
      destination: "Campus",
      startDate: new Date(Date.now() + 86400000),
      createdBy: userAId,
    });
    testTripId = trip._id.toString();
    await TripMember.create({ trip: testTripId, user: userAId, role: "organizer", status: "accepted" });
    await TripMember.create({ trip: testTripId, user: userBId, role: "member", status: "invited" });

    // Setup Socket Server
    httpServer = createServer();
    io = createSocketServer(httpServer);
    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    port = (httpServer.address() as any).port;
  }, 30000);

  afterAll(async () => {
    if (clientA) clientA.disconnect();
    if (clientB) clientB.disconnect();
    if (clientC) clientC.disconnect();
    io.close();
    httpServer.close();

    await Friendship.deleteMany({ users: { $in: [userAId, userBId, userCId] } });
    await Conversation.deleteMany({ _id: { $in: [persistedConversationId, friendConversationId] } });
    await Group.deleteMany({ _id: testGroupId });
    await GroupMembership.deleteMany({ group: testGroupId });
    await TripMember.deleteMany({ trip: testTripId });
    await Trip.deleteOne({ _id: testTripId });
    await User.deleteMany({ _id: { $in: [userAId, userBId, userCId] } });
    await mongoose.disconnect();
  });

  const connectClient = (token: string): Promise<ClientSocket> => {
    return new Promise((resolve) => {
      const client = Client(`http://localhost:${port}`, { auth: { token } });
      client.on("connect", () => resolve(client));
    });
  };

  const getServerSocketRooms = async (userId: string) => {
    const sockets = await io.fetchSockets();
    const sock = sockets.find((s: any) => s.data.userId === userId);
    return sock ? Array.from(sock.rooms) : [];
  };

  const getCanonicalRoom = (u1: string, u2: string) => {
    const sorted = [u1, u2].sort();
    return `conversation:virtual-${sorted[0]}-${sorted[1]}`;
  };

  beforeEach(async () => {
    if (!clientA) clientA = await connectClient(userAToken);
    if (!clientB) clientB = await connectClient(userBToken);
    if (!clientC) clientC = await connectClient(userCToken);
  });

  it("valid persisted participant can join", async () => {
    clientA.emit("conversation:join", persistedConversationId);
    await new Promise(r => setTimeout(r, 1500));

    const rooms = await getServerSocketRooms(userAId);
    expect(rooms).toContain(`conversation:${persistedConversationId}`);
  });

  it("non-participant cannot join", async () => {
    clientB.emit("conversation:join", persistedConversationId);
    await new Promise(r => setTimeout(r, 1500));

    const rooms = await getServerSocketRooms(userBId);
    expect(rooms).not.toContain(`conversation:${persistedConversationId}`);
  });

  it("valid friend virtual P2P room succeeds", async () => {
    clientA.emit("conversation:join", `conversation-${userBId}`);
    await new Promise(r => setTimeout(r, 1500));

    const canonical = getCanonicalRoom(userAId, userBId);
    const rooms = await getServerSocketRooms(userAId);
    expect(rooms).toContain(canonical);
  });

  it("A->B and B->A resolve to same canonical room", async () => {
    clientA.emit("conversation:join", `conversation-${userBId}`);
    clientB.emit("conversation:join", `conversation-${userAId}`);
    await new Promise(r => setTimeout(r, 1500));

    const roomsA = await getServerSocketRooms(userAId);
    const roomsB = await getServerSocketRooms(userBId);

    const canonical = getCanonicalRoom(userAId, userBId);
    expect(roomsA).toContain(canonical);
    expect(roomsB).toContain(canonical);
  });

  it("non-friend denied", async () => {
    clientA.emit("conversation:join", `conversation-${userCId}`);
    await new Promise(r => setTimeout(r, 1500));

    const canonical = getCanonicalRoom(userAId, userCId);
    const rooms = await getServerSocketRooms(userAId);
    expect(rooms).not.toContain(canonical);
  });

  it("self-room denied", async () => {
    clientA.emit("conversation:join", `conversation-${userAId}`);
    await new Promise(r => setTimeout(r, 1500));

    const canonical = getCanonicalRoom(userAId, userAId);
    const rooms = await getServerSocketRooms(userAId);
    expect(rooms).not.toContain(canonical);
  });

  it("malformed virtual ID denied", async () => {
    clientA.emit("conversation:join", "conversation-something-invalid");
    await new Promise(r => setTimeout(r, 1500));

    const rooms = await getServerSocketRooms(userAId);
    expect(rooms).not.toContain("conversation:conversation-something-invalid");
    expect(clientA.connected).toBe(true);
  });

  it("invalid ObjectId does not crash backend", async () => {
    clientA.emit("conversation:join", "just-random-string");
    await new Promise(r => setTimeout(r, 1500));

    expect(clientA.connected).toBe(true);
    const rooms = await getServerSocketRooms(userAId);
    expect(rooms).not.toContain("conversation:just-random-string");
  });

  it("active member can join group room", async () => {
    clientA.emit("group:join", { groupId: testGroupId });
    await new Promise(r => setTimeout(r, 1500));
    const rooms = await getServerSocketRooms(userAId);
    expect(rooms).toContain(`group:${testGroupId}`);
  });

  it("non-member cannot join group room", async () => {
    clientC.emit("group:join", { groupId: testGroupId });
    await new Promise(r => setTimeout(r, 1500));
    const rooms = await getServerSocketRooms(userCId);
    expect(rooms).not.toContain(`group:${testGroupId}`);
  });

  it("requested member cannot join group room", async () => {
    clientB.emit("group:join", { groupId: testGroupId });
    await new Promise(r => setTimeout(r, 1500));
    const rooms = await getServerSocketRooms(userBId);
    expect(rooms).not.toContain(`group:${testGroupId}`);
  });

  it("only trip participants can join and leave the trip room", async () => {
    clientA.emit("join:trip", { tripId: testTripId });
    clientB.emit("join:trip", { tripId: testTripId });
    clientC.emit("join:trip", { tripId: testTripId });
    await new Promise((resolve) => setTimeout(resolve, 1500));
    expect(await getServerSocketRooms(userAId)).toContain(`trip:${testTripId}`);
    expect(await getServerSocketRooms(userBId)).toContain(`trip:${testTripId}`);
    expect(await getServerSocketRooms(userCId)).not.toContain(`trip:${testTripId}`);

    clientB.emit("leave:trip", { tripId: testTripId });
    await new Promise((resolve) => setTimeout(resolve, 1500));
    expect(await getServerSocketRooms(userBId)).not.toContain(`trip:${testTripId}`);
  });
  it("rejects an audio call when the direct-chat participants are no longer friends", async () => {
    const result = await new Promise<{ ok: boolean; reason?: string }>((resolve) => {
      clientA.emit("call:start", { conversationId: persistedConversationId, peerId: userCId }, resolve);
    });
    expect(result).toEqual({ ok: false, reason: "forbidden" });
  });

  it("signals a friend-only audio call and ends it for both participants", async () => {
    const incoming = new Promise<any>((resolve) => clientB.once("call:incoming", resolve));
    const started = await new Promise<{ ok: boolean; callId?: string }>((resolve) => {
      clientA.emit("call:start", { conversationId: friendConversationId, peerId: userBId }, resolve);
    });
    expect(started.ok).toBe(true);
    expect(started.callId).toBeTruthy();
    expect((await incoming).callId).toBe(started.callId);

    const accepted = new Promise<any>((resolve) => clientA.once("call:accepted", resolve));
    const response = await new Promise<{ ok: boolean }>((resolve) => clientB.emit("call:accept", { callId: started.callId }, resolve));
    expect(response.ok).toBe(true);
    expect((await accepted).callId).toBe(started.callId);

    const offer = new Promise<any>((resolve) => clientB.once("call:signal", resolve));
    clientA.emit("call:signal", { callId: started.callId, kind: "offer", data: { type: "offer", sdp: "test" } });
    expect(await offer).toMatchObject({ callId: started.callId, kind: "offer" });

    const callerEnded = new Promise<any>((resolve) => clientA.once("call:ended", resolve));
    const calleeEnded = new Promise<any>((resolve) => clientB.once("call:ended", resolve));
    clientB.emit("call:end", { callId: started.callId });
    expect((await callerEnded).reason).toBe("ended");
    expect((await calleeEnded).reason).toBe("ended");
  });

});
