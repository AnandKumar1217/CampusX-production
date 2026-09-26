export type AIMessageContent =
  | string
  | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }>;

export type AIMessage = {
  role: "system" | "user" | "assistant";
  content: AIMessageContent;
};

export type AIResponse = {
  content: string;
  provider: "groq" | "openrouter";
  model: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
};

export interface AIProvider {
  name: "groq" | "openrouter";
  complete(messages: AIMessage[]): Promise<AIResponse>;
}
