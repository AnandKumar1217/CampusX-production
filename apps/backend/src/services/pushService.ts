import { Types } from "mongoose";
import { PushDevice } from "../models/PushDevice.js";

// Expo Push Message format
interface ExpoPushMessage {
  to: string | string[];
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

export const pushService = {
  /**
   * Send a push notification to one or multiple users.
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
      });

      if (devices.length === 0) return;

      const tokens = devices.map((d) => d.expoPushToken);

      const expoMessage: ExpoPushMessage = {
        to: tokens,
        sound: "default",
        priority: "high",
        ...message,
      };

      // Send to Expo Push API
      // According to Expo docs, we can send an array of messages.
      // But if it's the same message to multiple tokens, we can just pass an array of tokens to "to".
      const response = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Accept-encoding": "gzip, deflate",
          "Content-Type": "application/json",
        },
        body: JSON.stringify([expoMessage]),
      });

      const result = await response.json();
      
      // Handle token cleanup if there are errors (e.g. DeviceNotRegistered)
      // The result format is { data: [ { status: 'ok'|'error', message, details } ] }
      if (result.data) {
        result.data.forEach((ticket: any, index: number) => {
          if (ticket.status === "error" && ticket.details?.error === "DeviceNotRegistered") {
            const invalidToken = tokens[index]; // Assuming tickets match tokens 1:1 when using an array of 'to'
            // Actually, if 'to' is an array, Expo returns one ticket per token in the same order.
            if (invalidToken) {
              console.log(`Deactivating invalid Expo token: ${invalidToken}`);
              PushDevice.updateOne(
                { expoPushToken: invalidToken },
                { $set: { active: false } }
              ).catch(console.error);
            }
          }
        });
      }
    } catch (error) {
      console.error("Failed to send push notification:", error);
    }
  },
};
