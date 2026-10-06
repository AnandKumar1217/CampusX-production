import { Types } from "mongoose";
import { PushDevice } from "../models/PushDevice.js";

// Expo Push Message format
interface ExpoPushMessage {
  to: string;
  data?: object;
  title?: string;
  body?: string;
  sound?: "default" | null;
  ttl?: number;
  expiration?: number;
  priority?: "default" | "normal" | "high";
  badge?: number;
  channelId?: string;
}

interface ExpoTicket {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
}

/** Mask an Expo push token for safe logging. Never log full tokens in production. */
function maskToken(token: string): string {
  if (!token || token.length < 10) return "***";
  const inner = token.replace(/^ExponentPushToken\[/, "").replace(/\]$/, "");
  return `ExponentPushToken[${inner.slice(0, 3)}...${inner.slice(-3)}]`;
}

/** Sanitize full text to prevent logging complete tokens. */
function sanitizeLogs(text: string): string {
  if (!text) return "";
  return text.replace(/(ExponentPushToken|ExpoPushToken)\[([^\]]+)\]/g, (match, prefix, inner) => {
    if (inner.length < 6) return `${prefix}[***]`;
    return `${prefix}[${inner.slice(0, 3)}...${inner.slice(-3)}]`;
  });
}

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_CHUNK_SIZE = 100; // Expo recommends ≤100 per request

/**
 * Send individual push messages to a list of tokens.
 * One Expo message object per token guarantees correct ticket-to-token mapping.
 */
async function sendBatch(
  messages: ExpoPushMessage[],
  tokenForIndex: string[]
): Promise<void> {
  const response = await fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Accept-encoding": "gzip, deflate",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(messages),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "(unreadable)");
    console.error(
      `[push] Expo API HTTP error ${response.status}: ${sanitizeLogs(errorText).slice(0, 200)}`
    );
    return;
  }

  const result: { data?: ExpoTicket[] } = await response.json();

  if (!result.data) {
    console.error("[push] Expo API returned no data:", sanitizeLogs(JSON.stringify(result)).slice(0, 200));
    return;
  }

  // Each ticket corresponds 1:1 with the message at the same index.
  const deactivations: Promise<unknown>[] = [];
  result.data.forEach((ticket, index) => {
    if (ticket.status === "error") {
      const errorCode = ticket.details?.error ?? "unknown";
      const token = tokenForIndex[index];
      if (!token) return; // guard: index out of range (should not happen)
      const maskedToken = maskToken(token);
      console.warn(`[push] Ticket error for ${maskedToken}: ${errorCode} — ${ticket.message ?? ""}`);

      if (errorCode === "DeviceNotRegistered") {
        // Only deactivate the specific dead token, not all others.
        deactivations.push(
          PushDevice.updateOne(
            { expoPushToken: token },
            { $set: { active: false } }
          ).catch((err) =>
            console.error("[push] Failed to deactivate DeviceNotRegistered token:", err)
          )
        );
      }
      // InvalidCredentials / MismatchSenderId require FCM V1 re-configuration — log clearly.
      if (errorCode === "InvalidCredentials" || errorCode === "MismatchSenderId") {
        console.error(
          `[push] CREDENTIAL ERROR (${errorCode}): FCM V1 Google Service Account in EAS may be incorrect or expired. ` +
            "Go to EAS → Android → production → Push Notifications (FCM V1) and re-upload the service account key."
        );
      }
    }
  });

  await Promise.all(deactivations);
}

export const pushService = {
  /**
   * Send a push notification to one or multiple users.
   * Each token gets its own message object so Expo ticket indices are correct.
   */
  async sendPushNotification(
    userIds: Types.ObjectId | Types.ObjectId[],
    message: Omit<ExpoPushMessage, "to">
  ) {
    try {
      const users = Array.isArray(userIds) ? userIds : [userIds];
      if (users.length === 0) return;

      // Find all active tokens for these users
      const devices = await PushDevice.find({
        user: { $in: users },
        active: true,
      }).lean();

      if (devices.length === 0) return;

      // Build one Expo message per token (guarantees 1:1 ticket mapping)
      const messages: ExpoPushMessage[] = devices.map((d) => ({
        to: d.expoPushToken,
        sound: "default" as const,
        priority: "high" as const,
        ...message,
      }));
      const tokenForIndex = devices.map((d) => d.expoPushToken);

      // Chunk into batches of ≤100 as Expo recommends
      for (let i = 0; i < messages.length; i += EXPO_CHUNK_SIZE) {
        const batchMessages = messages.slice(i, i + EXPO_CHUNK_SIZE);
        const batchTokens = tokenForIndex.slice(i, i + EXPO_CHUNK_SIZE);
        await sendBatch(batchMessages, batchTokens);
      }
    } catch (error) {
      console.error("[push] Failed to send push notification:", error);
    }
  },
};
