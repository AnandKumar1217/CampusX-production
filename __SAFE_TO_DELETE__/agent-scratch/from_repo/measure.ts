import mongoose from "mongoose";
import { MarketplaceListing } from "./apps/backend/src/models/Commerce.js";
import { env } from "./apps/backend/src/config/env.js";

async function run() {
  await mongoose.connect(env.MONGODB_URI);
  console.log("Connected to DB");
  
  // Drop old text index if it exists
  try {
    await MarketplaceListing.collection.dropIndex("title_text_description_text");
    console.log("Old text index dropped");
  } catch (e) {}

  await MarketplaceListing.syncIndexes();
  console.log("Indexes synced");
  
  // Run explains
  const explains: any = {};
  const timings: any = {};
  
  // A. Default Feed
  let start = performance.now();
  let items = await MarketplaceListing.find({ status: "available" })
    .populate("seller", "name username avatarUrl")
    .select("-description -images")
    .sort({ createdAt: -1, _id: -1 })
    .limit(16)
    .lean();
  timings.feed = performance.now() - start;
  
  let explain = await MarketplaceListing.find({ status: "available" }).sort({ createdAt: -1, _id: -1 }).limit(16).explain("executionStats");
  explains.feed = explain;
  
  // B. Category Filtered
  start = performance.now();
  await MarketplaceListing.find({ status: "available", category: "Electronics" })
    .sort({ createdAt: -1, _id: -1 })
    .limit(16)
    .lean();
  timings.category = performance.now() - start;
  
  explain = await MarketplaceListing.find({ status: "available", category: "Electronics" }).sort({ createdAt: -1, _id: -1 }).limit(16).explain("executionStats");
  explains.category = explain;
  
  // C. Price Sort
  start = performance.now();
  await MarketplaceListing.find({ status: "available" })
    .sort({ price: 1, _id: 1 })
    .limit(16)
    .lean();
  timings.price = performance.now() - start;
  
  explain = await MarketplaceListing.find({ status: "available" }).sort({ price: 1, _id: 1 }).limit(16).explain("executionStats");
  explains.price = explain;
  
  // D. Seller + Status
  const fakeUserId = new mongoose.Types.ObjectId();
  start = performance.now();
  await MarketplaceListing.find({ seller: fakeUserId, status: { $in: ["available", "reserved"] } })
    .sort({ createdAt: -1, _id: -1 })
    .limit(16)
    .lean();
  timings.seller = performance.now() - start;
  
  explain = await MarketplaceListing.find({ seller: fakeUserId, status: { $in: ["available", "reserved"] } }).sort({ createdAt: -1, _id: -1 }).limit(16).explain("executionStats");
  explains.seller = explain;
  
  // E. Search
  start = performance.now();
  await MarketplaceListing.find({ status: "available", $text: { $search: "laptop" } })
    .sort({ score: { $meta: "textScore" } })
    .limit(16)
    .lean();
  timings.search = performance.now() - start;
  
  explain = await MarketplaceListing.find({ status: "available", $text: { $search: "laptop" } }).limit(16).explain("executionStats");
  explains.search = explain;
  
  // Detail
  start = performance.now();
  const detail = await MarketplaceListing.findById(new mongoose.Types.ObjectId())
      .populate("seller", "name username avatarUrl verified")
      .lean();
  timings.detail = performance.now() - start;
  
  // Calculate Payload sizes
  const payloadSize = Buffer.byteLength(JSON.stringify(items));
  
  console.log("PAYLOAD_SIZE:", payloadSize);
  console.log("TIMINGS:", JSON.stringify(timings, null, 2));
  
  function extractStats(name, ex) {
    if (!ex[0] || !ex[0].executionStats) return;
    const stats = ex[0].executionStats;
    const plan = stats.executionStages ? stats.executionStages.stage : "UNKNOWN";
    const indexName = stats.executionStages ? stats.executionStages.indexName : "UNKNOWN";
    console.log(\`\n--- \${name} EXPLAIN ---\`);
    console.log("winningPlan:", plan);
    console.log("indexName:", indexName);
    console.log("docsExamined:", stats.totalDocsExamined);
    console.log("keysExamined:", stats.totalKeysExamined);
    console.log("nReturned:", stats.nReturned);
  }
  
  extractStats("FEED", explains.feed);
  extractStats("CATEGORY", explains.category);
  extractStats("PRICE", explains.price);
  extractStats("MY LISTINGS", explains.seller);
  extractStats("SEARCH", explains.search);
  
  await mongoose.disconnect();
}
run().catch(console.error);
