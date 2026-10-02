import fs from 'fs';
let content = fs.readFileSync('apps/mobile/src/screens/social/SocialScreens.tsx', 'utf8');

content = content.replace(/const postsCount = events\.filter.*\.length;\n  const connectionsCount = .*\n  const groupsCount = .*/,
  'const postsCount = stats.eventsCount || 0;\n  const connectionsCount = stats.friendsCount || 0;\n  const groupsCount = stats.groupsCount || 0;');

fs.writeFileSync('apps/mobile/src/screens/social/SocialScreens.tsx', content);
