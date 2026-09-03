import { env } from "../config/env.js";
import { AppError } from "../utils/http.js";

export type AIMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export interface AIProvider {
  complete(messages: AIMessage[]): Promise<string>;
}

class DisabledAIProvider implements AIProvider {
  async complete(_messages: AIMessage[]): Promise<string> {
    throw new AppError(
      503,
      "CampusAI provider is not configured. Add AI_API_KEY on the backend.",
      "AI_PROVIDER_UNAVAILABLE",
    );
  }
}

class OpenAICompatibleProvider implements AIProvider {
  async complete(messages: AIMessage[]) {
    if (!env.AI_API_KEY)
      throw new AppError(
        503,
        "CampusAI API key is not configured",
        "AI_PROVIDER_UNAVAILABLE",
      );
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.AI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        messages,
        temperature: 0.4,
      }),
    });
    if (!response.ok)
      throw new AppError(
        502,
        "CampusAI provider request failed",
        "AI_PROVIDER_ERROR",
      );
    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content)
      throw new AppError(
        502,
        "CampusAI provider returned an empty response",
        "AI_EMPTY_RESPONSE",
      );
    return content;
  }
}

export const aiProvider: AIProvider =
  env.AI_PROVIDER === "openai-compatible"
    ? new OpenAICompatibleProvider()
    : new DisabledAIProvider();
