import mongoose from "mongoose";

const uri = "mongodb://tammisettyanandkumar1_db_user:Anand1212@ac-mjnbmpl-shard-00-00.kebwkgr.mongodb.net:27017,ac-mjnbmpl-shard-00-01.kebwkgr.mongodb.net:27017,ac-mjnbmpl-shard-00-02.kebwkgr.mongodb.net:27017/campusx?ssl=true&authSource=admin&replicaSet=atlas-myy565-shard-0&appName=Cluster0";

async function main() {
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  const listings = await db.collection("marketplacelistings").find({}).sort({ createdAt: -1 }).limit(1).toArray();
  console.log("Latest listing:");
  console.dir(listings, { depth: null });
  process.exit(0);
}

main().catch(console.error);
