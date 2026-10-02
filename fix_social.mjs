import fs from 'fs';
let content = fs.readFileSync('apps/mobile/src/screens/social/SocialScreens.tsx', 'utf8');

content = content.replace(
  'api.get<{data: { received: any[], sent: any[]}}>("/friends/requests")\r\n    ])\r\n    .then(([userRes, reqRes]) => {',
  'api.get<{data: { received: any[], sent: any[]}}>("/friends/requests"),\n      api.get<{data: any}>(/users/\/profile-summary).catch(() => ({ data: { data: { eventsCount: 0, friendsCount: 0, groupsCount: 0 } } }))\n    ])\n    .then(([userRes, reqRes, statsRes]) => {'
);
content = content.replace(
  'api.get<{data: { received: any[], sent: any[]}}>("/friends/requests")\n    ])\n    .then(([userRes, reqRes]) => {',
  'api.get<{data: { received: any[], sent: any[]}}>("/friends/requests"),\n      api.get<{data: any}>(/users/\/profile-summary).catch(() => ({ data: { data: { eventsCount: 0, friendsCount: 0, groupsCount: 0 } } }))\n    ])\n    .then(([userRes, reqRes, statsRes]) => {'
);

content = content.replace(
  'setUser(u);\r\n\r\n      const isFriend',
  'setUser(u);\n      if (statsRes?.data?.data) setStats(statsRes.data.data);\n\n      const isFriend'
);
content = content.replace(
  'setUser(u);\n\n      const isFriend',
  'setUser(u);\n      if (statsRes?.data?.data) setStats(statsRes.data.data);\n\n      const isFriend'
);

content = content.replace(
  '  const postsCount = events.filter(e => e?.organizer?.id === user?.id).length + listings.filter(l => l?.seller?.id === user?.id).length;\r\n  const connectionsCount = user.id === currentUser?.id ? friends.length : (user.id.length * 14 + 42);\r\n  const groupsCount = user.id === currentUser?.id ? studyGroups.filter(g => g.joined).length : (user.id.length * 3 + 2);',
  '  const eventsCount = stats.eventsCount || 0;\n  const connectionsCount = stats.friendsCount || 0;\n  const groupsCount = stats.groupsCount || 0;'
);
content = content.replace(
  '  const postsCount = events.filter(e => e?.organizer?.id === user?.id).length + listings.filter(l => l?.seller?.id === user?.id).length;\n  const connectionsCount = user.id === currentUser?.id ? friends.length : (user.id.length * 14 + 42);\n  const groupsCount = user.id === currentUser?.id ? studyGroups.filter(g => g.joined).length : (user.id.length * 3 + 2);',
  '  const eventsCount = stats.eventsCount || 0;\n  const connectionsCount = stats.friendsCount || 0;\n  const groupsCount = stats.groupsCount || 0;'
);

content = content.replace(
  '[String(postsCount), "Posts"]',
  '[String(eventsCount), "Events"]'
);

fs.writeFileSync('apps/mobile/src/screens/social/SocialScreens.tsx', content);
console.log('Fixed UserProfileScreen stats');
