const mongoose = require('mongoose');
const uri = 'mongodb://tammisettyanandkumar1_db_user:Anand1212@ac-mjnbmpl-shard-00-00.kebwkgr.mongodb.net:27017,ac-mjnbmpl-shard-00-01.kebwkgr.mongodb.net:27017,ac-mjnbmpl-shard-00-02.kebwkgr.mongodb.net:27017/campusx?ssl=true&authSource=admin&replicaSet=atlas-myy565-shard-0&appName=Cluster0';
mongoose.connect(uri).then(async () => {
  const db = mongoose.connection.db;
  const chat = await db.collection('conversations').find({}).limit(1).toArray();
  console.dir(chat, {depth: null});
  process.exit(0);
}).catch(console.error);