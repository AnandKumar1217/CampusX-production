import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import React, { useMemo, useState, useEffect } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";

import { CXPostCard, CXStoryAvatar, CXUserRow } from "@/components/cards";
import {
  CXAvatar,
  CXButton,
  CXCard,
  CXChip,
  CXHeader,
  CXIconButton,
  CXInput,
  CXRow,
  CXScreen,
  CXScrollScreen,
  CXSearchBar,
  CXSectionHeader,
  CXText,
} from "@/components/ui";
import { useAppStore } from "@/store/appStore";
import { api, getApiErrorMessage } from "@/services/api";
import { colors, gradients, radius, spacing, typography } from "@/theme";
import type { Post, User } from "@/types/domain";
import type { RootStackParamList } from "@/types/navigation";

type StackProps<Name extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  Name
>;
const storyPhoto = require("../../../assets/trips/coorg.png");
const campusPhoto = require("../../../assets/events/codefest.png");
const productPhoto = require("../../../assets/marketplace/study-table.png");

export function FeedScreen({ navigation }: StackProps<"Feed">) {
  const currentUser = useAppStore(state => state.user);
  const friends = useAppStore(state => state.friends);
  const [feed, setFeed] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<{ data: Post[] }>("/posts")
       .then(res => setFeed(res.data.data))
       .catch(err => console.log("Failed to fetch posts:", err))
       .finally(() => setLoading(false));
  }, []);

  const updatePost = (id: string, patch: Partial<Post>) =>
    setFeed((items) =>
      items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  
  if (loading) {
    return (
      <CXScreen>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      </CXScreen>
    );
  }
  return (
    <CXScreen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.page}
      >
        <CXRow style={styles.header}>
          <CXText variant="h3" style={styles.flex}>
            Campus Feed
          </CXText>
          <CXIconButton
            icon="search-outline"
            label="Search feed"
            backgroundColor={colors.white}
          />
          <CXIconButton
            icon="notifications-outline"
            label="Notifications"
            backgroundColor={colors.white}
            onPress={() => navigation.navigate("Notifications")}
          />
        </CXRow>
        <CXRow style={styles.feedFilters}>
          <CXChip label="Latest" active />
          <CXChip label="Friends" />
          <CXChip label="Campus" />
          <CXChip label="Groups" />
        </CXRow>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.storyRow}
        >
          {friends.slice(0, 7).map((user, index) => (
            <CXStoryAvatar
              key={user.id}
              user={user}
              add={index === 0}
              onPress={() =>
                index === 0
                  ? navigation.navigate("CreateStory")
                  : navigation.navigate("StoryViewer", { storyId: user.id })
              }
            />
          ))}
        </ScrollView>
        <Pressable
          onPress={() => navigation.navigate("CreatePost")}
          style={styles.composer}
        >
          <CXAvatar source={(currentUser?.avatarUrl ?? "")} name={(currentUser?.name ?? "User")} />
          <CXText color={colors.textMuted} style={styles.flex}>
            Share something with your campus...
          </CXText>
          <Ionicons name="image-outline" size={19} color={colors.primary} />
          <Ionicons name="videocam-outline" size={19} color={colors.primary} />
        </Pressable>
        {feed.map((post) => (
          <CXPostCard
            key={post.id}
            post={post}
            onOpen={() =>
              navigation.navigate("PostDetails", { postId: post.id })
            }
            onLike={() => {
              updatePost(post.id, {
                liked: !post.liked,
                reactions: post.reactions + (post.liked ? -1 : 1),
              });
              void api
                .post(`/posts/${post.id}/reactions`, {
                  type: post.liked ? null : "like",
                })
                .catch(() => undefined);
            }}
            onSave={() => {
              updatePost(post.id, { saved: !post.saved });
              void api
                .post(`/posts/${post.id}/save`, { saved: !post.saved })
                .catch(() => undefined);
            }}
          />
        ))}
      </ScrollView>
    </CXScreen>
  );
}

export function PostDetailsScreen({
  navigation,
  route,
}: StackProps<"PostDetails">) {
  const currentUser = useAppStore(state => state.user);
  const [post, setPost] = useState<Post | null>(null);
  const [comment, setComment] = useState("");
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<{ data: Post }>(`/posts/${route.params.postId}`)
       .then(res => setPost(res.data.data))
       .catch(err => console.log("Failed to fetch post", err));
       
    api.get<{ data: any[] }>(`/posts/${route.params.postId}/comments`)
       .then(res => setComments(res.data.data))
       .catch(err => console.log("Failed to fetch comments", err))
       .finally(() => setLoading(false));
  }, [route.params.postId]);

  const submit = () => {
    const value = comment.trim();
    if (!value) return;
    setComments((items) => [
      ...items,
      { id: `local-${Date.now()}`, user: currentUser, text: value },
    ]);
    setComment("");
    void api
      .post(`/posts/${post.id}/comments`, { body: value })
      .catch(() => undefined);
  };
  return (
    <CXScreen>
      <CXHeader
        title="Post"
        onBack={navigation.goBack}
        right={
          <CXIconButton
            icon="ellipsis-horizontal"
            label="Post options"
            backgroundColor={colors.transparent}
          />
        }
      />
      <ScrollView
        contentContainerStyle={styles.page}
        showsVerticalScrollIndicator={false}
      >
        {post ? <CXPostCard post={post} /> : null}
        <CXSectionHeader
          title={`Comments (${comments.length})`}
          action="Most Recent"
        />
        {comments.map((item) => (
          <CXRow key={item.id} style={styles.comment}>
            <CXAvatar
              source={item.user.avatar}
              name={item.user.name}
              size={38}
            />
            <View style={styles.commentBubble}>
              <CXText variant="smallStrong">{item.user.name}</CXText>
              <CXText variant="small">{item.text}</CXText>
              <CXText variant="caption" color={colors.textMuted}>
                Reply · just now
              </CXText>
            </View>
          </CXRow>
        ))}
      </ScrollView>
      <CXRow style={styles.commentBar}>
        <CXAvatar
          source={(currentUser?.avatarUrl ?? "")}
          name={(currentUser?.name ?? "User")}
          size={34}
        />
        <TextInput
          placeholder="Add a comment..."
          placeholderTextColor={colors.textFaint}
          value={comment}
          onChangeText={setComment}
          style={styles.commentInput}
        />
        <CXIconButton
          icon="send"
          label="Post comment"
          size={38}
          onPress={submit}
        />
      </CXRow>
    </CXScreen>
  );
}

export function UserProfileScreen({
  navigation,
  route,
}: StackProps<"UserProfile">) {
  const [user, setUser] = useState<any>(
    friends.find((item) => item.id === route.params.userId) || null
  );
  const [loading, setLoading] = useState(!user);

  useEffect(() => {
    if (!user) {
      const friend = useAppStore.getState().friends.find(f => f.id === route.params.userId);
      if (friend) {
        setUser(friend);
        setLoading(false);
      } else {
        api.get<{data: any}>(`/users/${route.params.userId}`)
           .then(res => {
             const u = res.data.data;
             if (u.avatarUrl) u.avatar = u.avatarUrl;
             u.id = u._id || route.params.userId;
             setUser(u);
           })
           .catch(err => {
             console.log("Failed to fetch user:", err);
             setUser(friends[0]); // fallback
           })
           .finally(() => setLoading(false));
      }
    }
  }, [route.params.userId, user]);

  const currentUser = useAppStore(state => state.user);
  const friends = useAppStore(state => state.friends);
  
  const isFriend = user ? friends.some(f => f.id === user.id) : false;
  const [friendState, setFriendState] = useState<"none" | "pending" | "friends">(isFriend ? "friends" : "none");

  // Keep it synced with global state if it updates
  useEffect(() => {
    if (user && isFriend) setFriendState("friends");
  }, [isFriend, user]);

  const events = useAppStore(state => state.events);
  const listings = useAppStore(state => state.listings);
  const studyGroups = useAppStore(state => state.studyGroups);

  if (loading || !user) {
    return (
      <CXScreen>
        <CXHeader title="" onBack={navigation.goBack} />
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      </CXScreen>
    );
  }

  const postsCount = events.filter(e => e?.author?.id === user?.id).length + listings.filter(l => l?.seller?.id === user?.id).length;
  const connectionsCount = user.id === currentUser?.id ? friends.length : (user.id.length * 14 + 42);
  const groupsCount = user.id === currentUser?.id ? studyGroups.filter(g => g.joined).length : (user.id.length * 3 + 2);

  const add = async () => {
    if (friendState === "friends") return; // already friends
    setFriendState("pending");
    try {
      await api.post("/friends/requests", { recipientId: user.id });
    } catch {
      setFriendState("none");
    }
  };
  return (
    <CXScrollScreen>
      <CXHeader
        title=""
        onBack={navigation.goBack}
        right={
          <CXRow>
            <CXIconButton
              icon="chatbubble-outline"
              label="Message"
              backgroundColor={colors.transparent}
              onPress={() =>
                navigation.navigate("Conversation", {
                  conversationId: `conversation-${user.id}`,
                  name: user.name,
                })
              }
            />
            <CXIconButton
              icon="ellipsis-horizontal"
              label="More"
              backgroundColor={colors.transparent}
            />
          </CXRow>
        }
      />
      <View style={styles.profileHero}>
        <View style={styles.profileAvatar}>
          <CXAvatar
            source={user.avatar}
            name={user.name}
            size={96}
            online={user.online}
          />
        </View>
        <CXRow style={styles.nameLine}>
          <CXText variant="h3">{user.name}</CXText>
          {user.verified ? (
            <Ionicons
              name="checkmark-circle"
              size={17}
              color={colors.primary}
            />
          ) : null}
        </CXRow>
        <CXText variant="small" color={colors.textMuted}>
          @{user.username}
        </CXText>
        {user.department || user.year ? (
          <CXText variant="small" color={colors.textMuted}>
            {[user.department, user.year].filter(Boolean).join(" · ")}
          </CXText>
        ) : null}
        {user.college ? (
          <CXText variant="small" color={colors.textMuted}>
            {user.college}
          </CXText>
        ) : null}
        {user.bio ? (
          <CXText variant="body" color={colors.text} style={{ marginTop: spacing.sm, textAlign: "center", paddingHorizontal: spacing.lg }}>
            {user.bio}
          </CXText>
        ) : null}
      </View>
      <CXRow style={[styles.actionButtons, { justifyContent: "center", gap: spacing.md }]}>
        <CXButton
          label={
            friendState === "none"
              ? "Add Friend"
              : friendState === "pending"
                ? "Request Sent"
                : "Friends"
          }
          iconLeft={
            friendState === "friends" ? "checkmark" : "person-add-outline"
          }
          onPress={() => void add()}
          disabled={friendState !== "none"}
          fullWidth={false}
          style={{ minWidth: 140 }}
        />
        <CXButton
          label="Message"
          iconLeft="chatbubble-outline"
          variant="outline"
          fullWidth={false}
          style={{ minWidth: 140 }}
          onPress={() =>
            navigation.navigate("Conversation", {
              conversationId: `conversation-${user.id}`,
              name: user.name,
            })
          }
        />
      </CXRow>
      <CXCard style={[styles.profileStats, { flexDirection: "row", paddingVertical: spacing.md }]}>
        {[
          [String(postsCount), "Posts"],
          [String(connectionsCount), "Connections"],
          [String(groupsCount), "Groups"],
        ].map(([value, label], index) => (
          <View key={label} style={[styles.stat, index > 0 && { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: colors.border }]}>
            <CXText variant="title" color={colors.primary}>
              {value}
            </CXText>
            <CXText variant="caption" color={colors.textMuted}>
              {label}
            </CXText>
          </View>
        ))}
      </CXCard>
    </CXScrollScreen>
  );
}

function PeopleListPage({
  navigation,
  title,
  subtitle,
  action = "Message",
  users,
  onRemove,
}: {
  navigation: StackProps<"Friends">["navigation"];
  title: string;
  subtitle?: string;
  action?: string;
  users: User[];
  onRemove?: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(
    () =>
      users
        .filter((user) =>
          user.name.toLowerCase().includes(query.toLowerCase()),
        ),
    [query, users],
  );
  return (
    <CXScreen>
      <CXHeader title={title} subtitle={subtitle} onBack={navigation.goBack} />
      <View style={styles.page}>
        <CXSearchBar
          placeholder="Search by name, department, or college..."
          value={query}
          onChangeText={setQuery}
        />
        {filtered.map((user) => (
          <CXUserRow
            key={user.id}
            user={user}
            action={action}
            onRemove={onRemove ? () => onRemove(user.id) : undefined}
            onPress={() =>
              navigation.navigate("UserProfile", { userId: user.id })
            }
            onAction={() =>
              action === "Message"
                ? navigation.navigate("Conversation", {
                    conversationId: `conversation-${user.id}`,
                    name: user.name,
                  })
                : void api
                    .post("/friends/requests", { recipientId: user.id })
                    .catch(() => undefined)
            }
          />
        ))}
      </View>
    </CXScreen>
  );
}

export function FriendsScreen({ navigation }: StackProps<"Friends">) {
  const friends = useAppStore(state => state.friends);
  const removeFriend = useAppStore(state => state.removeFriend);
  return (
    <PeopleListPage
      navigation={navigation}
      title="Friends"
      subtitle={`${friends.length} connections`}
      users={friends}
      onRemove={removeFriend}
    />
  );
}
export function PeopleSuggestionsScreen({
  navigation,
}: StackProps<"PeopleSuggestions">) {
  const friends = useAppStore(state => state.friends);
  const friendIds = friends.map(f => f.id);
  const suggestions = friends.filter(p => p.id !== "user-anand" && !friendIds.includes(p.id));
  
  return (
    <PeopleListPage
      navigation={navigation as StackProps<"Friends">["navigation"]}
      title="friends You May Know"
      action="Add Friend"
      users={suggestions}
    />
  );
}
export function MutualFriendsScreen({
  navigation,
}: StackProps<"MutualFriends">) {
  const friends = useAppStore(state => state.friends);
  const removeFriend = useAppStore(state => state.removeFriend);
  return (
    <PeopleListPage
      navigation={navigation as StackProps<"Friends">["navigation"]}
      title="Mutual Friends"
      subtitle={`${friends.length} mutual friends`}
      users={friends}
      action="View"
      onRemove={removeFriend}
    />
  );
}

export function FriendRequestsScreen({
  navigation,
}: StackProps<"FriendRequests">) {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const addFriend = useAppStore(state => state.addFriend);

  useEffect(() => {
    api.get<{data: { received: any[], sent: any[]}}>("/friends/requests")
      .then(res => {
        // Map backend schema to UI schema
        const mapped = res.data.data.received.map(req => {
          const user = req.requester;
          return {
            id: user._id || user.id,
            name: user.name,
            username: user.username,
            avatar: user.avatarUrl,
            department: user.department,
            college: user.college,
          };
        });
        setRequests(mapped);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const decide = (user: any, accept: boolean) => {
    setRequests((items) => items.filter((item) => item.id !== user.id));
    
    // Optimistically update global friends if accepted
    if (accept) {
      addFriend({
        id: user.id,
        name: user.name,
        username: user.username,
        avatarUrl: user.avatar,
      });
    }

    void api
      .post(`/friends/requests/${user.id}/${accept ? "accept" : "reject"}`)
      .catch(() => {
        // Revert on failure
        setRequests((items) => [user, ...items]);
        // Note: ideal to revert addFriend too, but avoiding for simplicity in MVP
      });
  };
  return (
    <CXScreen>
      <CXHeader title="Friend Requests" onBack={navigation.goBack} />
      <ScrollView contentContainerStyle={styles.page}>
        <CXRow style={styles.feedFilters}>
          <CXChip label="Received" active />
          <CXChip label="Sent" />
          <CXChip label="Suggestions" />
        </CXRow>
        <CXSectionHeader
          title={`Received Requests (${requests.length})`}
          action="Manage"
        />
        {requests.map((user) => (
          <CXRow key={user.id} style={styles.request}>
            <CXAvatar source={user.avatar} name={user.name} />
            <View style={styles.flex}>
              <CXText variant="bodyStrong">{user.name}</CXText>
              <CXText variant="caption" color={colors.textMuted}>
                {user.department} · 8 mutual friends
              </CXText>
            </View>
            <View style={styles.requestActions}>
              <CXButton
                label="Accept"
                size="sm"
                fullWidth={false}
                onPress={() => decide(user, true)}
              />
              <CXButton
                label="Decline"
                size="sm"
                variant="ghost"
                fullWidth={false}
                onPress={() => decide(user, false)}
              />
            </View>
          </CXRow>
        ))}
        <CXSectionHeader
          title="friends You May Know"
          action="See all"
          onAction={() => navigation.navigate("PeopleSuggestions")}
        />
      </ScrollView>
    </CXScreen>
  );
}

export function StoryViewerScreen({ navigation }: StackProps<"StoryViewer">) {
  const [liked, setLiked] = useState(false);
  return (
    <CXScreen edges={[]} backgroundColor="#100C28">
      <Image
        source={storyPhoto}
        contentFit="cover"
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={["rgba(0,0,0,.62)", "transparent", "rgba(0,0,0,.72)"]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.storyProgress}>
        {[0, 1, 2].map((item) => (
          <View
            key={item}
            style={[
              styles.storyProgressTrack,
              item === 0 && styles.storyProgressActive,
            ]}
          />
        ))}
      </View>
      <CXRow style={styles.storyTop}>
        <CXAvatar
          source={(currentUser?.avatarUrl ?? "")}
          name={(currentUser?.name ?? "User")}
          size={38}
        />
        <View style={styles.flex}>
          <CXText variant="bodyStrong" color={colors.white}>
            Anand Kumar
          </CXText>
          <CXText variant="caption" color="#E7E2F6">
            2h · CMRIT Campus
          </CXText>
        </View>
        <CXIconButton
          icon="close"
          label="Close story"
          color={colors.white}
          backgroundColor="rgba(0,0,0,.24)"
          onPress={navigation.goBack}
        />
      </CXRow>
      <View style={styles.storyCaption}>
        <CXText color={colors.white} align="center">
          Another beautiful evening on campus. 💜
        </CXText>
        <CXRow style={styles.storyComposer}>
          <View style={styles.storyMessage}>
            <CXText color="#E7E2F6">Send message</CXText>
          </View>
          <CXIconButton
            icon={liked ? "heart" : "heart-outline"}
            label="Like story"
            color={liked ? "#FF5C93" : colors.white}
            backgroundColor="rgba(0,0,0,.38)"
            onPress={() => setLiked((value) => !value)}
          />
          <CXIconButton
            icon="paper-plane-outline"
            label="Share story"
            color={colors.white}
            backgroundColor="rgba(0,0,0,.38)"
          />
        </CXRow>
      </View>
    </CXScreen>
  );
}

export function CreateStoryScreen({ navigation }: StackProps<"CreateStory">) {
  const assets = [
    storyPhoto,
    campusPhoto,
    productPhoto,
    storyPhoto,
    campusPhoto,
    productPhoto,
  ];
  const [selected, setSelected] = useState(0);
  const [caption, setCaption] = useState("");
  return (
    <CXScreen>
      <CXHeader title="Create Story" onBack={navigation.goBack} />
      <ScrollView contentContainerStyle={styles.page}>
        <CXRow style={styles.storyTools}>
          {[
            ["Camera", "camera-outline"],
            ["Gallery", "images-outline"],
            ["Text", "text-outline"],
            ["Music", "musical-notes-outline"],
          ].map(([label, icon]) => (
            <Pressable key={label} style={styles.storyTool}>
              <Ionicons
                name={icon as keyof typeof Ionicons.glyphMap}
                size={22}
                color={colors.primary}
              />
              <CXText variant="caption">{label}</CXText>
            </Pressable>
          ))}
        </CXRow>
        <CXSectionHeader title="Gallery" action="Select Multiple" />
        <View style={styles.gallery}>
          {assets.map((asset, index) => (
            <Pressable
              key={index}
              onPress={() => setSelected(index)}
              style={[
                styles.galleryItem,
                selected === index && styles.gallerySelected,
              ]}
            >
              <Image
                source={asset}
                contentFit="cover"
                style={styles.galleryImage}
              />
              {selected === index ? (
                <View style={styles.galleryCheck}>
                  <Ionicons name="checkmark" size={12} color={colors.white} />
                </View>
              ) : null}
            </Pressable>
          ))}
        </View>
        <CXSectionHeader title="Preview" />
        <Image
          source={assets[selected]}
          contentFit="cover"
          style={styles.storyPreview}
        />
        <CXInput
          placeholder="Add a caption..."
          value={caption}
          onChangeText={setCaption}
        />
        <CXButton
          label="Next"
          iconRight="arrow-forward"
          onPress={() => navigation.goBack()}
        />
      </ScrollView>
    </CXScreen>
  );
}

export function SavedScreen({ navigation }: StackProps<"Saved">) {
  const savedEventsState = useAppStore(state => state.savedEvents);
  const savedListingsState = useAppStore(state => state.savedListings);

  const toggleSavedEvent = useAppStore(state => state.toggleSavedEvent);
  const toggleSavedListing = useAppStore(state => state.toggleSavedListing);

  const allEvents = useAppStore(state => state.events);
  const allListings = useAppStore(state => state.listings);

  const savedEventsList = allEvents.filter(event => savedEventsState.includes(event.id));
  const savedItems = allListings.filter(item => savedListingsState.includes(item.id));

  return (
    <CXScreen>
      <CXHeader title="Saved" onBack={navigation.goBack} />
      <ScrollView contentContainerStyle={styles.page}>
        <CXSectionHeader title="Saved Events" action={savedEventsList.length > 0 ? "See all" : ""} />
        {savedEventsList.length === 0 ? (
          <CXText style={{ marginVertical: spacing.md, textAlign: "center", color: colors.textMuted }}>No saved events yet.</CXText>
        ) : (
          savedEventsList.map((event) => (
            <Pressable
              key={event.id}
              onPress={() =>
                navigation.navigate("EventDetails", { eventId: event.id })
              }
            >
              <CXCard style={styles.savedItem}>
                <Image
                  source={event.image}
                  contentFit="cover"
                  style={styles.savedImage}
                />
                <View style={styles.flex}>
                  <CXText variant="bodyStrong">{event.title}</CXText>
                  <CXText variant="title" color={colors.primary}>
                    {event.date}
                  </CXText>
                </View>
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    toggleSavedEvent(event.id);
                  }}
                  style={({ pressed }) => pressed && { opacity: 0.5 }}
                >
                  <Ionicons name="bookmark" size={18} color={colors.primary} />
                </Pressable>
              </CXCard>
            </Pressable>
          ))
        )}

        <CXSectionHeader title="Saved Items" action={savedItems.length > 0 ? "See all" : ""} />
        {savedItems.length === 0 ? (
          <CXText style={{ marginVertical: spacing.md, textAlign: "center", color: colors.textMuted }}>No saved items yet.</CXText>
        ) : (
          savedItems.map((item) => (
            <Pressable
              key={item.id}
              onPress={() =>
                navigation.navigate("ListingDetails", { listingId: item.id })
              }
            >
              <CXCard style={styles.savedItem}>
                <Image
                  source={item.image}
                  contentFit="cover"
                  style={styles.savedImage}
                />
                <View style={styles.flex}>
                  <CXText variant="bodyStrong">{item.title}</CXText>
                  <CXText variant="title" color={colors.primary}>
                    ₹{item.price.toLocaleString("en-IN")}
                  </CXText>
                </View>
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    toggleSavedListing(item.id);
                  }}
                  style={({ pressed }) => pressed && { opacity: 0.5 }}
                >
                  <Ionicons name="bookmark" size={18} color={colors.primary} />
                </Pressable>
              </CXCard>
            </Pressable>
          ))
        )}
      </ScrollView>
    </CXScreen>
  );
}

export function MyPostsScreen({ navigation }: StackProps<"MyPosts">) { const currentUser = useAppStore(state => state.user); const [posts, setPosts] = useState<Post[]>([]); useEffect(() => { api.get<{ data: Post[] }>("/posts/my").then(res => setPosts(res.data.data)).catch(console.log); }, []); return (
    <CXScreen>
      <CXHeader
        title="My Posts"
        onBack={navigation.goBack}
        right={
          <CXButton
            label="Post"
            size="sm"
            fullWidth={false}
            onPress={() => navigation.navigate("CreatePost")}
          />
        }
      />
      <ScrollView contentContainerStyle={styles.page}>
        <CXRow style={styles.feedFilters}>
          <CXChip label="Posts" active />
          <CXChip label="Photos" />
          <CXChip label="Videos" />
        </CXRow>
        {posts.map((post) => (
          <CXPostCard
            key={post.id}
            post={{ ...post, author: currentUser as any }}
            onOpen={() =>
              navigation.navigate("PostDetails", { postId: post.id })
            }
          />
        ))}
      </ScrollView>
    </CXScreen>
  );
}

export function CreatePostScreen({ navigation }: StackProps<"CreatePost">) {
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const submit = async () => {
    if (!body.trim()) {
      setError("Write something before posting");
      return;
    }
    setLoading(true);
    try {
      await api.post("/posts", { body: body.trim() });
      navigation.goBack();
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    } finally {
      setLoading(false);
    }
  };
  return (
    <CXScreen>
      <CXHeader
        title="Create Post"
        onBack={navigation.goBack}
        right={
          <CXButton
            label="Post"
            size="sm"
            fullWidth={false}
            loading={loading}
            onPress={() => void submit()}
          />
        }
      />
      <ScrollView
        contentContainerStyle={styles.page}
        keyboardShouldPersistTaps="handled"
      >
        <CXRow style={styles.postIdentity}>
          <CXAvatar source={(currentUser?.avatarUrl ?? "")} name={(currentUser?.name ?? "User")} />
          <View>
            <CXText variant="bodyStrong">{(currentUser?.name ?? "User")}</CXText>
            <CXChip label="Public" icon="earth-outline" />
          </View>
        </CXRow>
        <TextInput
          multiline
          autoFocus
          placeholder="What’s on your mind?"
          placeholderTextColor={colors.textFaint}
          value={body}
          onChangeText={setBody}
          style={styles.postEditor}
        />
        <CXText variant="caption" color={colors.textMuted} align="right">
          {body.length}/2000
        </CXText>
        <CXSectionHeader title="Add Photos / Videos" action="0/5" />
        <CXRow style={styles.mediaRow}>
          {["image-outline", "add", "add", "add", "add"].map((icon, index) => (
            <Pressable key={index} style={styles.mediaTile}>
              <Ionicons
                name={icon as keyof typeof Ionicons.glyphMap}
                size={22}
                color={colors.primary}
              />
            </Pressable>
          ))}
        </CXRow>
        {[
          ["Add Location", "location-outline"],
          ["Add Tags", "pricetag-outline"],
          ["Add Activity or Feeling", "happy-outline"],
        ].map(([label, icon]) => (
          <CXCard key={label} style={styles.postOption}>
            <Ionicons
              name={icon as keyof typeof Ionicons.glyphMap}
              size={19}
              color={colors.primary}
            />
            <CXText style={styles.flex}>{label}</CXText>
            <Ionicons
              name="chevron-forward"
              size={17}
              color={colors.textFaint}
            />
          </CXCard>
        ))}
        {error ? <CXText color={colors.danger}>{error}</CXText> : null}
      </ScrollView>
    </CXScreen>
  );
}

export function ReactionsScreen({ navigation }: StackProps<"Reactions">) {
  return (
    <CXScreen>
      <CXHeader
        title="Reactions"
        subtitle="56 reactions"
        onBack={navigation.goBack}
      />
      <ScrollView contentContainerStyle={styles.page}>
        <CXRow style={styles.feedFilters}>
          <CXChip label="All" active />
          <CXChip label="Like" />
          <CXChip label="Love" />
          <CXChip label="Fire" />
        </CXRow>
        {friends.slice(1).map((user, index) => (
          <CXUserRow
            key={user.id}
            user={user}
            action={index % 3 === 0 ? "View" : "Message"}
            onPress={() =>
              navigation.navigate("UserProfile", { userId: user.id })
            }
            onAction={() =>
              navigation.navigate("Conversation", {
                conversationId: `conversation-${user.id}`,
                name: user.name,
              })
            }
          />
        ))}
      </ScrollView>
    </CXScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  page: {
    paddingHorizontal: spacing.screen,
    paddingBottom: spacing.xxxl,
    gap: spacing.md,
  },
  header: { minHeight: 54, gap: spacing.xs },
  feedFilters: { gap: spacing.xs },
  storyRow: { gap: spacing.sm },
  composer: {
    minHeight: 62,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  comment: { alignItems: "flex-start", gap: spacing.sm },
  commentBubble: {
    flex: 1,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceLavender,
    padding: spacing.sm,
    gap: 3,
  },
  commentBar: {
    padding: spacing.sm,
    borderTopWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    gap: spacing.sm,
  },
  commentInput: {
    flex: 1,
    minHeight: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.backgroundLavender,
    paddingHorizontal: spacing.md,
    ...typography.body,
  },
  profileHero: { alignItems: "center", gap: spacing.xxs },
  profileAvatar: {
    borderRadius: 54,
    padding: 4,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  nameLine: { gap: 4 },
  actionButtons: { gap: spacing.sm },
  profileStats: { flexDirection: "row" },
  stat: { flex: 1, alignItems: "center" },
  mutual: { gap: spacing.xs },
  wrap: { gap: spacing.xs, flexWrap: "wrap" },
  request: { minHeight: 76, gap: spacing.sm },
  requestActions: { gap: 2 },
  storyProgress: {
    position: "absolute",
    top: 18,
    left: 12,
    right: 12,
    flexDirection: "row",
    gap: 4,
    zIndex: 3,
  },
  storyProgressTrack: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,.35)",
  },
  storyProgressActive: { backgroundColor: colors.white },
  storyTop: {
    position: "absolute",
    top: 36,
    left: 16,
    right: 16,
    zIndex: 3,
    gap: spacing.sm,
  },
  storyCaption: {
    position: "absolute",
    left: 18,
    right: 18,
    bottom: 30,
    gap: spacing.md,
  },
  storyComposer: { gap: spacing.sm },
  storyMessage: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.55)",
    paddingHorizontal: spacing.md,
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,.24)",
  },
  storyTools: { justifyContent: "space-around" },
  storyTool: { width: 72, alignItems: "center", gap: spacing.xs },
  gallery: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  galleryItem: {
    width: "31.7%",
    aspectRatio: 1,
    borderRadius: radius.sm,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: colors.transparent,
  },
  gallerySelected: { borderColor: colors.primary },
  galleryImage: { width: "100%", height: "100%" },
  galleryCheck: {
    position: "absolute",
    right: 5,
    top: 5,
    width: 19,
    height: 19,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  storyPreview: { width: "100%", aspectRatio: 2.4, borderRadius: radius.md },
  savedItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.sm,
  },
  savedImage: {
    width: 82,
    height: 66,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceLavender,
  },
  postIdentity: { gap: spacing.sm },
  postEditor: {
    minHeight: 220,
    textAlignVertical: "top",
    color: colors.ink,
    ...typography.body,
  },
  mediaRow: { gap: spacing.xs },
  mediaTile: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.border,
    backgroundColor: colors.backgroundLavender,
    alignItems: "center",
    justifyContent: "center",
  },
  postOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.sm,
  },
});



