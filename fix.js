const fs = require('fs');
const file = 'apps/mobile/src/screens/social/SocialScreens.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  'const [friendState, setFriendState] = useState<"none" | "pending" | "friends">("none");',
  'const [friendState, setFriendState] = useState<"none" | "pending" | "friends">("none");\n  const [stats, setStats] = useState({ eventsCount: 0, friendsCount: 0, groupsCount: 0 });'
);

const oldFetch = `  const fetchProfileData = () => {
    Promise.all([
      api.get<{data: any}>(\`/users/\${route.params.userId}\`),
      api.get<{data: { received: any[], sent: any[]}}>("/friends/requests")
    ])
    .then(([userRes, reqRes]) => {
      const u = userRes.data.data;
      if (u.avatarUrl) u.avatar = u.avatarUrl;
      u.id = u._id || route.params.userId;
      setUser(u);

      const isFriend = useAppStore.getState().friends.some(f => f.id === u.id);
      if (isFriend) {
        setFriendState("friends");
      } else {
        const isSent = reqRes.data.data.sent.some(r => r.recipient._id === u.id || r.recipient.id === u.id);
        const isReceived = reqRes.data.data.received.some(r => r.requester._id === u.id || r.requester.id === u.id);
        if (isSent || isReceived) {
          setFriendState("pending");
        } else {
          setFriendState("none");
        }
      }
    })`;

const newFetch = `  const fetchProfileData = () => {
    api.get<{data: any}>(\`/users/\${route.params.userId}/profile-summary\`)
    .then((res) => {
      const { user: u, stats: s, friendshipStatus: status } = res.data.data;
      if (u.avatarUrl) u.avatar = u.avatarUrl;
      u.id = u._id || route.params.userId;
      setUser(u);

      if (s) {
        setStats({
          eventsCount: s.eventsCount || 0,
          friendsCount: s.friendsCount || 0,
          groupsCount: s.groupsCount || 0,
        });
      }

      if (status === "FRIENDS" || status === "SELF") {
        setFriendState("friends");
      } else if (status === "OUTGOING" || status === "INCOMING") {
        setFriendState("pending");
      } else {
        setFriendState("none");
      }
    })`;

content = content.replace(oldFetch, newFetch);

const oldStats = `  const postsCount = events.filter(e => e?.organizer?.id === user?.id).length + listings.filter(l => l?.seller?.id === user?.id).length;
  const connectionsCount = user.id === currentUser?.id ? friends.length : (user.id.length * 14 + 42);
  const groupsCount = user.id === currentUser?.id ? studyGroups.filter(g => g.joined).length : (user.id.length * 3 + 2);`;

const newStats = `  const eventsCount = stats.eventsCount;
  const connectionsCount = stats.friendsCount;
  const groupsCount = stats.groupsCount;`;

content = content.replace(oldStats, newStats);

content = content.replace(
  /<CXText variant="h4">\{postsCount\}<\/CXText>\s*<CXText variant="caption" color=\{colors\.textMuted\}>\s*Posts\s*<\/CXText>/g,
  '<CXText variant="h4">{eventsCount}</CXText>\n              <CXText variant="caption" color={colors.textMuted}>\n                Events\n              </CXText>'
);

fs.writeFileSync(file, content);
console.log('done');
