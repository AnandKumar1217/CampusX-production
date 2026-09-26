import { describe, it, expect, vi, beforeEach } from "vitest";
import { AIProviderRouter } from "../src/services/ai/aiProviderRouter.js";
import { AppError } from "../src/utils/http.js";

// Mock env
vi.mock("../src/config/env.js", () => ({
  env: {
    AI_PROVIDER_ORDER: "groq",
    GROQ_API_KEY: "test-groq",
    GROQ_MODEL: "groq",
    AI_FORCE_FAIL_PROVIDER: ""
  }
}));

describe("AIProviderRouter Failover Logic", () => {
  let router: AIProviderRouter;

  beforeEach(() => {
    router = new AIProviderRouter();
  });

  it("1. Groq success -> Groq returned", async () => {
    const groqComplete = vi.fn().mockResolvedValue({ content: "Groq response", provider: "groq" });

    // Inject mock providers
    (router as any).providers.set("groq", { provider: { name: "groq", complete: groqComplete }, isUnhealthy: false, lastFailedAt: 0 });

    const res = await router.complete([{ role: "user", content: "Hi" }]);
    expect(res.provider).toBe("groq");
    expect(groqComplete).toHaveBeenCalled();
  });

  it("2. All fail -> Normalized AI unavailable error", async () => {
    const fail = vi.fn().mockRejectedValue(new Error("Fail"));

    (router as any).providers.set("groq", { provider: { name: "groq", complete: fail }, isUnhealthy: false, lastFailedAt: 0 });

    await expect(router.complete([{ role: "user", content: "Hi" }])).rejects.toThrow(AppError);
    await expect(router.complete([{ role: "user", content: "Hi" }])).rejects.toThrow(/temporarily unavailable/);
  });

  it("Circuit breaker prevents immediate retry", async () => {
    const groqComplete = vi.fn().mockRejectedValue(new Error("Fail"));

    (router as any).providers.set("groq", { provider: { name: "groq", complete: groqComplete }, isUnhealthy: false, lastFailedAt: 0 });

    // First call fails
    await expect(
      router.complete([{ role: "user", content: "Hi" }]),
    ).rejects.toThrow();
    expect(groqComplete).toHaveBeenCalledTimes(1);

    // Second call goes straight to error, skipping Groq due to circuit breaker
    await expect(
      router.complete([{ role: "user", content: "Hi" }]),
    ).rejects.toThrow();
    expect(groqComplete).toHaveBeenCalledTimes(1); // Still 1!
  });
});
