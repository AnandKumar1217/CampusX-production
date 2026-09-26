import { describe, expect, it, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { User } from "../src/models/User.js";
import { CalendarItem } from "../src/models/Commerce.js";
import { createAccessToken } from "../src/services/tokenService.js";
import mongoose from "mongoose";
import { connectToTestDatabase } from "./testDatabase.js";

const app = createApp();

describe("Calendar API", () => {
  let userAToken: string;
  let userAId: string;
  let userBToken: string;
  let userBId: string;
  let itemAId: string;

  beforeAll(async () => {
    await connectToTestDatabase();
    await User.deleteMany({ username: { $in: ["calendarA", "calendarB"] } });

    const userA = await User.create({
      email: "calendarA@example.com",
      username: "calendarA",
      name: "User A",
      passwordHash: "hash123",
      verified: true,
      academicYear: "1st Year",
      department: "CSE",
      college: "Test College",
    });
    userAId = userA._id.toString();
    userAToken = createAccessToken(userAId);

    const userB = await User.create({
      email: "calendarB@example.com",
      username: "calendarB",
      name: "User B",
      passwordHash: "hash123",
      verified: true,
      academicYear: "1st Year",
      department: "CSE",
      college: "Test College",
    });
    userBId = userB._id.toString();
    userBToken = createAccessToken(userBId);

    await CalendarItem.deleteMany({ user: { $in: [userAId, userBId] } });
  });

  afterAll(async () => {
    await CalendarItem.deleteMany({ user: { $in: [userAId, userBId] } });
    await User.deleteMany({ _id: { $in: [userAId, userBId] } });
    await mongoose.disconnect();
  });

  it("1. authenticated GET", async () => {
    const res = await request(app).get("/api/calendar").set("Authorization", `Bearer ${userAToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("2. unauthenticated denied", async () => {
    const res = await request(app).get("/api/calendar");
    expect(res.status).toBe(401);
  });

  it("3. create personal item", async () => {
    const res = await request(app).post("/api/calendar").set("Authorization", `Bearer ${userAToken}`).send({
      title: "ML Midterm",
      type: "exam",
      date: "2026-10-15",
      allDay: false,
      startTime: "10:00",
      endTime: "12:00"
    });
    expect(res.status).toBe(201);
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.title).toBe("ML Midterm");
    itemAId = res.body.data.id;
  });

  it("4. authenticated user derived from auth", async () => {
    const item = await CalendarItem.findById(itemAId);
    expect(item?.user.toString()).toBe(userAId);
  });

  it("5. spoofed user ignored/rejected", async () => {
    const res = await request(app).post("/api/calendar").set("Authorization", `Bearer ${userAToken}`).send({
      title: "Spoof Exam",
      type: "exam",
      date: "2026-10-16",
      user: userBId // attempt to spoof
    });
    expect(res.status).toBe(201);
    expect(res.body.data.user).toBeUndefined(); // Normalized output
    const dbItem = await CalendarItem.findById(res.body.data.id);
    expect(dbItem?.user.toString()).toBe(userAId); // Ignored spoofed user
  });

  it("6. User A sees A items", async () => {
    const res = await request(app).get("/api/calendar").set("Authorization", `Bearer ${userAToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    const hasItemA = res.body.data.some((i: any) => i.id === itemAId);
    expect(hasItemA).toBe(true);
  });

  it("7. User B cannot see A items", async () => {
    const res = await request(app).get("/api/calendar").set("Authorization", `Bearer ${userBToken}`);
    expect(res.status).toBe(200);
    const hasItemA = res.body.data.some((i: any) => i.id === itemAId);
    expect(hasItemA).toBe(false);
  });

  it("8. valid exam", async () => {
    const res = await request(app).post("/api/calendar").set("Authorization", `Bearer ${userAToken}`).send({
      title: "Valid Exam",
      type: "exam",
      date: "2026-10-17"
    });
    expect(res.status).toBe(201);
  });

  it("9. valid assignment", async () => {
    const res = await request(app).post("/api/calendar").set("Authorization", `Bearer ${userAToken}`).send({
      title: "Valid Assignment",
      type: "assignment",
      date: "2026-10-18"
    });
    expect(res.status).toBe(201);
  });

  it("10. valid reminder", async () => {
    const res = await request(app).post("/api/calendar").set("Authorization", `Bearer ${userAToken}`).send({
      title: "Valid Reminder",
      type: "reminder",
      date: "2026-10-19"
    });
    expect(res.status).toBe(201);
  });

  it("11. valid personal", async () => {
    const res = await request(app).post("/api/calendar").set("Authorization", `Bearer ${userAToken}`).send({
      title: "Valid Personal",
      type: "personal",
      date: "2026-10-20"
    });
    expect(res.status).toBe(201);
  });

  it("12. invalid type rejected", async () => {
    const res = await request(app).post("/api/calendar").set("Authorization", `Bearer ${userAToken}`).send({
      title: "Invalid Type",
      type: "party", // not allowed
      date: "2026-10-21"
    });
    expect(res.status).toBe(422);
  });

  it("13. invalid date rejected", async () => {
    const res = await request(app).post("/api/calendar").set("Authorization", `Bearer ${userAToken}`).send({
      title: "Invalid Date",
      type: "exam",
      date: "10-22-2026" // wrong format
    });
    expect(res.status).toBe(422);
  });

  it("14. invalid start time rejected", async () => {
    const res = await request(app).post("/api/calendar").set("Authorization", `Bearer ${userAToken}`).send({
      title: "Invalid Time",
      type: "exam",
      date: "2026-10-23",
      allDay: false,
      startTime: "9:00" // missing leading zero
    });
    expect(res.status).toBe(422);
  });

  it("15. invalid end time rejected", async () => {
    const res = await request(app).post("/api/calendar").set("Authorization", `Bearer ${userAToken}`).send({
      title: "Invalid Time",
      type: "exam",
      date: "2026-10-24",
      allDay: false,
      startTime: "09:00",
      endTime: "100:00"
    });
    expect(res.status).toBe(422);
  });

  it("16. end <= start rejected for timed item", async () => {
    const res = await request(app).post("/api/calendar").set("Authorization", `Bearer ${userAToken}`).send({
      title: "Invalid Time Logic",
      type: "exam",
      date: "2026-10-25",
      allDay: false,
      startTime: "10:00",
      endTime: "09:00"
    });
    expect(res.status).toBe(422);
  });

  it("17. all-day item allowed without time", async () => {
    const res = await request(app).post("/api/calendar").set("Authorization", `Bearer ${userAToken}`).send({
      title: "All day",
      type: "exam",
      date: "2026-10-26",
      allDay: true
    });
    expect(res.status).toBe(201);
  });

  it("18. timed item requires startTime", async () => {
    const res = await request(app).post("/api/calendar").set("Authorization", `Bearer ${userAToken}`).send({
      title: "Timed no start",
      type: "exam",
      date: "2026-10-27",
      allDay: false
    });
    expect(res.status).toBe(422);
  });

  it("19. range GET filters correctly", async () => {
    const res = await request(app).get("/api/calendar?startDate=2026-10-15&endDate=2026-10-15").set("Authorization", `Bearer ${userAToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    const hasItemA = res.body.data.some((i: any) => i.id === itemAId);
    expect(hasItemA).toBe(true);
  });

  it("20. out-of-range items excluded", async () => {
    const res = await request(app).get("/api/calendar?startDate=2026-11-01&endDate=2026-11-30").set("Authorization", `Bearer ${userAToken}`);
    expect(res.status).toBe(200);
    const hasItemA = res.body.data.some((i: any) => i.id === itemAId);
    expect(hasItemA).toBe(false);
  });

  it("21. owner update succeeds", async () => {
    const res = await request(app).patch(`/api/calendar/${itemAId}`).set("Authorization", `Bearer ${userAToken}`).send({
      title: "Updated ML Midterm"
    });
    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe("Updated ML Midterm");
  });

  it("22. other user update denied", async () => {
    const res = await request(app).patch(`/api/calendar/${itemAId}`).set("Authorization", `Bearer ${userBToken}`).send({
      title: "Hacked Title"
    });
    expect(res.status).toBe(404);
  });

  it("23. other user delete denied", async () => {
    const res = await request(app).delete(`/api/calendar/${itemAId}`).set("Authorization", `Bearer ${userBToken}`);
    expect(res.status).toBe(404);
  });

  it("24. owner delete succeeds", async () => {
    const res = await request(app).delete(`/api/calendar/${itemAId}`).set("Authorization", `Bearer ${userAToken}`);
    expect(res.status).toBe(200);
  });

  it("25. malformed ID handled", async () => {
    const res = await request(app).get("/api/calendar/invalid_id_format").set("Authorization", `Bearer ${userAToken}`);
    expect(res.status).toBe(404); // Route matching handles it or validation handles it
  });

  it("26. missing item handled", async () => {
    const res = await request(app).patch(`/api/calendar/${itemAId}`).set("Authorization", `Bearer ${userAToken}`).send({ title: "Doesn't exist anymore" });
    expect(res.status).toBe(404);
  });
});
