import fs from 'fs';
let content = fs.readFileSync('apps/mobile/src/screens/social/SocialScreens.tsx', 'utf8');

const peopleScreenMatch = /export function PeopleScreen\(\{ navigation \}: StackProps<"People">\)\s*\{\s*return \(\s*<UsersDirectoryPage\s*navigation=\{navigation as StackProps<"Friends">\\["navigation"\\]\}\s*title="People"\s*\/>\s*\);\s*\}/s;

const newPeopleScreen = \xport function PeopleScreen({ navigation }: StackProps<"People">) {
  const [requests, setRequests] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const addFriend = useAppStore(state => state.addFriend);
  const currentUser = useAppStore(state => state.user);
  
  const fetchPeopleData = async () => {
    try {
      const [reqRes, sugRes] = await Promise.all([
        api.get<any>("/friends/requests"),
        api.get<any>("/users/search", { params: { limit: 10 } })
      ]);
      
      const mappedReqs = reqRes.data.data.received.map((req: any) => ({
        id: req.requester._id || req.requester.id,
        name: req.requester.name,
        username: req.requester.username,
        avatar: req.requester.avatarUrl,
        department: req.requester.department,
        college: req.requester.college,
      }));
      setRequests(mappedReqs);

      const friendsIds = useAppStore.getState().friends.map(f => f.id);
      const reqIds = mappedReqs.map((r: any) => r.id);
      const mappedSugs = sugRes.data.data.items
        .filter((u: any) => u.id !== currentUser?.id && !friendsIds.includes(u.id) && !reqIds.includes(u.id))
        .map((user: any) => ({
          ...user,
          id: user.id ?? user._id,
          avatar: user.avatarUrl ?? undefined,
        }));
      setSuggestions(mappedSugs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPeopleData();
    const socket = require("@/services/socket").getSocket();
    if (socket) {
      socket.on("friend:request", fetchPeopleData);
      socket.on("friend:accepted", fetchPeopleData);
      socket.on("friend:removed", fetchPeopleData);
      socket.on("friend:request_cancelled", fetchPeopleData);
      socket.on("friend:request_rejected", fetchPeopleData);

      return () => {
        socket.off("friend:request", fetchPeopleData);
        socket.off("friend:accepted", fetchPeopleData);
        socket.off("friend:removed", fetchPeopleData);
        socket.off("friend:request_cancelled", fetchPeopleData);
        socket.off("friend:request_rejected", fetchPeopleData);
      };
    }
  }, []);

  const decide = (user: any, accept: boolean) => {
    setRequests((items) => items.filter((item) => item.id !== user.id));
    if (accept) {
      addFriend({
        id: user.id,
        name: user.name,
        username: user.username,
        avatarUrl: user.avatar,
      });
    }
    void api
      .post(\/friends/requests/\/\\)
      .catch(() => {
        setRequests((items) => [user, ...items]);
      });
  };

  return (
    <CXScreen>
      <CXHeader title="People" />
      <ScrollView contentContainerStyle={styles.page}>
        
        {requests.length > 0 && (
          <>
            <CXSectionHeader title={\Requests (\)\} action="See All" onAction={() => navigation.navigate("FriendRequests")} />
            {requests.slice(0, 3).map((user) => (
              <Pressable key={user.id} onPress={() => navigation.navigate("UserProfile", { userId: user.id })}>
                <CXRow style={styles.request}>
                  <CXAvatar source={user.avatar} name={user.name} />
                  <View style={styles.flex}>
                    <CXText variant="bodyStrong">{user.name}</CXText>
                    <CXText variant="caption" color={colors.textMuted}>
                      {user.department}
                    </CXText>
                  </View>
                  <View style={styles.requestActions}>
                    <CXButton label="Accept" size="sm" fullWidth={false} onPress={() => decide(user, true)} />
                    <CXButton label="Decline" size="sm" variant="ghost" fullWidth={false} onPress={() => decide(user, false)} />
                  </View>
                </CXRow>
              </Pressable>
            ))}
          </>
        )}

        <CXSectionHeader title="Suggested People" action="See All" onAction={() => navigation.navigate("GlobalUsers")} />
        
        <CXRow style={{ marginHorizontal: spacing.md, marginBottom: spacing.md }}>
          <CXButton 
            label="Search all users" 
            variant="secondary" 
            iconLeft="search" 
            onPress={() => navigation.navigate("GlobalUsers")} 
          />
        </CXRow>
        
        {suggestions.map((user) => (
          <Pressable key={user.id} onPress={() => navigation.navigate("UserProfile", { userId: user.id })}>
            <CXRow style={styles.request}>
              <CXAvatar source={user.avatar} name={user.name} />
              <View style={styles.flex}>
                <CXText variant="bodyStrong">{user.name}</CXText>
                <CXText variant="caption" color={colors.textMuted}>
                  {user.department}
                </CXText>
              </View>
            </CXRow>
          </Pressable>
        ))}
        {loading && <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />}
      </ScrollView>
    </CXScreen>
  );
}\;

if (peopleScreenMatch.test(content)) {
  content = content.replace(peopleScreenMatch, newPeopleScreen);
  fs.writeFileSync('apps/mobile/src/screens/social/SocialScreens.tsx', content);
  console.log('Replaced PeopleScreen successfully.');
} else {
  console.error('Could not find PeopleScreen match.');
}
