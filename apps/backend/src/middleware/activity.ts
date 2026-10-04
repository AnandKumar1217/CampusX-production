import { env } from "../config/env.js";
import { KeepAliveState } from "../models/KeepAliveState.js";

const STATE_ID = "global";
const UPDATE_INTERVAL_MS = env.ACTIVITY_UPDATE_INTERVAL_SECONDS * 1000;

let lastActivityWriteAt = 0;

export async function updateRealUserActivity(nowMs = Date.now()): Promise<boolean> {
  if (nowMs - lastActivityWriteAt < UPDATE_INTERVAL_MS) return false;

  // Set this before awaiting Mongo so concurrent requests in the same process
  // cannot all perform a write.
  lastActivityWriteAt = nowMs;

  try {
    const now = new Date(nowMs);
    await KeepAliveState.updateOne(
      { _id: STATE_ID },
      {
        $set: { lastRealUserActivity: now },
        $setOnInsert: { lastKeepAliveAt: now },
      },
      { upsert: true },
    );
    return true;
  } catch (error) {
    // Allow a later real-user request to retry if Atlas was temporarily unavailable.
    lastActivityWriteAt = 0;
    console.error(
      "[ActivityTracker] Failed to persist real-user activity",
      error instanceof Error ? error.message : String(error),
    );
    return false;
  }
}
