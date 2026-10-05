import mongoose from "mongoose";
import dotenv from "dotenv";
import { User } from "../models/User.js";
import { Event, MarketplaceListing } from "../models/Commerce.js";
import { Post } from "../models/Social.js";
import { cleanupDeletedUserData } from "../services/deleteAccountService.js";

dotenv.config();

const MONGO_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/campusx";

async function runCleanup() {
  try {
    console.log("Connecting to database...");
    await mongoose.connect(MONGO_URI);
    console.log("Connected to database.");

    // 1. Find all events where creator does not exist in User collection
    console.log("Finding orphaned events...");
    const events = await Event.find().select("creator");
    const eventCreators = [...new Set(events.map(e => e.creator.toString()))];
    
    // 2. Find all listings where seller does not exist
    console.log("Finding orphaned listings...");
    const listings = await MarketplaceListing.find().select("seller");
    const listingSellers = [...new Set(listings.map(l => l.seller.toString()))];

    // 3. Find all posts where author does not exist
    console.log("Finding orphaned posts...");
    const posts = await Post.find().select("author");
    const postAuthors = [...new Set(posts.map(p => p.author.toString()))];

    const potentialOrphans = [...new Set([...eventCreators, ...listingSellers, ...postAuthors])];
    console.log(`Found ${potentialOrphans.length} unique users tied to content. Checking against Users collection...`);

    let orphansCleaned = 0;
    for (const userId of potentialOrphans) {
      const userExists = await User.exists({ _id: userId });
      if (!userExists) {
        console.log(`User ${userId} does not exist. Cleaning up orphaned data...`);
        await cleanupDeletedUserData(userId);
        orphansCleaned++;
      }
    }

    console.log(`Cleanup complete. Cleaned data for ${orphansCleaned} orphaned users.`);
    process.exit(0);
  } catch (err) {
    console.error("Error during cleanup script:", err);
    process.exit(1);
  }
}

runCleanup();
