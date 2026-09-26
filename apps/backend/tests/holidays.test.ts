import request from "supertest";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createApp } from "../src/app.js";
import { Holiday } from "../src/models/System.js";
import { User } from "../src/models/User.js";
import { createAccessToken } from "../src/services/tokenService.js";
import { connectToTestDatabase } from "./testDatabase.js";

const app = createApp();

describe("Holidays API", () => {
  let token: string;
  let userId: string;

  beforeAll(async () => {
    await connectToTestDatabase();

    // Create test user and token
    const testUser = await User.create({
      username: "holidaytestuser",
      email: "holidaytestuser@example.com",
      passwordHash: "hash",
      fullName: "Holiday Test User",
      name: "Holiday Test User",
      academicYear: "1",
      department: "CSE",
      college: "CampusX"

    });
    userId = testUser.id;
    token = createAccessToken(userId, 1);

    // seed some holidays
    await Holiday.create([
      { name: "Diwali", date: "2026-11-08", type: "festival", description: "Festival of lights" },
      { name: "Christmas", date: "2026-12-25", type: "festival" },
      { name: "New Year", date: "2027-01-01", type: "national" }
    ]);
  });

  afterAll(async () => {
    await Holiday.deleteMany({});
    await User.findByIdAndDelete(userId);
    // Don't disconnect here if tests run concurrently, but wait, others don't disconnect either, or maybe they do?
  });

  it("1. valid range query returns holidays", async () => {
    const res = await request(app)
      .get("/api/holidays?startDate=2026-11-01&endDate=2026-12-31")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBe(2);
    expect(res.body.data[0].name).toBe("Diwali");
    expect(res.body.data[1].name).toBe("Christmas");
  });

  it("2. out of range query returns empty array", async () => {
    const res = await request(app)
      .get("/api/holidays?startDate=2026-01-01&endDate=2026-10-31")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(0);
  });

  it("3. missing startDate rejected", async () => {
    const res = await request(app)
      .get("/api/holidays?endDate=2026-12-31")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(422);
  });

  it("4. invalid date format rejected", async () => {
    const res = await request(app)
      .get("/api/holidays?startDate=11-01-2026&endDate=2026-12-31")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(422);
  });

  it("5. endDate before startDate rejected", async () => {
    const res = await request(app)
      .get("/api/holidays?startDate=2026-12-31&endDate=2026-11-01")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(422);
  });
});
