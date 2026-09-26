import { env } from "../../../config/env.js";
import { AppError } from "../../../utils/http.js";
import { AIProvider, AIMessage, AIResponse } from "../types.js";

export class GroqProvider implements AIProvider {
  readonly name = "groq" as const;

  async complete(messages: AIMessage[]): Promise<AIResponse> {
    if (!env.GROQ_API_KEY) {
      throw new AppError(503, "Groq is not configured", "AI_PROVIDER_UNAVAILABLE");
    }

    let hasImage = false;
    for (const msg of messages) {
      if (Array.isArray(msg.content)) {
        if (msg.content.some((part: any) => part.type === "image_url")) {
          hasImage = true;
          break;
        }
      }
    }

    if (hasImage) {
      throw new AppError(400, "Groq does not support vision models", "AI_UNSUPPORTED_MODALITY");
    }

    const modelToUse = env.GROQ_MODEL;
    const timeoutMs = 15000;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: modelToUse,
          messages,
          temperature: 0.4,
          response_format: hasImage ? { type: "json_object" } : undefined,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 429) {
          throw new AppError(429, "Groq rate limited", "AI_RATE_LIMITED");
        }
        throw new AppError(502, `Groq API error: ${response.status}`, "AI_PROVIDER_ERROR");
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (!content || content.trim() === "") {
        throw new AppError(502, "Groq returned empty response", "AI_EMPTY_RESPONSE");
      }

      return {
        content: content.trim(),
        provider: this.name,
        model: modelToUse,
        usage: {
          inputTokens: data.usage?.prompt_tokens,
          outputTokens: data.usage?.completion_tokens,
          totalTokens: data.usage?.total_tokens,
        },
      };
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error instanceof AppError) throw error;
      if (error.name === "AbortError") {
        throw new AppError(504, "Groq timeout", "AI_TIMEOUT");
      }
      throw new AppError(502, `Groq fetch error: ${error.message}`, "AI_PROVIDER_ERROR");
    }
  }
}
