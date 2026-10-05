const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'apps/mobile/src/screens/commerce/CommerceScreens.tsx');
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(/queryKey: \["listings", userStore\?\.id\]/g, 'queryKey: marketplaceKeys.feed()');
content = content.replace(/queryKey: \["savedListings"\]/g, 'queryKey: marketplaceKeys.saved()');
content = content.replace(/queryKey: \["listing", route\.params\.listingId\]/g, 'queryKey: marketplaceKeys.detail(route.params.listingId)');
content = content.replace(/queryKey: \["listings"\]/g, 'queryKey: marketplaceKeys.feed()');
content = content.replace(/queryKey: \["myListings"\]/g, 'queryKey: marketplaceKeys.myListings()');
content = content.replace(/queryKey: \["listing", editId\]/g, 'queryKey: marketplaceKeys.detail(editId)');

fs.writeFileSync(filePath, content, 'utf8');
console.log('Replaced query keys');
