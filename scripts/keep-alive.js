"use strict";

const STATE_ID = "global";
const DEFAULT_THRESHOLD_MINUTES = 8;
const LOCK_TTL_MS = 60_000;
const REQUEST_TIMEOUT_MS = 15_000;
const DEFAULT_HEALTH_URL = "https://campusx-production.onrender.com/api/health";

function toTime(value, fallbackMs) {
  if (!value) return fallbackMs;
  const date = value instanceof Date ? value : new Date(value);
  const time = date.getTime();
  return Number.isFinite(time) ? time : fallbackMs;
}

function shouldSendKeepAlive(state, nowMs, thresholdMs) {
  if (!state) return false;
  const lastRealUserActivity = toTime(state.lastRealUserActivity, nowMs);
  const lastKeepAliveAt = toTime(state.lastKeepAliveAt, nowMs);

  return (
    nowMs - lastRealUserActivity >= thresholdMs &&
    nowMs - lastKeepAliveAt >= thresholdMs
  );
}

function buildLockFilter(now, thresholdMs) {
  const cutoff = new Date(now.getTime() - thresholdMs);
  return {
    _id: STATE_ID,
    lastRealUserActivity: { $lte: cutoff },
    lastKeepAliveAt: { $lte: cutoff },
    $or: [
      { keepAliveLockUntil: { $exists: false } },
      { keepAliveLockUntil: null },
      { keepAliveLockUntil: { $lte: now } },
    ],
  };
}

async function run() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error("[KeepAlive] MONGO_URI GitHub secret is missing");
    process.exitCode = 1;
    return;
  }

  const thresholdMinutes = Number(
    process.env.KEEP_ALIVE_THRESHOLD_MINUTES ?? DEFAULT_THRESHOLD_MINUTES,
  );
  if (!Number.isFinite(thresholdMinutes) || thresholdMinutes <= 0) {
    console.error("[KeepAlive] KEEP_ALIVE_THRESHOLD_MINUTES is invalid");
    process.exitCode = 1;
    return;
  }

  const thresholdMs = thresholdMinutes * 60_000;
  const healthUrl = process.env.RENDER_HEALTH_URL ?? DEFAULT_HEALTH_URL;
  const parsedHealthUrl = new URL(healthUrl);
  if (parsedHealthUrl.protocol !== "https:") {
    console.error("[KeepAlive] RENDER_HEALTH_URL must use HTTPS");
    process.exitCode = 1;
    return;
  }

  // Require lazily so the pure decision helpers can be tested without installing mongoose.
  const mongoose = require("mongoose");

  try {
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 10_000,
      connectTimeoutMS: 10_000,
    });

    const collection = mongoose.connection.db.collection("keepalivestates");
    const initialNow = new Date();

    // Safe first-run initialization. A newly deployed scheduler waits for the
    // inactivity threshold rather than sending an immediate synthetic ping.
    await collection.updateOne(
      { _id: STATE_ID },
      {
        $setOnInsert: {
          lastRealUserActivity: initialNow,
          lastKeepAliveAt: initialNow,
        },
      },
      { upsert: true },
    );

    const initialState = await collection.findOne({ _id: STATE_ID });
    const decisionNowMs = Date.now();
    if (!shouldSendKeepAlive(initialState, decisionNowMs, thresholdMs)) return;

    const lockNow = new Date();
    const lockUntil = new Date(lockNow.getTime() + LOCK_TTL_MS);

    // This single atomic findOneAndUpdate both rechecks inactivity and acquires
    // the lock. Overlapping scheduler jobs cannot both pass this update.
    const lockedState = await collection.findOneAndUpdate(
      buildLockFilter(lockNow, thresholdMs),
      { $set: { keepAliveLockUntil: lockUntil } },
      { returnDocument: "after" },
    );

    if (!lockedState) return;

    // Re-read after locking so a real-user update that raced with the lock can
    // cancel an unnecessary ping.
    const latestState = await collection.findOne({ _id: STATE_ID });
    if (!shouldSendKeepAlive(latestState, Date.now(), thresholdMs)) {
      await collection.updateOne(
        { _id: STATE_ID, keepAliveLockUntil: lockUntil },
        { $unset: { keepAliveLockUntil: "" } },
      );
      return;
    }

    console.log(
      `[KeepAlive] CampusX idle for at least ${thresholdMinutes}m - sending health ping`,
    );

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(healthUrl, {
        method: "GET",
        signal: controller.signal,
        headers: { "User-Agent": "CampusX-Smart-KeepAlive/1.0" },
      });

      if (!response.ok) {
        throw new Error(`health endpoint returned HTTP ${response.status}`);
      }

      await collection.updateOne(
        { _id: STATE_ID, keepAliveLockUntil: lockUntil },
        {
          $set: { lastKeepAliveAt: new Date() },
          $unset: { keepAliveLockUntil: "" },
        },
      );
      console.log("[KeepAlive] Render health ping successful");
    } catch (error) {
      // Release immediately on handled failures. If the process itself dies,
      // the Date-based lock expires after LOCK_TTL_MS.
      await collection.updateOne(
        { _id: STATE_ID, keepAliveLockUntil: lockUntil },
        { $unset: { keepAliveLockUntil: "" } },
      );
      console.error(
        "[KeepAlive] Render health ping failed:",
        error instanceof Error ? error.message : String(error),
      );
      process.exitCode = 1;
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    console.error(
      "[KeepAlive] Scheduler failed:",
      error instanceof Error ? error.message : String(error),
    );
    process.exitCode = 1;
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect().catch(() => undefined);
    }
  }
}

if (require.main === module) {
  void run();
}

module.exports = {
  STATE_ID,
  DEFAULT_THRESHOLD_MINUTES,
  buildLockFilter,
  shouldSendKeepAlive,
  run,
};
