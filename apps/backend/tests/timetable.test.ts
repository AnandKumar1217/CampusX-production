import { describe, expect, it, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { User } from "../src/models/User.js";
import { CustomHoliday, ScheduleOverride, SpecialClass, TimetableEntry } from "../src/models/Commerce.js";
import { createAccessToken } from "../src/services/tokenService.js";
import mongoose from "mongoose";
import { connectToTestDatabase } from "./testDatabase.js";

const app = createApp();

describe("Timetable API", () => {
  let userAToken: string;
  let userAId: string;
  let userBToken: string;
  let userBId: string;
  let entryAId: string;
  let chemistryId: string;

  beforeAll(async () => {
    await connectToTestDatabase();
    await User.deleteMany({ username: { $in: ["usera", "userb"] } });

    const userA = await User.create({
      email: "usera@example.com",
      username: "usera",
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
      email: "userb@example.com",
      username: "userb",
      name: "User B",
      passwordHash: "hash123",
      verified: true,
      academicYear: "1st Year",
      department: "CSE",
      college: "Test College",
    });
    userBId = userB._id.toString();
    userBToken = createAccessToken(userBId);

    // Initial clear
    await TimetableEntry.deleteMany({ user: { $in: [userAId, userBId] } });
    await ScheduleOverride.deleteMany({ user: { $in: [userAId, userBId] } });
    await SpecialClass.deleteMany({ user: { $in: [userAId, userBId] } });
    await CustomHoliday.deleteMany({ user: { $in: [userAId, userBId] } });
  });

  afterAll(async () => {
    await TimetableEntry.deleteMany({ user: { $in: [userAId, userBId] } });
    await ScheduleOverride.deleteMany({ user: { $in: [userAId, userBId] } });
    await SpecialClass.deleteMany({ user: { $in: [userAId, userBId] } });
    await CustomHoliday.deleteMany({ user: { $in: [userAId, userBId] } });
    await User.deleteMany({ _id: { $in: [userAId, userBId] } });
    await mongoose.disconnect();
  });

  it("1. GET authenticated", async () => {
    const res = await request(app).get("/api/timetable").set("Authorization", `Bearer ${userAToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toBeInstanceOf(Array);
  });

  it("4. create entry", async () => {
    const res = await request(app)
      .post("/api/timetable")
      .set("Authorization", `Bearer ${userAToken}`)
      .send({
        subject: "Math",
        days: [1],
        startTime: "09:00",
        endTime: "10:00",
        room: "101",
      });
    expect(res.status).toBe(201);
    expect(res.body.data.subject).toBe("Math");
    entryAId = res.body.data.id;
  });

  it("2. User A sees only A entries", async () => {
    const res = await request(app).get("/api/timetable").set("Authorization", `Bearer ${userAToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].id).toBe(entryAId);
  });

  it("3. User B cannot see A data", async () => {
    const res = await request(app).get("/api/timetable").set("Authorization", `Bearer ${userBToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(0);
  });

  it("5. user derived from auth", async () => {
    const check = await TimetableEntry.findById(entryAId);
    expect(check?.user.toString()).toBe(userAId);
  });

  it("6. spoofed user ignored/rejected", async () => {
    const res = await request(app)
      .post("/api/timetable")
      .set("Authorization", `Bearer ${userAToken}`)
      .send({
        subject: "Hacked",
        days: [1],
        startTime: "12:00",
        endTime: "13:00",
        user: userBId, // attempting to spoof
      });
    expect(res.status).toBe(201); // should create it, but ignore user spoofing
    const check = await TimetableEntry.findById(res.body.data.id);
    expect(check?.user.toString()).toBe(userAId); // still created for A

    // clean up
    await TimetableEntry.findByIdAndDelete(res.body.data.id);
  });

  it("7. invalid subject", async () => {
    const res = await request(app)
      .post("/api/timetable")
      .set("Authorization", `Bearer ${userAToken}`)
      .send({ days: [1], startTime: "14:00", endTime: "15:00" });
    expect(res.status).toBe(422);
  });

  it("8. invalid days", async () => {
    const res = await request(app)
      .post("/api/timetable")
      .set("Authorization", `Bearer ${userAToken}`)
      .send({ subject: "Math", days: [], startTime: "14:00", endTime: "15:00" });
    expect(res.status).toBe(422);
  });

  it("9. invalid start time", async () => {
    const res = await request(app)
      .post("/api/timetable")
      .set("Authorization", `Bearer ${userAToken}`)
      .send({ subject: "Math", days: [1], startTime: "25:00", endTime: "15:00" });
    expect(res.status).toBe(400);
  });

  it("10. invalid end time", async () => {
    const res = await request(app)
      .post("/api/timetable")
      .set("Authorization", `Bearer ${userAToken}`)
      .send({ subject: "Math", days: [1], startTime: "14:00", endTime: "25:00" });
    expect(res.status).toBe(400);
  });

  it("11. end <= start", async () => {
    const res = await request(app)
      .post("/api/timetable")
      .set("Authorization", `Bearer ${userAToken}`)
      .send({ subject: "Physics", days: [1], startTime: "11:00", endTime: "10:00" });
    expect(res.status).toBe(400);
  });

  it("12. same-day overlap reject", async () => {
    const res = await request(app)
      .post("/api/timetable")
      .set("Authorization", `Bearer ${userAToken}`)
      .send({ subject: "Chemistry", days: [1], startTime: "09:30", endTime: "10:30" });
    expect(res.status).toBe(409);
  });

  it("13. boundary touching allowed", async () => {
    const res = await request(app)
      .post("/api/timetable")
      .set("Authorization", `Bearer ${userAToken}`)
      .send({ subject: "Chemistry", days: [1], startTime: "10:00", endTime: "11:00" });
    expect(res.status).toBe(201);
    chemistryId = res.body.data.id;
  });

  it("14. different-day same time allowed", async () => {
    const res = await request(app)
      .post("/api/timetable")
      .set("Authorization", `Bearer ${userAToken}`)
      .send({ subject: "Biology", days: [2], startTime: "09:00", endTime: "10:00" });
    expect(res.status).toBe(201);
  });

  it("15. multi-day overlap reject", async () => {
    const res = await request(app)
      .post("/api/timetable")
      .set("Authorization", `Bearer ${userAToken}`)
      .send({ subject: "History", days: [2, 3], startTime: "09:30", endTime: "10:30" }); // 2 is Biology
    expect(res.status).toBe(409);
  });

  it("16. owner update", async () => {
    const res = await request(app)
      .patch(`/api/timetable/${entryAId}`)
      .set("Authorization", `Bearer ${userAToken}`)
      .send({ room: "202" });
    expect(res.status).toBe(200);
    expect(res.body.data.room).toBe("202");
  });

  it("17. update excludes itself", async () => {
    // Should be able to update its own time if it doesn't overlap others
    const res = await request(app)
      .patch(`/api/timetable/${entryAId}`)
      .set("Authorization", `Bearer ${userAToken}`)
      .send({ startTime: "08:00", endTime: "09:30" }); // Changing 09:00-10:00 to 08:00-09:30
    expect(res.status).toBe(200);
  });

  it("18. update causing overlap reject", async () => {
    // Chemistry is 10:00-11:00 on Day 1. Let's try to update Math to 09:00-10:30
    const res = await request(app)
      .patch(`/api/timetable/${entryAId}`)
      .set("Authorization", `Bearer ${userAToken}`)
      .send({ startTime: "09:00", endTime: "10:30" });
    expect(res.status).toBe(409);
  });

  it("18a. resolves date-only changes, conflicts, swap, restore and cancellation", async () => {
    const date = "2026-09-28"; // Monday
    const conflict = await request(app)
      .post(`/api/timetable/${entryAId}/reschedule`)
      .set("Authorization", `Bearer ${userAToken}`)
      .send({ scope: "one_date", date, newStartTime: "10:00", newEndTime: "11:00" });
    expect(conflict.status).toBe(409);
    expect(conflict.body.code).toBe("SCHEDULE_CONFLICT");
    expect(conflict.body.details.actions).toContain("swap");

    const swap = await request(app)
      .post(`/api/timetable/${entryAId}/reschedule`)
      .set("Authorization", `Bearer ${userAToken}`)
      .send({
        scope: "one_date", date, newStartTime: "10:00", newEndTime: "11:00",
        conflictAction: "swap", conflictClassId: chemistryId,
      });
    expect(swap.status).toBe(200);

    let schedule = await request(app)
      .get(`/api/timetable/schedule?date=${date}`)
      .set("Authorization", `Bearer ${userAToken}`);
    expect(schedule.body.data.classes.find((item: any) => item.baseClassId === entryAId).startTime).toBe("10:00");
    expect(schedule.body.data.classes.find((item: any) => item.baseClassId === chemistryId).startTime).toBe("08:00");

    await request(app).post(`/api/timetable/${entryAId}/restore`).set("Authorization", `Bearer ${userAToken}`).send({ date });
    await request(app).post(`/api/timetable/${chemistryId}/restore`).set("Authorization", `Bearer ${userAToken}`).send({ date });

    const cancel = await request(app)
      .post(`/api/timetable/${entryAId}/cancel`)
      .set("Authorization", `Bearer ${userAToken}`)
      .send({ scope: "one_date", date });
    expect(cancel.status).toBe(200);
    schedule = await request(app).get(`/api/timetable/schedule?date=${date}`).set("Authorization", `Bearer ${userAToken}`);
    expect(schedule.body.data.classes.some((item: any) => item.baseClassId === entryAId)).toBe(false);
    await request(app).post(`/api/timetable/${entryAId}/restore`).set("Authorization", `Bearer ${userAToken}`).send({ date });
  });

  it("18b. resolves future changes and special classes", async () => {
    const future = await request(app)
      .post(`/api/timetable/${entryAId}/reschedule`)
      .set("Authorization", `Bearer ${userAToken}`)
      .send({ scope: "future", date: "2026-09-28", newDay: 1, newStartTime: "07:00", newEndTime: "08:00" });
    expect(future.status).toBe(200);
    let schedule = await request(app)
      .get("/api/timetable/schedule?date=2026-10-05")
      .set("Authorization", `Bearer ${userAToken}`);
    expect(schedule.body.data.classes.find((item: any) => item.baseClassId === entryAId).startTime).toBe("07:00");
    await request(app).post(`/api/timetable/${entryAId}/restore`).set("Authorization", `Bearer ${userAToken}`).send({ date: "2026-09-28" });

    const special = await request(app)
      .post("/api/timetable/special")
      .set("Authorization", `Bearer ${userAToken}`)
      .send({ date: "2026-09-28", subject: "Special Lab", startTime: "12:00", endTime: "13:00" });
    expect(special.status).toBe(201);
    schedule = await request(app).get("/api/timetable/schedule?date=2026-09-28").set("Authorization", `Bearer ${userAToken}`);
    expect(schedule.body.data.classes.some((item: any) => item.source === "special" && item.subject === "Special Lab")).toBe(true);
    await request(app).delete(`/api/timetable/special/${special.body.data._id}`).set("Authorization", `Bearer ${userAToken}`);
  });

  it("18c. custom no-class days suppress the actual schedule", async () => {
    const holiday = await request(app)
      .post("/api/holidays")
      .set("Authorization", `Bearer ${userAToken}`)
      .send({ date: "2026-09-28", name: "Campus Closed" });
    expect(holiday.status).toBe(201);
    const schedule = await request(app)
      .get("/api/timetable/schedule?date=2026-09-28")
      .set("Authorization", `Bearer ${userAToken}`);
    expect(schedule.body.data.holiday.name).toBe("Campus Closed");
    expect(schedule.body.data.classes).toHaveLength(0);
    await request(app).delete(`/api/holidays/${holiday.body.data._id}`).set("Authorization", `Bearer ${userAToken}`);
  });

  it("19. other user update denied", async () => {
    const res = await request(app)
      .patch(`/api/timetable/${entryAId}`)
      .set("Authorization", `Bearer ${userBToken}`)
      .send({ room: "Hacked" });
    expect(res.status).toBe(404);
  });

  it("21. other user delete denied", async () => {
    const res = await request(app)
      .delete(`/api/timetable/${entryAId}`)
      .set("Authorization", `Bearer ${userBToken}`);
    expect(res.status).toBe(404);
  });

  it("22. malformed ID", async () => {
    const res = await request(app)
      .delete(`/api/timetable/invalid_id`)
      .set("Authorization", `Bearer ${userAToken}`);
    expect(res.status).toBe(400); // or 404 depending on validation
  });

  it("23. missing ID", async () => {
    const res = await request(app)
      .delete(`/api/timetable/`)
      .set("Authorization", `Bearer ${userAToken}`);
    expect(res.status).toBe(404); // Route not found
  });

  it("20. owner delete", async () => {
    const res = await request(app)
      .delete(`/api/timetable/${entryAId}`)
      .set("Authorization", `Bearer ${userAToken}`);
    expect(res.status).toBe(200);
    const check = await TimetableEntry.findById(entryAId);
    expect(check).toBeNull();
  });

  it("24. response normalization/data integrity as applicable", async () => {
    // Ensure all documents sent out have 'id' instead of '_id'
    const res = await request(app).get("/api/timetable").set("Authorization", `Bearer ${userAToken}`);
    if (res.body.data.length > 0) {
        expect(res.body.data[0].id).toBeDefined();
        expect(res.body.data[0]._id).toBeUndefined();
    }
  });

});
