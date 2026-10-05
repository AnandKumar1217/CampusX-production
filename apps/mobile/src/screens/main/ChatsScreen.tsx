import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, FlatList, StyleSheet, View, Alert, RefreshControl, ActivityIndicator, BackHandler } from "react-native";
import { useState, useEffect, useDeferredValue, useMemo, useCallback } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming, Easing } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";

import {
  CXAvatar,
  CXChip,
  CXIconButton,
  CXRow,
  CXScreen,
  CXSearchBar,
  CXText,
  CXActionSheet,
} from "@/components/ui";

import { useRootNavigation } from "@/hooks/useRootNavigation";
import { useFocusEffect } from "@react-navigation/native";
import { useAppStore } from "@/store/appStore";
import { colors, radius, spacing } from "@/theme";
import { api, getApiErrorMessage } from "@/services/api";
import { getSocket } from "@/services/socket";
import { groupService } from "@/services/groupService";
import { getUserAvatar } from "@/utils/user";
import { queryClient } from "@/query/queryClient";
import AsyncStorage from "@react-native-async-storage/async-storage";

function AnimatedAIIcon() {
  return (
    <View style={[styles.storyRing, { padding: 3, backgroundColor: 'transparent' }]}>
      <View style={[styles.add, { backgroundColor: colors.white, borderStyle: 'solid', borderColor: colors.primary }]}>
        <Ionicons name="sparkles" size={24} color={colors.primary} />
      </View>
    </View>
  );
}

export function ChatsScreen() {
  const navigation = useRootNavigation();
  const currentUser = useAppStore(state => state.user);

  const [filter, setFilter] = useState<"All" | "Unread" | "Groups">("All");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  
  const [conversations, setConversations] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedChat, setSelectedChat] = useState<any | null>(null);
  const globalFriends = useAppStore(state => state.friends);

  const fetchChats = async () => {
    try {
      const [chatsRes, groupsRes] = await Promise.all([
        api.get<{ data: any[] }>("/chats"),
        groupService.getMyGroups()
      ]);
      setConversations(chatsRes.data.data);
      setGroups(groupsRes.data || []);

      const chats = chatsRes.data.data;
      if (chats && chats.length > 0) {
        setTimeout(() => {
          chats.slice(0, 5).forEach((chat) => {
            const id = chat._id || chat.id;
            if (id) {
              api.get(`/chats/${id}/messages?limit=30`).then(res => {
                if (res.data?.data?.items) {
                  queryClient.setQueryData(["chatMessages", id], res.data.data.items);
                  AsyncStorage.setItem(`chatMessages_${id}`, JSON.stringify(res.data.data.items)).catch(() => {});
                }
              }).catch(() => {});
            }
          });
        }, 500);
      }
    } catch (err) {
      console.log("Failed to fetch chats:", getApiErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchChats();
      const socket = getSocket();
      if (socket) {
        let timeout: NodeJS.Timeout;
        const handleNewMessage = (msg: any) => {
          setConversations(prev => {
            // Find the chat that matches the conversation ID (msg.conversation could be object or ID)
            const convId = msg.conversation?._id || msg.conversation || msg.conversationId;
            const idx = prev.findIndex(c => c._id === convId || c.id === convId);
            
            if (idx === -1) {
              // If it's a completely new chat, debounce a fetch
              clearTimeout(timeout);
              timeout = setTimeout(fetchChats, 1000);
              return prev;
            }
            
            const newChats = [...prev];
            const chat = newChats[idx];
            const senderId = msg.sender?._id || msg.sender;
            
            const updated = {
              ...chat,
              lastMessage: msg,
              lastMessageAt: msg.createdAt || new Date().toISOString()
            };
            
            if (senderId !== currentUser?.id) {
               const myMetaIdx = updated.participantMetadata?.findIndex((m: any) => String(m.user?._id ?? m.user) === currentUser?.id);
               if (myMetaIdx !== undefined && myMetaIdx !== -1) {
                 const newMeta = [...updated.participantMetadata];
                 newMeta[myMetaIdx] = { ...newMeta[myMetaIdx], unreadCount: (newMeta[myMetaIdx].unreadCount || 0) + 1 };
                 updated.participantMetadata = newMeta;
               } else if (updated.participantMetadata) {
                 updated.participantMetadata = [...updated.participantMetadata, { user: currentUser?.id, unreadCount: 1 }];
               }
            }
            
            newChats.splice(idx, 1);
            newChats.unshift(updated);
            return newChats;
          });
        };
        
        socket.on("message:new", handleNewMessage);
        return () => {
          socket.off("message:new", handleNewMessage);
          clearTimeout(timeout);
        };
      }
    }, [currentUser])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchChats();
  };

  const handleLongPress = (chat: any) => setSelectedChat(chat);

  const updatePreference = async (key: "pinned" | "muted" | "archived", value: boolean) => {
    if (!selectedChat) return;
    const id = selectedChat.id;
    setConversations((current) => current.map((conversation) => {
      if (conversation._id !== id) return conversation;
      const participantMetadata = [...(conversation.participantMetadata ?? [])];
      const index = participantMetadata.findIndex((entry: any) => String(entry.user?._id ?? entry.user) === currentUser?.id);
      if (index >= 0) participantMetadata[index] = { ...participantMetadata[index], [key]: value };
      else participantMetadata.push({ user: currentUser?.id, [key]: value });
      return { ...conversation, participantMetadata };
    }));
    await api.patch(`/chats/${id}/preferences`, { [key]: value });
    void fetchChats();
  };

  const deleteChat = async () => {
    if (!selectedChat) return;
    const id = selectedChat.id;
    setConversations((current) => current.filter((conversation) => conversation._id !== id));
    await api.delete(`/chats/${id}`);
  };

  const leaveGroup = async () => {
    if (!selectedChat) return;
    const id = selectedChat.id;
    setGroups((current) => current.filter((g) => (g._id || g.id) !== id));
    await groupService.leaveGroup(id);
    void fetchChats();
  };

  const archivedChatsCount = conversations.filter(c => c.participantMetadata?.find((m: any) => String(m.user?._id ?? m.user) === currentUser?.id)?.archived).length;

  const formattedConversations = useMemo(() => {
    const list: any[] = [];
    const seen = new Set();

    if (filter === "All" || filter === "Unread") {
      conversations.forEach(c => {
        const otherParticipant = c.participants.find((p: any) => p._id !== currentUser?.id) || c.participants[0];
        const meta = c.participantMetadata?.find((m: any) => String(m.user?._id ?? m.user) === currentUser?.id);
        const unreadCount = meta?.unreadCount || 0;
        
        if (filter === "Unread" && unreadCount === 0) return;
        
        const title = c.type === "group" ? c.title : (otherParticipant?.name || "Unknown");
        if (deferredSearch && !title.toLowerCase().includes(deferredSearch.toLowerCase())) return;

        if (meta?.archived) return;
        if (!seen.has(c._id)) {
          seen.add(c._id);
          list.push({
            id: c._id,
            type: c.type,
            title,
            avatarUrl: c.type === "group" ? c.avatarUrl : getUserAvatar(otherParticipant),
            online: otherParticipant?.online,
            unread: unreadCount,
            pinned: Boolean(meta?.pinned),
            muted: Boolean(meta?.muted),
            archived: Boolean(meta?.archived),
            lastMessage: c.lastMessage?.text || (c.lastMessage?.attachments?.length ? "Sent an attachment" : "Started a conversation"),
            updatedAt: c.lastMessageAt ? new Date(c.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ""
          });
        }
      });
    }

    if (filter === "All" || filter === "Groups") {
      groups.forEach(g => {
        if (deferredSearch && !g.name.toLowerCase().includes(deferredSearch.toLowerCase())) return;
        
        const groupId = g._id || g.id;
        if (!seen.has(groupId)) {
          seen.add(groupId);
          list.push({
            id: groupId,
            type: "community_group",
            name: g.name,
            avatarUrl: g.avatarUrl,
            subtitle: g.category || g.description,
            updatedAt: ""
          });
        }
      });
    }

    return list.sort((left, right) => Number(Boolean(right.pinned)) - Number(Boolean(left.pinned)));
  }, [conversations, groups, filter, deferredSearch, currentUser]);

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
        data={[
          { id: 'new', isNew: true }, 
          { id: 'ai', isAI: true },
          ...globalFriends
            .filter(f => f.online)
            .filter((f, index, self) => self.findIndex(t => t.id === f.id) === index)
        ]}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          if ((item as any).isNew) {
            return (
              <Pressable onPress={() => navigation.navigate("NewChat")} style={styles.story}>
                <View style={styles.add}>
                  <Ionicons name="add" size={22} color={colors.primary} />
                </View>
                <CXText variant="caption">New</CXText>
              </Pressable>
            );
          }
          if ((item as any).isAI) {
            return (
              <Pressable onPress={() => navigation.navigate("AIChat" as any)} style={styles.story}>
                <AnimatedAIIcon />
                <CXText variant="caption" style={{ fontWeight: '600' }}>CampusAI</CXText>
              </Pressable>
            );
          }
          return (
            <Pressable
              onPress={() => startChat(item)}
              style={styles.story}
            >
              <View style={styles.storyRing}>
                <CXAvatar name={(item as any).name} source={getUserAvatar(item)} size={48} online={(item as any).online} />
              </View>
              <CXText variant="caption" numberOfLines={1}>
                {(item as any).name.split(" ")[0]}
              </CXText>
            </Pressable>
          );
        }}
      />
      <CXRow style={styles.filters}>
        <CXChip label="All" active={filter === "All"} onPress={() => setFilter("All")} />
        <CXChip label="Unread" active={filter === "Unread"} onPress={() => setFilter("Unread")} />
        <CXChip label="Groups" active={filter === "Groups"} onPress={() => setFilter("Groups")} />
      </CXRow>
      
      {archivedChatsCount > 0 && (
        <Pressable
          style={{ flexDirection: "row", alignItems: "center", paddingVertical: 12, paddingHorizontal: 16, backgroundColor: colors.backgroundLavender, borderRadius: 12, marginTop: 8 }}
          onPress={() => navigation.navigate("ArchivedChats" as any)}
        >
          <Ionicons name="archive-outline" size={20} color={colors.primary} />
          <CXText variant="bodyStrong" style={{ marginLeft: 12, flex: 1 }}>Archived chats</CXText>
          <CXText variant="bodyStrong" color={colors.primary}>{archivedChatsCount}</CXText>
        </Pressable>
      )}
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
        ListHeaderComponent={renderHeader()}
        ListEmptyComponent={loading ? <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} /> : renderEmpty()}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        renderItem={({ item }) => {
          if (item.type === "group" || item.type === "community_group") {
            return (
              <Pressable
                onLongPress={() => handleLongPress(item)}
                onPress={() => {
                  if (item.type === "community_group") {
                    navigation.navigate("GroupConversation" as any, { groupId: item.id, name: item.name });
                  } else {
                    const fullChat = conversations.find(c => c._id === item.id);
                    if (fullChat) queryClient.setQueryData(["chat", item.id], fullChat);
                    navigation.navigate("Conversation", { conversationId: item.id, name: item.name, source: "chat_list" });
                  }
                }}
                style={({ pressed }) => [styles.chat, pressed && styles.pressed]}
              >
                {item.avatarUrl ? (
                  <CXAvatar source={item.avatarUrl} name={item.name} size={50} />
                ) : (
                  <View style={[styles.groupIcon, { backgroundColor: item.color || colors.primary }]}>
                    <Ionicons name={(item.icon as any) || "people"} size={24} color={colors.white} />
                  </View>
                )}
                <View style={styles.flex}>
                  <CXRow>
                    <CXText variant="bodyStrong" style={styles.flex}>{item.name || item.title}</CXText>
                    <CXText variant="caption" color={colors.textMuted}>{item.updatedAt}</CXText>
                  </CXRow>
                  <CXRow>
                    <CXText variant="small" color={item.unread ? colors.ink : colors.textMuted} numberOfLines={1} style={styles.flex}>
                      {item.type === "community_group" ? (item.subtitle || "No description") : (item.lastMessage || "No messages yet")}
                    </CXText>
                    {item.type === "group" && item.unread ? (
                      <View style={styles.unread}>
                        <CXText variant="caption" color={colors.white}>{item.unread}</CXText>
                      </View>
                    ) : null}
                  </CXRow>
                </View>
              </Pressable>
            );
          }

          return (
            <Pressable
              onLongPress={() => handleLongPress(item)}
              onPress={() => {
                const fullChat = conversations.find(c => c._id === item.id);
                if (fullChat) queryClient.setQueryData(["chat", item.id], fullChat);
                navigation.navigate("Conversation", { conversationId: item.id, name: item.title, source: "chat_list" });
              }}
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
      />
      <CXActionSheet
        visible={Boolean(selectedChat)}
        onClose={() => setSelectedChat(null)}
        title={selectedChat?.type === "community_group" ? "Group options" : "Chat options"}
        actions={
          selectedChat ? 
            selectedChat.type === "community_group" ? [
              {
                label: "Leave group",
                icon: "exit-outline",
                destructive: true,
                confirmationTitle: "Leave this group?",
                confirmationMessage: "You will no longer receive messages or updates from this group.",
                confirmationButtonText: "Leave group",
                onPress: () => void leaveGroup(),
              },
            ] : [
              {
                label: selectedChat.pinned ? "Unpin chat" : "Pin chat",
                icon: selectedChat.pinned ? "pin-outline" : "pin",
                onPress: () => void updatePreference("pinned", !selectedChat.pinned),
              },
              {
                label: selectedChat.muted ? "Unmute notifications" : "Mute notifications",
                icon: selectedChat.muted ? "notifications-outline" : "notifications-off-outline",
                onPress: () => void updatePreference("muted", !selectedChat.muted),
              },
              {
                label: selectedChat.archived ? "Unarchive chat" : "Archive chat",
                icon: selectedChat.archived ? "arrow-undo-outline" : "archive-outline",
                onPress: () => void updatePreference("archived", !selectedChat.archived),
              },
              {
                label: "Delete chat",
                icon: "trash-outline",
                destructive: true,
                confirmationTitle: "Delete this chat?",
                confirmationMessage: "This hides the conversation only for you. It can reappear if a new message arrives.",
                confirmationButtonText: "Delete chat",
                onPress: () => void deleteChat(),
              },
            ] 
          : []
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
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  }
});

