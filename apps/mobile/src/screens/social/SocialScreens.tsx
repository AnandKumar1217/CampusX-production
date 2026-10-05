import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import React, { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";

import { CXEventCard, CXPostCard, CXStoryAvatar, CXUserRow } from "@/components/cards";
import { useOpenChat } from "@/hooks/useOpenChat";
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
import { eventService } from "@/services/eventService";
import { colors, gradients, radius, spacing, typography } from "@/theme";
import type { EventItem, Post, User } from "@/types/domain";
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
  const unreadNotifications = useAppStore(state => state.unreadNotifications);
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
            backgroundColor={colors.transparent}
            badge={unreadNotifications}
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
              user={{
                ...user,
                avatar: user.avatar ?? undefined,
                avatarUrl: user.avatarUrl ?? undefined,
              }}
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
                .catch((): void => { return; });
            }}
            onSave={() => {
              updatePost(post.id, { saved: !post.saved });
              void api
                .post(`/posts/${post.id}/save`, { saved: !post.saved })
                .catch((): void => { return; });
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
    api.get<{ data: { post: Post, comments: any[] } }>(`/posts/${route.params.postId}`)
       .then(res => {
         setPost(res.data.data.post);
         setComments(res.data.data.comments);
       })
       .catch(err => console.log("Failed to fetch post", err))
       .finally(() => setLoading(false));
  }, [route.params.postId]);

  const submit = () => {
    if (!post) return;
    const value = comment.trim();
    if (!value) return;
    setComments((items) => [
      ...items,
      { _id: `local-${Date.now()}`, author: currentUser, body: value },
    ]);
    setComment("");
    void api
      .post(`/posts/${post.id}/comments`, { body: value })
      .catch((): void => { return; });
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
        {post ? (
          <CXPostCard
            post={post}
            onLike={() => {
              setPost(p => p ? { ...p, liked: !p.liked, reactions: p.reactions + (p.liked ? -1 : 1) } : null);
              api.post(`/posts/${post.id}/reactions`, { type: post.liked ? null : "like" }).catch(console.log);
            }}
            onSave={() => {
              setPost(p => p ? { ...p, saved: !p.saved } : null);
              api.post(`/posts/${post.id}/save`, { saved: !post.saved }).catch(console.log);
            }}
          />
        ) : null}
        <CXSectionHeader
          title={`Comments (${comments.length})`}
          action="Most Recent"
        />
        {comments.map((item) => (
          <CXRow key={item._id} style={styles.comment}>
            <CXAvatar
              source={item.author?.avatarUrl || item.author?.avatar}
              name={item.author?.name}
              size={38}
            />
            <View style={styles.commentBubble}>
              <CXText variant="smallStrong">{item.author?.name}</CXText>
              <CXText variant="small">{item.body}</CXText>
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
  const { openChat, isMessaging } = useOpenChat();
  const currentUser = useAppStore(state => state.user);
  const friends = useAppStore(state => state.friends);
  
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [friendState, setFriendState] = useState<"none" | "pending" | "friends">("none");
  const [stats, setStats] = useState({ eventsCount: 0, friendsCount: 0, groupsCount: 0 });

  const fetchProfileData = () => {
    Promise.all([
      api.get<{data: any}>(`/users/${route.params.userId}`),
      api.get<{data: { received: any[], sent: any[]}}>("/friends/requests"),
      api.get<{data: any}>(`/users/${route.params.userId}/profile-summary`).catch(() => ({ data: { data: { stats: { eventsCount: 0, friendsCount: 0, groupsCount: 0 } } } }))
    ])
    .then(([userRes, reqRes, statsRes]) => {
      const u = userRes.data.data;
      if (u.avatarUrl) u.avatar = u.avatarUrl;
      u.id = u._id || route.params.userId;
      setUser(u);
      if (statsRes?.data?.data?.stats) setStats(statsRes.data.data.stats);

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
    })
    .catch(err => {
      console.log("Failed to fetch user profile data:", err);
      if (!user) navigation.goBack();
    })
    .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchProfileData();
    
    // Add real-time reactive socket listeners for this specific profile
    const socket = require("@/services/socket").getSocket();
    if (socket) {
      const handleUpdate = () => fetchProfileData();
      socket.on("friend:request", handleUpdate);
      socket.on("friend:accepted", handleUpdate);
      socket.on("friend:removed", handleUpdate);
      socket.on("friend:request_cancelled", handleUpdate);
      socket.on("friend:request_rejected", handleUpdate);

      return () => {
        socket.off("friend:request", handleUpdate);
        socket.off("friend:accepted", handleUpdate);
        socket.off("friend:removed", handleUpdate);
        socket.off("friend:request_cancelled", handleUpdate);
        socket.off("friend:request_rejected", handleUpdate);
      };
    }
  }, [route.params.userId, friends]);

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

  const { eventsCount, friendsCount: connectionsCount, groupsCount } = stats;

  const add = async () => {
    if (friendState === "friends") return; // already friends
    setFriendState("pending");
    useAppStore.getState().addSentRequest(user.id);
    try {
      await api.post("/friends/requests", { recipientId: user.id });
    } catch {
      setFriendState("none");
      useAppStore.getState().removeSentRequest(user.id);
    }
  };
  return (
    <CXScrollScreen>
      <CXHeader
        title=""
        onBack={navigation.goBack}
        right={
          user.id !== currentUser?.id ? (
            <CXRow>
              <CXIconButton
                icon="chatbubble-outline"
                label="Message"
                backgroundColor={colors.transparent}
                onPress={() => openChat(user.id, user.name)}
              />
            </CXRow>
          ) : undefined
        }
      />
      <View style={{ alignItems: "center", paddingHorizontal: spacing.md, paddingBottom: spacing.xxl }}>
        <View style={[styles.profileAvatar, { marginTop: spacing.md }]}>
          <CXAvatar
            source={user.avatar}
            name={user.name}
            size={110}
            online={user.online}
          />
        </View>
        <CXRow style={{ marginTop: spacing.md, alignItems: "center", gap: 4 }}>
          <CXText variant="h2">{user.name}</CXText>
          {user.verified ? (
            <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
          ) : null}
        </CXRow>
        
        <CXText variant="body" color={colors.textMuted} style={{ marginTop: 2 }}>
          @{user.username}
        </CXText>

        <View style={{ marginTop: spacing.md, alignItems: "center", gap: 6 }}>
          {user.department || user.year ? (
            <CXRow style={{ gap: spacing.xs, alignItems: "center" }}>
              <Ionicons name="school-outline" size={16} color={colors.textMuted} />
              <CXText variant="body" color={colors.textMuted}>
                {[user.department, user.year].filter(Boolean).join(" · ")}
              </CXText>
            </CXRow>
          ) : null}
          {user.college ? (
            <CXRow style={{ gap: spacing.xs, alignItems: "center" }}>
              <Ionicons name="business-outline" size={16} color={colors.textMuted} />
              <CXText variant="body" color={colors.textMuted}>
                {user.college}
              </CXText>
            </CXRow>
          ) : null}
        </View>

        {user.bio ? (
          <CXText variant="body" color={colors.ink} style={{ marginTop: spacing.lg, textAlign: "center", paddingHorizontal: spacing.lg, lineHeight: 22 }}>
            {user.bio}
          </CXText>
        ) : null}

        <View style={{ flexDirection: "row", width: "100%", marginTop: spacing.xl, paddingVertical: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border }}>
          {[
            [String(eventsCount), "Events"],
            [String(connectionsCount), "Friends"],
            [String(groupsCount), "Groups"],
          ].map(([value, label], index) => (
            <View key={label} style={[styles.stat, index > 0 && { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: colors.border }]}>
              <CXText variant="h3" color={colors.ink}>{value}</CXText>
              <CXText variant="caption" color={colors.textMuted} style={{ marginTop: 4 }}>{label}</CXText>
            </View>
          ))}
        </View>

        <CXRow style={{ width: "100%", marginTop: spacing.xl, gap: spacing.md }}>
          {user.id !== currentUser?.id ? (
            <>
              <CXButton
                label={
                  friendState === "none"
                    ? "Add Friend"
                    : friendState === "pending"
                      ? "Requested"
                      : "Friends"
                }
                iconLeft={
                  friendState === "friends" ? "checkmark" : friendState === "pending" ? "time-outline" : "person-add-outline"
                }
                onPress={() => void add()}
                disabled={friendState !== "none"}
                variant={friendState === "none" ? "primary" : "outline"}
                fullWidth={false}
                style={{ flex: 1 }}
              />
              <CXButton
                label="Message"
                iconLeft="chatbubble-outline"
                variant="outline"
                fullWidth={false}
                style={{ flex: 1 }}
                onPress={() => openChat(user.id, user.name)}
              />
            </>
          ) : (
            <CXButton
              label="Edit Profile"
              iconLeft="create-outline"
              variant="outline"
              style={{ flex: 1 }}
              onPress={() => navigation.navigate("EditProfile")}
            />
          )}
        </CXRow>
      </View>
    </CXScrollScreen>
  );
}

export function PeopleListPage({
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
  const { openChat, isMessaging } = useOpenChat();
  const [query, setQuery] = useState("");
  const friends = useAppStore(state => state.friends);
  const sentRequests = useAppStore(state => state.sentRequests);
  const addSentRequest = useAppStore(state => state.addSentRequest);
  const removeSentRequest = useAppStore(state => state.removeSentRequest);
  const filtered = useMemo(
    () =>
      users
        .filter((user) =>
          user.name.toLowerCase().includes(query.toLowerCase()) ||
          (user.college && user.college.toLowerCase().includes(query.toLowerCase())) ||
          (user.department && user.department.toLowerCase().includes(query.toLowerCase()))
        ),
    [query, users],
  );
  return (
    <CXScreen>
      <CXHeader title={title} subtitle={subtitle} onBack={navigation.goBack} />
      <View style={{ flex: 1, paddingHorizontal: spacing.screen }}>
        <CXSearchBar
          placeholder="Search by name, department, or college..."
          value={query}
          onChangeText={setQuery}
        />
        <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxxl }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {filtered.map((user) => {
            const isFriend = friends.some(f => f.id === user.id);
            const isRequested = sentRequests.includes(user.id) || (user as any).requested;
            const displayAction = action === "Message" ? "Message" : isFriend ? "Friends" : isRequested ? "Requested" : "Add Friend";

            return (
              <CXUserRow
                key={user.id}
                user={user}
                action={displayAction}
                onRemove={onRemove ? () => onRemove(user.id) : undefined}
                onPress={() =>
                  navigation.navigate("UserProfile", { userId: user.id })
                }
                onAction={() => {
                  if (displayAction === "Message") {
                    openChat(user.id, user.name);
                  } else if (displayAction === "Add Friend") {
                    addSentRequest(user.id);
                    api.post("/friends/requests", { recipientId: user.id }).catch(() => {
                      removeSentRequest(user.id);
                    });
                  }
                }}
              />
            );
          })}
        </ScrollView>
      </View>
    </CXScreen>
  );
}

export function UsersDirectoryPage({
  navigation,
  title,
}: {
  navigation: StackProps<"Friends">["navigation"];
  title: string;
}) {
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    api
      .get<{ data: { items: any[] } }>("/users/search", {
        params: { limit: 100 },
      })
      .then((response) =>
        setUsers(
          response.data.data.items.map((user) => ({
            ...user,
            id: user.id ?? user._id,
            avatar: user.avatar ?? user.avatarUrl ?? undefined,
            avatarUrl: user.avatarUrl ?? undefined,
          })),
        ),
      )
      .catch((error) => console.log("Failed to fetch users", error));
  }, []);

  return (
    <PeopleListPage
      navigation={navigation}
      title={title}
      subtitle={`${users.length} people`}
      action="Add Friend"
      users={users}
    />
  );
}

export function PeopleScreen({ navigation }: StackProps<"People">) {
  const [activeTab, setActiveTab] = useState<"requests" | "suggestions">("requests");
  const [requests, setRequests] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const addFriend = useAppStore(state => state.addFriend);
  const currentUser = useAppStore(state => state.user);
  
  const fetchPeopleData = async () => {
    try {
      const [reqRes, sugRes] = await Promise.all([
        api.get<any>("/friends/requests"),
        api.get<any>("/users/search", { params: { limit: 25 } })
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
      const sentReqIds = reqRes.data.data.sent.map((req: any) => req.recipient?._id || req.recipient?.id);
      useAppStore.getState().setSentRequests(sentReqIds);
      
      const mappedSugs = sugRes.data.data.items
        .filter((u: any) => u.id !== currentUser?.id && !friendsIds.includes(u.id) && !reqIds.includes(u.id))
        .map((user: any) => ({
          ...user,
          id: user.id ?? user._id,
          avatar: user.avatarUrl ?? undefined,
          requested: sentReqIds.includes(user.id ?? user._id)
        })).slice(0, 10);
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
      } as any);
    }
    void api
      .post(`/friends/requests/${user.id}/${accept ? "accept" : "reject"}`)
      .catch(() => {
        setRequests((items) => [user, ...items]);
      });
  };

  const sendRequest = async (user: any) => {
    setSuggestions(items => items.map(u => u.id === user.id ? { ...u, requested: true } : u));
    useAppStore.getState().addSentRequest(user.id);
    api.post("/friends/requests", { recipientId: user.id }).catch(() => {
       setSuggestions(items => items.map(u => u.id === user.id ? { ...u, requested: false } : u));
       useAppStore.getState().removeSentRequest(user.id);
    });
  };

  return (
    <CXScreen>
      <CXHeader title="People" onBack={navigation.goBack} />
      <View style={{ flexDirection: "row", paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm }}>
        <CXChip label="Requests" active={activeTab === "requests"} onPress={() => setActiveTab("requests")} />
        <CXChip label="Suggested People" active={activeTab === "suggestions"} onPress={() => setActiveTab("suggestions")} />
      </View>
      <ScrollView contentContainerStyle={styles.page}>
        
        {activeTab === "requests" ? (
          <>
            <CXRow style={{ marginHorizontal: spacing.md, marginBottom: spacing.md, justifyContent: "space-between", alignItems: "center" }}>
              <View>
                <CXText variant="bodyStrong">Friend Requests</CXText>
                <CXText variant="caption" color={colors.textMuted}>{requests.length} pending</CXText>
              </View>
              {requests.length > 0 && (
                <CXButton 
                  label="Accept All" 
                  variant="primary" 
                  size="sm"
                  fullWidth={false}
                  onPress={() => requests.forEach(user => decide(user, true))} 
                />
              )}
            </CXRow>
            {requests.length === 0 && !loading && (
              <CXText style={{ margin: spacing.md, textAlign: "center", color: colors.textMuted }}>No pending requests.</CXText>
            )}
            {requests.map((user) => (
              <Pressable key={user.id} onPress={() => navigation.navigate("UserProfile", { userId: user.id })}>
                <View style={styles.request}>
                  <CXAvatar source={user.avatar} name={user.name} />
                  <View style={styles.flex}>
                    <CXText variant="bodyStrong">{user.name}</CXText>
                    <CXText variant="caption" color={colors.textMuted}>
                      {user.department || user.college || "Student"}
                    </CXText>
                  </View>
                  <View style={styles.requestActions}>
                    <CXButton label="Accept" size="sm" fullWidth={false} onPress={() => decide(user, true)} />
                    <CXButton label="Decline" size="sm" variant="ghost" fullWidth={false} onPress={() => decide(user, false)} />
                  </View>
                </View>
              </Pressable>
            ))}
          </>
        ) : (
          <>
            <CXRow style={{ marginHorizontal: spacing.md, marginBottom: spacing.md, justifyContent: "space-between", alignItems: "center" }}>
              <View>
                <CXText variant="bodyStrong">Nearby Students</CXText>
                <CXText variant="caption" color={colors.textMuted}>Featured based on your location</CXText>
              </View>
              <Pressable 
                onPress={() => navigation.navigate("GlobalUsers")}
                style={{ flexDirection: "row", alignItems: "center", gap: 2 }}
              >
                <CXText variant="bodyStrong" color={colors.primary}>See All</CXText>
                <Ionicons name="chevron-forward" size={10} color={colors.primary} />
              </Pressable>
            </CXRow>
            {suggestions.map((user) => (
              <Pressable key={user.id} onPress={() => navigation.navigate("UserProfile", { userId: user.id })}>
                <View style={styles.request}>
                  <CXAvatar source={user.avatar} name={user.name} />
                  <View style={styles.flex}>
                    <CXText variant="bodyStrong">{user.name}</CXText>
                    <CXText variant="caption" color={colors.textMuted}>
                      {user.department || user.college || "Student"}
                    </CXText>
                  </View>
                  <View style={styles.requestActions}>
                     <CXButton 
                        label={user.requested ? "Requested" : "Add Friend"} 
                        size="sm" 
                        variant={user.requested ? "outline" : "primary"}
                        fullWidth={false} 
                        disabled={user.requested}
                        onPress={() => sendRequest(user)} 
                     />
                  </View>
                </View>
              </Pressable>
            ))}
          </>
        )}

        {loading && <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />}
      </ScrollView>
    </CXScreen>
  );
}

export function GlobalUsersScreen({ navigation }: StackProps<"GlobalUsers">) {
  return (
    <UsersDirectoryPage
      navigation={navigation as unknown as StackProps<"Friends">["navigation"]}
      title="Global Users"
    />
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
      users={friends.map((user) => ({
        ...user,
        avatar: user.avatar ?? undefined,
        avatarUrl: user.avatarUrl ?? undefined,
      }))}
      onRemove={removeFriend}
    />
  );
}
export function PeopleSuggestionsScreen({
  navigation,
}: StackProps<"PeopleSuggestions">) {
  const [suggestions, setSuggestions] = useState<any[]>([]);

  useEffect(() => {
    api.get<{data: any[]}>("/friends/suggestions")
      .then(res => setSuggestions(res.data.data.map((u: any) => ({ ...u, id: u._id || u.id }))))
      .catch(console.error);
  }, []);
  
  return (
    <PeopleListPage
      navigation={navigation as unknown as StackProps<"Friends">["navigation"]}
      title="friends You May Know"
      action="Add Friend"
      users={suggestions}
    />
  );
}
export function MutualFriendsScreen({
  navigation,
  route
}: StackProps<"MutualFriends">) {
  const [mutualFriends, setMutualFriends] = useState<any[]>([]);

  useEffect(() => {
    if (route.params?.userId) {
      api.get<{data: any[]}>(`/friends/mutual/${route.params.userId}`)
        .then(res => setMutualFriends(res.data.data.map((u: any) => ({ ...u, id: u._id || u.id }))))
        .catch(console.error);
    }
  }, [route.params?.userId]);

  return (
    <PeopleListPage
      navigation={navigation as unknown as StackProps<"Friends">["navigation"]}
      title="Mutual Friends"
      subtitle={`${mutualFriends.length} mutual friends`}
      users={mutualFriends}
      action="View"
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
  const currentUser = useAppStore(state => state.user);
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
          source={assets[selected]!}
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

function OldMyEventsScreen({ navigation }: StackProps<"MyEvents">) {
  const currentUser = useAppStore(state => state.user);
  const [events, setEvents] = useState<EventItem[]>([]);

  useEffect(() => {
    if (!currentUser?.id) return;
    eventService
      .listEvents({ limit: 100 })
      .then(({ items }) =>
        setEvents(items.filter((event) => event.organizer?.id === currentUser.id)),
      )
      .catch((error) => console.log("Failed to fetch user events", error));
  }, [currentUser?.id]);

  return (
    <CXScreen>
      <CXHeader title="My Events" onBack={navigation.goBack} />
      <ScrollView contentContainerStyle={styles.page}>
        {events.length > 0 ? (
          events.map((event) => (
            <CXEventCard
              key={event.id}
              event={event}
              onPress={() =>
                navigation.navigate("EventDetails", { eventId: event.id })
              }
            />
          ))
        ) : (
          <CXText color={colors.textMuted} align="center">
            {"You haven't created any events yet."}
          </CXText>
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
  const currentUser = useAppStore(state => state.user);
  const [body, setBody] = useState("");
  const [mediaUris, setMediaUris] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    const selectedAsset = result.assets?.[0];
    if (!result.canceled && selectedAsset) {
      if (mediaUris.length < 5) {
        setMediaUris(prev => [...prev, selectedAsset.uri]);
      }
    }
  };

  const submit = async () => {
    if (!body.trim() && mediaUris.length === 0) {
      setError("Write something or add media before posting");
      return;
    }
    setLoading(true);
    setError(null);
    
    let uploadedMedia: any[] = [];
    
    try {
      if (mediaUris.length > 0) {
        for (const uri of mediaUris) {
          const formData = new FormData();
          // @ts-ignore
          formData.append("file", { uri, name: "upload.jpg", type: "image/jpeg" } as any);
          const response = await api.post("/upload", formData, {
            headers: { "Content-Type": "multipart/form-data" }
          });
          if (response.data && response.data.data) {
            uploadedMedia.push(response.data.data);
          }
        }
      }

      await api.post("/posts", { 
        body: body.trim(),
        media: uploadedMedia,
      });
      navigation.goBack();
    } catch (caught: any) {
      // Rollback orphaned uploads
      for (const media of uploadedMedia) {
        if (media.publicId) {
          await api.delete(`/upload/${media.publicId}`).catch(console.warn);
        }
      }
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
        <CXSectionHeader title="Add Photos / Videos" action={`${mediaUris.length}/5`} />
        <CXRow style={styles.mediaRow}>
          {mediaUris.map((uri, index) => (
            <View key={index} style={[styles.mediaTile, { overflow: "hidden" }]}>
              <Image source={{ uri }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
            </View>
          ))}
          {mediaUris.length < 5 && (
            <Pressable style={styles.mediaTile} onPress={pickImage}>
              <Ionicons
                name="add"
                size={22}
                color={colors.primary}
              />
            </Pressable>
          )}
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

export function ReactionsScreen({ route, navigation }: StackProps<"Reactions">) {
  const { openChat, isMessaging } = useOpenChat();
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    if (route.params?.postId) {
      api.get<{ data: User[] }>(`/posts/${route.params?.postId}/reactions`)
         .then(res => setUsers(res.data.data))
         .catch(err => console.log("Failed to fetch reactions", err));
    }
  }, [route.params?.postId]);

  return (
    <CXScreen>
      <CXHeader
        title="Reactions"
        subtitle={`${users.length} reactions`}
        onBack={navigation.goBack}
      />
      <ScrollView contentContainerStyle={styles.page}>
        <CXRow style={styles.feedFilters}>
          <CXChip label="All" active />
          <CXChip label="Like" />
          <CXChip label="Love" />
          <CXChip label="Fire" />
        </CXRow>
        {users.map((user, index) => (
          <CXUserRow
            key={user.id}
            user={user}
            action={index % 3 === 0 ? "View" : "Message"}
            onPress={() =>
              navigation.navigate("UserProfile", { userId: user.id })
            }
            onAction={() =>
              openChat(user.id, user.name)
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
  request: { 
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: 66,
    paddingHorizontal: spacing.md,
  },
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







