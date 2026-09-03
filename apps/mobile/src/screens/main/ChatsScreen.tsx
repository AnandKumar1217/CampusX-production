import { Ionicons } from "@expo/vector-icons";
import { Pressable, FlatList, StyleSheet, View, Alert, RefreshControl, ActivityIndicator } from "react-native";
import { useState, useEffect, useDeferredValue, useMemo } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  CXAvatar,
  CXChip,
  CXIconButton,
  CXRow,
  CXScreen,
  CXSearchBar,
  CXText,
} from "@/components/ui";

import { useRootNavigation } from "@/hooks/useRootNavigation";
import { useAppStore } from "@/store/appStore";
import { colors, radius, spacing } from "@/theme";
import { api, getApiErrorMessage } from "@/services/api";
import { getSocket } from "@/services/socket";

export function ChatsScreen() {
  const navigation = useRootNavigation();
  const currentUser = useAppStore(state => state.user);
  const joinedGroups = useAppStore(state => state.studyGroups).filter(g => g.joined);
  const [filter, setFilter] = useState<"All" | "Unread" | "Communities">("All");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const globalFriends = useAppStore(state => state.friends);

  const fetchChats = async () => {
    try {
      const chatsRes = await api.get<{ data: any[] }>("/chats");
      setConversations(chatsRes.data.data);
    } catch (err) {
      console.log("Failed to fetch chats:", getApiErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchChats();
    const socket = getSocket();
    if (socket) {
      const handleNewMessage = () => fetchChats();
      socket.on("message:new", handleNewMessage);
      return () => {
        socket.off("message:new", handleNewMessage);
      };
    }
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchChats();
  };

  const handleLongPress = (chat: any) => {
    Alert.alert(
      "Chat Options",
      "Choose an action",
      [
        { text: "Pin", onPress: () => console.log("Pin", chat.id) },
        { text: "Mute", onPress: () => console.log("Mute", chat.id) },
        { text: "Archive", onPress: () => console.log("Archive", chat.id) },
        { text: "Cancel", style: "cancel" }
      ],
      { cancelable: true }
    );
  };

  const formattedConversations = useMemo(() => {
    // Merge real API conversations with mock groups (until API groups exist)
    const list: any[] = [];
    
    if (filter === "All" || filter === "Communities") {
      joinedGroups.forEach(g => {
        if (!deferredSearch || g.name.toLowerCase().includes(deferredSearch.toLowerCase())) {
          list.push({
            id: g.id,
            type: "group",
            name: g.name,
            icon: g.icon,
            color: g.color,
            subtitle: g.subtitle,
            unread: 0,
            updatedAt: "Just now"
          });
        }
      });
    }

    if (filter === "All" || filter === "Unread") {
      conversations.forEach(c => {
        const otherParticipant = c.participants.find((p: any) => p._id !== currentUser?.id) || c.participants[0];
        const meta = c.participantMetadata?.find((m: any) => m.user === currentUser?.id);
        const unreadCount = meta?.unreadCount || 0;
        
        if (filter === "Unread" && unreadCount === 0) return;
        
        const title = c.type === "group" ? c.title : (otherParticipant?.name || "Unknown");
        if (deferredSearch && !title.toLowerCase().includes(deferredSearch.toLowerCase())) return;

        list.push({
          id: c._id,
          type: c.type,
          title,
          avatarUrl: c.type === "group" ? c.avatarUrl : otherParticipant?.avatarUrl,
          online: otherParticipant?.online,
          unread: unreadCount,
          lastMessage: c.lastMessage?.text || "Started a conversation",
          updatedAt: c.lastMessageAt ? new Date(c.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ""
        });
      });
    }
    return list;
  }, [conversations, filter, deferredSearch, joinedGroups, currentUser]);

  const startChat = async (user: any) => {
    try {
      const res = await api.post<{ data: any }>("/chats", { participantId: user.id || user._id });
      navigation.navigate("Conversation", {
        conversationId: res.data.data._id,
        name: user.name,
      });
    } catch (err) {
      Alert.alert("Error", getApiErrorMessage(err));
    }
  };

  const renderHeader = () => (
    <View style={{ gap: spacing.sm, paddingBottom: spacing.sm }}>
      <CXRow style={styles.header}>
        <CXText variant="h2" style={styles.flex}>
          Chats
        </CXText>
        <CXIconButton
          icon="videocam-outline"
          label="Start video call"
          backgroundColor={colors.white}
          onPress={() => navigation.navigate("VideoCall" as any)}
        />
        <CXIconButton
          icon="create-outline"
          label="New chat"
          onPress={() => navigation.navigate("NewChat")}
        />
      </CXRow>
      <CXSearchBar 
        placeholder="Search chats, people, groups..." 
        value={search}
        onChangeText={setSearch}
      />
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.stories}
        data={[{ id: 'new', isNew: true }, ...globalFriends.filter(f => f.online)]}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          if (item.isNew) {
            return (
              <Pressable onPress={() => navigation.navigate("NewChat")} style={styles.story}>
                <View style={styles.add}>
                  <Ionicons name="add" size={22} color={colors.primary} />
                </View>
                <CXText variant="caption">New</CXText>
              </Pressable>
            );
          }
          return (
            <Pressable
              onPress={() => startChat(item)}
              style={styles.story}
            >
              <View style={styles.storyRing}>
                <CXAvatar name={item.name} source={item.avatar} size={48} online={item.online} />
              </View>
              <CXText variant="caption" numberOfLines={1}>
                {item.name.split(" ")[0]}
              </CXText>
            </Pressable>
          );
        }}
      />
      <CXRow style={styles.filters}>
        <CXChip label="All" active={filter === "All"} onPress={() => setFilter("All")} />
        <CXChip label="Unread" active={filter === "Unread"} onPress={() => setFilter("Unread")} />
        <CXChip label="Communities" active={filter === "Communities"} onPress={() => setFilter("Communities")} />
      </CXRow>
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIcon}>
        <Ionicons name="chatbubbles-outline" size={48} color={colors.primary} />
      </View>
      <CXText variant="h3" style={{ marginTop: spacing.md }}>No conversations yet</CXText>
      <CXText variant="body" color={colors.textMuted} style={{ textAlign: "center", marginTop: spacing.xs, marginBottom: spacing.xl }}>
        Start chatting with your CampusX friends.
      </CXText>
      <Pressable style={styles.emptyButton} onPress={() => navigation.navigate("NewChat")}>
        <CXText variant="bodyStrong" color={colors.white}>Start a chat</CXText>
      </Pressable>
    </View>
  );

  return (
    <CXScreen>
      <FlatList
        data={formattedConversations}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={loading ? <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} /> : renderEmpty}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        renderItem={({ item }) => {
          if (item.type === "group") {
            return (
              <Pressable
                onLongPress={() => handleLongPress(item)}
                onPress={() => navigation.navigate("Conversation", { conversationId: item.id, name: item.name })}
                style={({ pressed }) => [styles.chat, pressed && styles.pressed]}
              >
                <View style={[styles.groupIcon, { backgroundColor: item.color || colors.primary }]}>
                  <Ionicons name={(item.icon as any) || "people"} size={24} color={colors.white} />
                </View>
                <View style={styles.flex}>
                  <CXRow>
                    <CXText variant="bodyStrong" style={styles.flex}>{item.name}</CXText>
                    <CXText variant="caption" color={colors.textMuted}>{item.updatedAt}</CXText>
                  </CXRow>
                  <CXRow>
                    <CXText variant="small" color={colors.textMuted} numberOfLines={1} style={styles.flex}>
                      You: {item.subtitle}
                    </CXText>
                  </CXRow>
                </View>
              </Pressable>
            );
          }

          return (
            <Pressable
              onLongPress={() => handleLongPress(item)}
              onPress={() => navigation.navigate("Conversation", { conversationId: item.id, name: item.title })}
              style={({ pressed }) => [styles.chat, pressed && styles.pressed]}
            >
              <CXAvatar name={item.title} source={item.avatarUrl} size={50} online={item.online} />
              <View style={styles.flex}>
                <CXRow>
                  <CXText variant="bodyStrong" style={styles.flex}>{item.title}</CXText>
                  <CXText variant="caption" color={colors.textMuted}>{item.updatedAt}</CXText>
                </CXRow>
                <CXRow>
                  <CXText variant="small" color={item.unread ? colors.ink : colors.textMuted} numberOfLines={1} style={styles.flex}>
                    {item.lastMessage}
                  </CXText>
                  {item.unread ? (
                    <View style={styles.unread}>
                      <CXText variant="caption" color={colors.white}>{item.unread}</CXText>
                    </View>
                  ) : (
                    <Ionicons name="checkmark-done" size={16} color={colors.primary} />
                  )}
                </CXRow>
              </View>
            </Pressable>
          );
        }}
        ListFooterComponent={
          <Pressable onPress={() => navigation.navigate("AIChat" as any)} style={styles.aiRow}>
            <View style={styles.aiIcon}>
              <Ionicons name="sparkles" size={22} color={colors.primary} />
            </View>
            <View style={styles.flex}>
              <CXText variant="bodyStrong">CampusAI</CXText>
              <CXText variant="caption" color={colors.textMuted}>Your personal campus and study assistant</CXText>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.primary} />
          </Pressable>
        }
      />
    </CXScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    paddingHorizontal: spacing.screen,
    paddingBottom: spacing.xxxl,
    gap: spacing.sm,
  },
  header: { minHeight: 58, gap: spacing.xs, paddingTop: spacing.md },
  stories: { gap: spacing.sm, paddingVertical: spacing.xs },
  story: { width: 60, alignItems: "center", gap: 4 },
  storyRing: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  add: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  filters: { gap: spacing.xs, paddingVertical: spacing.xs },
  chat: {
    minHeight: 74,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSoft,
  },
  pressed: { opacity: 0.72 },
  unread: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  aiRow: {
    minHeight: 74,
    borderRadius: radius.md,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surfaceLavender,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.xl,
  },
  aiIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  groupIcon: {
    width: 50,
    height: 50,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.surfaceLavender,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyButton: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: radius.round,
    backgroundColor: colors.primary,
  }
});
