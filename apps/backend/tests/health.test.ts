import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";

describe("GET /api/health", () => {
  it("returns the service health envelope", async () => {
    const response = await request(createApp()).get("/api/health").expect(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.service).toBe("campusx-api");
  });
});
