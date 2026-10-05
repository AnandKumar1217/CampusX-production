import mongoose from "mongoose";

const KEEP_ALIVE_THRESHOLD_MINUTES = parseInt(process.env.KEEP_ALIVE_THRESHOLD_MINUTES || "8");
const KEEP_ALIVE_THRESHOLD = KEEP_ALIVE_THRESHOLD_MINUTES * 60 * 1000;
const MONGO_URI = process.env.MONGO_URI;

async function run() {
  if (!MONGO_URI) {
    console.error("MONGO_URI environment variable is required.");
    process.exit(1);
  }

  try {
    await mongoose.connect(MONGO_URI);
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error("Database connection failed");
    }

    // Atomically grab a 60-second lock to prevent concurrent scheduler executions
    const now = Date.now();
    const lockResult = await db.collection("keepalivestates").findOneAndUpdate(
      {
        id: "global",
        $or: [
          { keepAliveLock: { $exists: false } },
          { keepAliveLock: { $lt: now - 60000 } }
        ]
      },
      {
        $set: { keepAliveLock: now },
        $setOnInsert: { lastRealUserActivity: 0, lastKeepAliveAt: 0 }
      },
      {
        upsert: true,
        returnDocument: "after"
      }
    );

    if (!lockResult) {
      console.log("[KeepAlive] Another scheduler instance is currently running or lock is held.");
      return;
    }

    // lockResult contains the document after upsert
    const lastRealUserActivity = lockResult.lastRealUserActivity || 0;
    const lastKeepAliveAt = lockResult.lastKeepAliveAt || 0;

    const inactivityDuration = now - lastRealUserActivity;
    const timeSinceLastPing = now - lastKeepAliveAt;

    if (inactivityDuration >= KEEP_ALIVE_THRESHOLD && timeSinceLastPing >= KEEP_ALIVE_THRESHOLD) {
      console.log(`[KeepAlive] CampusX idle for ${Math.floor(inactivityDuration / 60000)}m - sending health ping`);
      
      try {
        const response = await fetch("https://campusx-production.onrender.com/api/health", {
          method: "GET",
          signal: AbortSignal.timeout(10000)
        });
        
        if (response.ok) {
          console.log("[KeepAlive] Render health ping successful");
          await db.collection("keepalivestates").updateOne(
            { id: "global" },
            { $set: { lastKeepAliveAt: now } },
            { upsert: true }
          );
        } else {
          console.log(`[KeepAlive] Render health ping failed with status: ${response.status}`);
        }
      } catch (err) {
        console.log("[KeepAlive] Render health ping failed:", err instanceof Error ? err.message : String(err));
      }
    } else if (inactivityDuration < KEEP_ALIVE_THRESHOLD) {
      console.log("[KeepAlive] Users active - no ping required");
    } else {
      // Users inactive, but we recently pinged
    }
  } catch (err) {
    console.error("Scheduler error:", err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

run();
