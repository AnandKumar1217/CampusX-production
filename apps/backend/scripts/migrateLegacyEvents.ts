import "dotenv/config";
import mongoose from "mongoose";
import { Event } from "../src/models/Commerce.js";

async function run() {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI not set");
    }
    
    console.log("Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB.");

    console.log("Migrating legacy events (status missing, draft != true)...");
    const result = await Event.updateMany(
      { status: { $exists: false }, draft: { $ne: true } },
      { $set: { status: "active" } }
    );

    console.log(`Migration complete. Modified ${result.modifiedCount} events.`);
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

run();
