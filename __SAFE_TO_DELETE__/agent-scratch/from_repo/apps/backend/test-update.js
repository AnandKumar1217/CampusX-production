import mongoose from "mongoose";
import { z } from "zod";

const uri = "mongodb://tammisettyanandkumar1_db_user:Anand1212@ac-mjnbmpl-shard-00-00.kebwkgr.mongodb.net:27017,ac-mjnbmpl-shard-00-01.kebwkgr.mongodb.net:27017,ac-mjnbmpl-shard-00-02.kebwkgr.mongodb.net:27017/campusx?ssl=true&authSource=admin&replicaSet=atlas-myy565-shard-0&appName=Cluster0";

const listingSchema = new mongoose.Schema({
  seller: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  title: { type: String, required: true, index: true },
  description: { type: String, maxlength: 4000 },
  category: { type: String, required: true, index: true },
  price: { type: Number, required: true, min: 0 },
  location: String,
});
const MarketplaceListing = mongoose.model("TestListing", listingSchema, "marketplacelistings");

async function main() {
  await mongoose.connect(uri);
  const id = "6ac0c992e54d6af99a6092aa"; // Extracted from DB output
  
  const input = z.object({
    title: z.string().min(3).max(180).optional(),
    description: z.string().max(4000).optional(),
    category: z.string().min(1).max(80).optional(),
    price: z.number().min(0).optional(),
    location: z.string().optional(),
  }).parse({
    category: "Furniture",
    location: "32, 5th Cross Road, Bengaluru, Karnataka",
    title: "Tyty updated",
  });

  const item = await MarketplaceListing.findOneAndUpdate(
    { _id: id },
    { $set: input },
    { new: true, runValidators: true }
  );
  
  console.log("Updated item:", item);
  process.exit(0);
}

main().catch(console.error);
