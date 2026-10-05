import request from "supertest";
import { describe, expect, it, beforeAll, afterAll, vi } from "vitest";
import mongoose from "mongoose";

import { createApp } from "../src/app.js";
import { User } from "../src/models/User.js";
import { Event } from "../src/models/Commerce.js";
import { createAccessToken } from "../src/services/tokenService.js";
import { randomBytes } from "crypto";
import { connectToTestDatabase } from "./testDatabase.js";

// Mock cloudinary to prevent actual uploads/deletes during tests
vi.mock("../src/services/cloudinary.js", () => ({
  cloudinaryService: {
    deleteImage: vi.fn().mockResolvedValue(true)
  }
}));

describe("Events API Integration", () => {
  let app: ReturnType<typeof createApp>;
  let userAId: string;
  let userBId: string;
  let userAToken: string;
  let userBToken: string;
  const createdEventIds: string[] = [];

  beforeAll(async () => {
    app = createApp();
    await connectToTestDatabase();

    const uniqueSuffix = randomBytes(4).toString("hex");

    const userA = await User.create({
      email: `usera-${uniqueSuffix}@example.com`,
      username: `usera-${uniqueSuffix}`,
      name: "Test User A",
      passwordHash: "dummy",
      college: "Test College",
      department: "Computer Science",
      academicYear: "1"
    });
    userAId = userA._id.toString();
    userAToken = createAccessToken(userAId);

    const userB = await User.create({
      email: `userb-${uniqueSuffix}@example.com`,
      username: `userb-${uniqueSuffix}`,
      name: "Test User B",
      passwordHash: "dummy",
      college: "Test College",
      department: "Information Technology",
      academicYear: "2"
    });
    userBId = userB._id.toString();
    userBToken = createAccessToken(userBId);
  }, 30000);

  afterAll(async () => {
    await Event.deleteMany({ _id: { $in: createdEventIds } });
    await User.deleteMany({ _id: { $in: [userAId, userBId] } });
    await mongoose.connection.close();
  }, 30000);

  const trackEvent = (id: string) => createdEventIds.push(id);

  it("should create an event with authenticated user as creator", async () => {
    const res = await request(app)
      .post("/api/events")
      .set("Authorization", `Bearer ${userAToken}`)
      .send({
        title: "Test Event",
        description: "A valid description",
        category: "TestCategory",
        startsAt: new Date().toISOString(),
        endsAt: new Date(Date.now() + 86400000).toISOString(),
        location: { name: "Test Location" }
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.creator.toString()).toBe(userAId);

    const dbEvent = await Event.findById(res.body.data._id);
    expect(dbEvent).toBeTruthy();
    expect(dbEvent!.creator.toString()).toBe(userAId);
    trackEvent(dbEvent!._id.toString());
  });

  it("should list events and get single event", async () => {
    const event = await Event.create({
      title: "List Event",
      startsAt: new Date(Date.now() + 86400000), // future
      creator: userAId,
      location: { name: "Loc" }
    });
    trackEvent(event._id.toString());

    const resList = await request(app)
      .get("/api/events")
      .set("Authorization", `Bearer ${userBToken}`);
    expect(resList.status).toBe(200);
    expect(resList.body.data.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: "List Event" })
      ])
    );

    const resSingle = await request(app)
      .get(`/api/events/${event._id}`)
      .set("Authorization", `Bearer ${userBToken}`);
    expect(resSingle.status).toBe(200);
    expect(resSingle.body.data.title).toBe("List Event");
  });

  it("legacy event with status missing and draft false is visible", async () => {
    const event = await Event.collection.insertOne({
      title: "Legacy Event 1",
      startsAt: new Date(Date.now() + 86400000),
      creator: new mongoose.Types.ObjectId(userAId),
      location: { name: "Loc" },
      draft: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    trackEvent(event.insertedId.toString());

    const resList = await request(app)
      .get("/api/events")
      .set("Authorization", `Bearer ${userBToken}`);
    expect(resList.status).toBe(200);
    expect(resList.body.data.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: "Legacy Event 1" })
      ])
    );
  });

  it("legacy event with status missing and draft missing is visible", async () => {
    const event = await Event.collection.insertOne({
      title: "Legacy Event 2",
      startsAt: new Date(Date.now() + 86400000),
      creator: new mongoose.Types.ObjectId(userAId),
      location: { name: "Loc" },
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    trackEvent(event.insertedId.toString());

    const resList = await request(app)
      .get("/api/events")
      .set("Authorization", `Bearer ${userBToken}`);
    expect(resList.status).toBe(200);
    expect(resList.body.data.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: "Legacy Event 2" })
      ])
    );
  });

  it("draft event is only visible to creator", async () => {
    const event = await Event.create({
      title: "Draft Event",
      startsAt: new Date(Date.now() + 86400000),
      creator: userAId,
      location: { name: "Loc" },
      draft: true
    });
    trackEvent(event._id.toString());

    const resB = await request(app)
      .get("/api/events")
      .set("Authorization", `Bearer ${userBToken}`);
    expect(resB.body.data.items).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: "Draft Event" })
      ])
    );

    const resA = await request(app)
      .get("/api/events")
      .set("Authorization", `Bearer ${userAToken}`);
    expect(resA.body.data.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: "Draft Event" })
      ])
    );
  });

  it("cancelled event is not visible in public discovery", async () => {
    const event = await Event.create({
      title: "Cancelled Event",
      startsAt: new Date(Date.now() + 86400000),
      creator: userAId,
      location: { name: "Loc" },
      status: "cancelled"
    });
    trackEvent(event._id.toString());

    const resB = await request(app)
      .get("/api/events")
      .set("Authorization", `Bearer ${userBToken}`);
    expect(resB.body.data.items).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: "Cancelled Event" })
      ])
    );
  });

  it("should return 404 for missing event", async () => {
    const res = await request(app)
      .get(`/api/events/${new mongoose.Types.ObjectId()}`)
      .set("Authorization", `Bearer ${userBToken}`);
    expect(res.status).toBe(404);
  });

  it("should allow owner to PATCH event", async () => {
    const event = await Event.create({
      title: "Owner Edit",
      startsAt: new Date(),
      creator: userAId
    });
    trackEvent(event._id.toString());

    const res = await request(app)
      .patch(`/api/events/${event._id}`)
      .set("Authorization", `Bearer ${userAToken}`)
      .send({ title: "Updated Title" });
    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe("Updated Title");
  });

  it("should deny non-owner from PATCH event", async () => {
    const event = await Event.create({
      title: "Non-Owner Edit",
      startsAt: new Date(),
      creator: userAId
    });
    trackEvent(event._id.toString());

    const res = await request(app)
      .patch(`/api/events/${event._id}`)
      .set("Authorization", `Bearer ${userBToken}`)
      .send({ title: "Attempted Hack" });
    expect(res.status).toBe(403);
  });

  it("should allow owner to DELETE event", async () => {
    const event = await Event.create({
      title: "Owner Delete",
      startsAt: new Date(),
      creator: userAId
    });
    trackEvent(event._id.toString());

    const res = await request(app)
      .delete(`/api/events/${event._id}`)
      .set("Authorization", `Bearer ${userAToken}`);
    expect(res.status).toBe(200);

    const dbEvent = await Event.findById(event._id);
    expect(dbEvent).toBeNull();
  });

  it("should deny non-owner from DELETE event", async () => {
    const event = await Event.create({
      title: "Non-Owner Delete",
      startsAt: new Date(),
      creator: userAId
    });
    trackEvent(event._id.toString());

    const res = await request(app)
      .delete(`/api/events/${event._id}`)
      .set("Authorization", `Bearer ${userBToken}`);
    expect(res.status).toBe(403);

    const dbEvent = await Event.findById(event._id);
    expect(dbEvent).toBeTruthy();
  });

  it("should manage attendance (going/none) avoiding duplicates", async () => {
    const event = await Event.create({
      title: "Attendance Test",
      startsAt: new Date(),
      creator: userAId
    });
    trackEvent(event._id.toString());

    // B goes (registers)
    const resGo = await request(app)
      .post(`/api/events/${event._id}/register`)
      .set("Authorization", `Bearer ${userBToken}`);
    expect(resGo.status).toBe(200);

    let dbEvent = await Event.findById(event._id);
    expect(dbEvent!.attendees).toHaveLength(1);
    expect(dbEvent!.attendees[0].user.toString()).toBe(userBId);
    expect(dbEvent!.attendees[0].status).toBe("going");

    // B goes again (duplicate) should return 200 with specific message
    const resDuplicate = await request(app)
      .post(`/api/events/${event._id}/register`)
      .set("Authorization", `Bearer ${userBToken}`);
    expect(resDuplicate.status).toBe(200);
    
    dbEvent = await Event.findById(event._id);
    expect(dbEvent!.attendees).toHaveLength(1); // Still 1

    // B leaves (cancels registration)
    const resLeave = await request(app)
      .delete(`/api/events/${event._id}/register`)
      .set("Authorization", `Bearer ${userBToken}`);
    expect(resLeave.status).toBe(200);
    
    dbEvent = await Event.findById(event._id);
    expect(dbEvent!.attendees).toHaveLength(0);
  });
});
