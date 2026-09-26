import { env } from "../../config/env.js";
import { AppError } from "../../utils/http.js";
import { AIProvider, AIMessage, AIResponse } from "./types.js";
import { GroqProvider } from "./providers/groqProvider.js";

const CIRCUIT_BREAKER_COOLDOWN_MS = 60000;

interface ProviderState {
  provider: AIProvider;
  isUnhealthy: boolean;
  lastFailedAt: number;
}

export class AIProviderRouter {
  private providers: Map<string, ProviderState> = new Map();
  private order: string[] = [];

  constructor() {
    this.registerProvider(new GroqProvider());

    const configuredOrder = env.AI_PROVIDER_ORDER.split(",").map((s) => s.trim().toLowerCase());
    this.order = configuredOrder.filter((name) => this.providers.has(name));
  }

  private registerProvider(provider: AIProvider) {
    this.providers.set(provider.name, {
      provider,
      isUnhealthy: false,
      lastFailedAt: 0,
    });
  }

  private updateHealth() {
    const now = Date.now();
    for (const state of this.providers.values()) {
      if (state.isUnhealthy && now - state.lastFailedAt > CIRCUIT_BREAKER_COOLDOWN_MS) {
        state.isUnhealthy = false;
        state.lastFailedAt = 0;
      }
    }
  }

  private markUnhealthy(name: string) {
    const state = this.providers.get(name);
    if (state) {
      state.isUnhealthy = true;
      state.lastFailedAt = Date.now();
      console.warn(`[AI System] Provider '${name}' marked unhealthy. Cooldown started.`);
    }
  }

  async complete(messages: AIMessage[]): Promise<AIResponse> {
    this.updateHealth();

    let forcedFailures: string[] = [];
    if (env.AI_FORCE_FAIL_PROVIDER) {
      forcedFailures = env.AI_FORCE_FAIL_PROVIDER.split(",").map((s) => s.trim().toLowerCase());
    }

    console.log(`[AI] provider order = ${this.order.join(",")}`);

    for (const name of this.order) {
      const state = this.providers.get(name);
      if (!state) continue;

      if (state.isUnhealthy) {
        console.warn(`[AI] Skipping '${name}' (currently unhealthy)`);
        continue;
      }

      if (forcedFailures.includes(name)) {
        console.warn(`[AI] Skipping '${name}' (forced failure for testing)`);
        continue;
      }

      try {
        console.log(`[AI] attempting provider = ${name}`);
        const response = await state.provider.complete(messages);
        return response;
      } catch (error: any) {
        console.warn(`[AI] ${name} failed:`, {
          status: error.statusCode || error.status || error.response?.status,
          code: error.code,
          message: error.message
        });

        if (error.code === "AI_UNSUPPORTED_MODALITY") {
          console.warn(`[AI] Skipping '${name}' (modality not supported)`);
          continue;
        }

        // Mark unhealthy for any error so we fail over immediately
        // (including 429 rate limit, 5xx, timeouts)
        this.markUnhealthy(name);
      }
    }

    // If we reach here, all providers failed or were skipped
    throw new AppError(
      503,
      "CampusX AI is temporarily unavailable. Please try again shortly.",
      "AI_TEMPORARILY_UNAVAILABLE"
    );
  }
}

export const aiProviderRouter = new AIProviderRouter();
