import { describe, expect, it, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import { randomBytes } from "node:crypto";
import request from "supertest";

import { createApp } from "../src/app.js";
import { Friendship, FriendRequest } from "../src/models/Social.js";
import { LocationSharing } from "../src/models/System.js";
import { User } from "../src/models/User.js";
import { createAccessToken } from "../src/services/tokenService.js";
import { connectToTestDatabase } from "./testDatabase.js";

const app = createApp();

describe("Location Sharing API", () => {
  let userA: any, userB: any, userC: any;
  let tokenA: string, tokenB: string, tokenC: string;

  beforeAll(async () => {
    await connectToTestDatabase();
    const suffix = randomBytes(4).toString("hex");
    const baseUser = { academicYear: "1", department: "CS", college: "Demo College", passwordHash: "hash" };
    userA = await User.create({ name: "User A", email: `a-${suffix}@x.com`, username: `usera-${suffix}`, ...baseUser });
    userB = await User.create({ name: "User B", email: `b-${suffix}@x.com`, username: `userb-${suffix}`, ...baseUser });
    userC = await User.create({ name: "User C", email: `c-${suffix}@x.com`, username: `userc-${suffix}`, ...baseUser });

    tokenA = createAccessToken(userA._id.toString());
    tokenB = createAccessToken(userB._id.toString());
    tokenC = createAccessToken(userC._id.toString());

    // A and B are accepted friends
    const sortedAB = [userA._id.toString(), userB._id.toString()].sort();
    await Friendship.create({ users: sortedAB, createdBy: userA._id });

    // A shares location
    await LocationSharing.create({
      user: userA._id,
      enabled: true,
      point: { type: "Point", coordinates: [77.1, 12.1] },
      positionUpdatedAt: new Date(),
    });
  }, 30_000);

  it("denies unauthenticated access to /location/friends", async () => {
    const res = await request(app).get("/api/location/friends");
    expect(res.status).toBe(401);
  });

  it("allows accepted friends to see location", async () => {
    const res = await request(app)
      .get("/api/location/friends")
      .set("Authorization", `Bearer ${tokenB}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].user.id.toString()).toBe(userA._id.toString());
    expect(res.body.data[0].longitude).toBe(77.1);
  });

  it("blocks non-friends from seeing location", async () => {
    const res = await request(app)
      .get("/api/location/friends")
      .set("Authorization", `Bearer ${tokenC}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(0);
  });

  it("blocks pending friendships from seeing location", async () => {
    // C sends request to A
    await FriendRequest.create({ requester: userC._id, recipient: userA._id, status: "pending" });

    const resC = await request(app)
      .get("/api/location/friends")
      .set("Authorization", `Bearer ${tokenC}`);
    expect(resC.body.data.length).toBe(0); // Outgoing

    const resA = await request(app)
      .get("/api/location/friends")
      .set("Authorization", `Bearer ${tokenA}`);
    // A shouldn't see C either
    expect(resA.body.data.length).toBe(0); // Incoming
  });

  it("does not show location when sharing is disabled", async () => {
    await LocationSharing.updateOne({ user: userA._id }, { enabled: false });
    const res = await request(app)
      .get("/api/location/friends")
      .set("Authorization", `Bearer ${tokenB}`);
    expect(res.body.data.length).toBe(0);

    // Turn back on
    await LocationSharing.updateOne({ user: userA._id }, { enabled: true });
  });

  it("unfriending revokes access immediately", async () => {
    // Unfriend A and B
    await Friendship.deleteMany({ users: { $all: [userA._id, userB._id] } });
    const res = await request(app)
      .get("/api/location/friends")
      .set("Authorization", `Bearer ${tokenB}`);
    expect(res.body.data.length).toBe(0);
  });

  it("includes locations updated within 10 minutes", async () => {
    // Re-friend A and B
    const sortedAB = [userA._id.toString(), userB._id.toString()].sort();
    await Friendship.create({ users: sortedAB, createdBy: userA._id });

    // 5 minutes ago -> should return
    await LocationSharing.updateOne(
      { user: userA._id },
      { $set: { positionUpdatedAt: new Date(Date.now() - 5 * 60 * 1000) } },
      { timestamps: false }
    );
    let res = await request(app).get("/api/location/friends").set("Authorization", `Bearer ${tokenB}`);
    expect(res.body.data.length).toBe(1);

    // 9m59s ago -> should return
    await LocationSharing.updateOne(
      { user: userA._id },
      { $set: { positionUpdatedAt: new Date(Date.now() - (10 * 60 * 1000) + 1000) } },
      { timestamps: false }
    );
    res = await request(app).get("/api/location/friends").set("Authorization", `Bearer ${tokenB}`);
    expect(res.body.data.length).toBe(1);
  });

  it("excludes stale locations (> 10 minutes)", async () => {
    // 10m01s ago -> should exclude
    await LocationSharing.updateOne(
      { user: userA._id },
      { $set: { positionUpdatedAt: new Date(Date.now() - (10 * 60 * 1000) - 1000) } },
      { timestamps: false }
    );

    const res = await request(app)
      .get("/api/location/friends")
      .set("Authorization", `Bearer ${tokenB}`);
    expect(res.body.data.length).toBe(0); // Stale

    // Restore freshness
    await LocationSharing.updateOne(
      { user: userA._id },
      { $set: { positionUpdatedAt: new Date() } },
      { timestamps: false }
    );
  });

  it("rejects invalid coordinate writes", async () => {
    const res = await request(app)
      .post("/api/location/position")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ latitude: 100, longitude: 0 }); // > 90
    expect(res.status).toBe(422);
  });

  it("updates own coordinates securely", async () => {
    const res = await request(app)
      .post("/api/location/position")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ latitude: 12.5, longitude: 77.5 });
    expect(res.status).toBe(200);

    const doc = await LocationSharing.findOne({ user: userA._id });
    expect(doc?.point?.coordinates[0]).toBe(77.5); // lon
    expect(doc?.point?.coordinates[1]).toBe(12.5); // lat
  });

  it("does not revive an old position when sharing is toggled off and on", async () => {
    await request(app).patch("/api/location/settings")
      .set("Authorization", `Bearer ${tokenA}`).send({ enabled: false }).expect(200);
    await request(app).patch("/api/location/settings")
      .set("Authorization", `Bearer ${tokenA}`).send({ enabled: true }).expect(200);
    const res = await request(app).get("/api/location/friends")
      .set("Authorization", `Bearer ${tokenB}`).expect(200);
    expect(res.body.data).toEqual([]);
  });

  afterAll(async () => {
    const userIds = [userA, userB, userC]
      .filter(Boolean)
      .map((user) => user._id);
    if (userIds.length > 0 && mongoose.connection.readyState === 1) {
      await Friendship.deleteMany({ users: { $in: userIds } });
      await LocationSharing.deleteMany({ user: { $in: userIds } });
      await FriendRequest.deleteMany({
        $or: [
          { requester: { $in: userIds } },
          { recipient: { $in: userIds } },
        ],
      });
      await User.deleteMany({ _id: { $in: userIds } });
    }
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });
});
