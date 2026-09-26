import request from "supertest";
import mongoose from "mongoose";
import { afterEach, describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";

describe("GET /api/health", () => {
  const initialReadyState = mongoose.connection.readyState;

  afterEach(() => {
    mongoose.connection.readyState = initialReadyState;
  });

  it("returns healthy when MongoDB is connected", async () => {
    mongoose.connection.readyState = 1;
    const response = await request(createApp()).get("/api/health").expect(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.service).toBe("campusx-api");
    expect(response.body.data.database).toBe("connected");
  });

  it("returns unavailable when MongoDB is disconnected", async () => {
    mongoose.connection.readyState = 0;
    const response = await request(createApp()).get("/api/health").expect(503);
    expect(response.body.success).toBe(false);
    expect(response.body.data.database).toBe("disconnected");
  });
});
