import { describe, expect, it } from "vitest";

import { isCorsOriginAllowed } from "../src/config/cors.js";

describe("production CORS policy", () => {
  const allowedOrigins = ["https://campusx.example"];

  it("allows native clients without a browser Origin header", () => {
    expect(isCorsOriginAllowed(undefined, allowedOrigins)).toBe(true);
  });

  it("allows an explicitly configured browser origin", () => {
    expect(isCorsOriginAllowed("https://campusx.example", allowedOrigins)).toBe(
      true,
    );
  });

  it("rejects unlisted browser origins", () => {
    expect(
      isCorsOriginAllowed("https://untrusted.example", allowedOrigins),
    ).toBe(false);
  });
});
