import { api } from "./api";

export type ChatMessage = {
  role: "user" | "assistant";
  text: string;
};

export async function generateChatResponse(history: ChatMessage[], conversationId?: string): Promise<{ reply: string, conversationId?: string }> {
  try {
    // We only send the last message since backend will pull from DB and/or manage history
    // if conversationId is provided.
    // If we want to support true stateless history like the old code, we would send all.
    // The backend `POST /api/ai/chat` expects: { message: string, conversationId?: string }

    const lastUserMessage = [...history].reverse().find(m => m.role === "user");
    if (!lastUserMessage) {
      return { reply: "I didn't catch that." };
    }

    const res = await api.post<{ data: { conversationId: string; reply: string } }>('/ai/chat', {
      message: lastUserMessage.text, // Keep for backwards compatibility
      messages: history, // Send full history array for context
      conversationId
    }, { timeout: 60000 });

    return res.data.data;
  } catch (error: any) {
    console.warn("AI Chat Error:", error);
    if (error.response?.data?.error?.message) {
      return { reply: error.response.data.error.message };
    }
    return { reply: "CampusX AI is temporarily unavailable. Please try again shortly." };
  }
}
