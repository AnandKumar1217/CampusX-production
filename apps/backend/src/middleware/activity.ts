import { KeepAliveState } from "../models/KeepAliveState.js";

const ACTIVITY_UPDATE_INTERVAL_SECONDS = parseInt(process.env.ACTIVITY_UPDATE_INTERVAL_SECONDS || "60");
let lastUpdate = 0;

export const updateRealUserActivity = () => {
  const now = Date.now();
  if (now - lastUpdate > ACTIVITY_UPDATE_INTERVAL_SECONDS * 1000) {
    lastUpdate = now;
    
    KeepAliveState.updateOne(
      { id: "global" },
      { $set: { lastRealUserActivity: now } },
      { upsert: true }
    ).then(() => {
      console.log("[ActivityTracker] Real user activity detected");
    }).catch((err) => {
      console.error("[ActivityTracker] Failed to update activity", err);
    });
  }
};
