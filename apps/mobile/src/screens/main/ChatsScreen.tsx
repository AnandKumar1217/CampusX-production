import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, View, Alert } from "react-native";

import { CXAvatar, CXIconButton, CXRow, CXScreen, CXSearchBar, CXText, CXActionSheet } from "@/components/ui";
import { useRootNavigation } from "@/hooks/useRootNavigation";
import { api, getApiErrorMessage } from "@/services/api";
import { groupService, type Group } from "@/services/groupService";
import { getSocket } from "@/services/socket";
import { useAppStore } from "@/store/appStore";
import { colors, radius, spacing } from "@/theme";

type Participant = { _id: string; name: string; avatarUrl?: string };
type Conversation = {
  _id: string;
  type: "direct" | "group";
  title?: string;
  avatarUrl?: string;
  participants: Participant[];
  participantMetadata?: { user: string | { _id: string }; unreadCount?: number }[];
  lastMessage?: { text?: string; attachments?: unknown[] };
  lastMessageAt?: string;
};
type GroupCard = { id: string; name: string; avatarUrl?: string; detail?: string; unread: number; kind: "study" | "chat" };

function unreadFor(conversation: Conversation, userId: string) {
  return conversation.participantMetadata?.find((entry) =>
    (typeof entry.user === "string" ? entry.user : entry.user?._id) === userId
  )?.unreadCount ?? 0;
}

function chatTime(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toDateString() === new Date().toDateString()
    ? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function ChatsScreen() {
  const navigation = useRootNavigation();
  const userId = useAppStore((state) => state.user?.id);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [dataOwnerId, setDataOwnerId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const query = useDeferredValue(search.trim().toLowerCase());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSheet, setActiveSheet] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    setConversations([]);
    setGroups([]);
    setDataOwnerId(null);
    setLoading(!!userId);
    setError(null);
  }, [userId]);

  const fetchChats = useCallback(async (refresh = false) => {
    if (!userId) return;
    if (refresh) setRefreshing(true);
    try {
      const [chats, mine] = await Promise.allSettled([
        api.get<{ data: Conversation[] }>("/chats"),
        groupService.getMyGroups(),
      ]);
      if (useAppStore.getState().user?.id !== userId) return;
      if (chats.status === "fulfilled") setConversations(chats.value.data.data ?? []);
      if (mine.status === "fulfilled") setGroups(mine.value.data ?? []);
      setDataOwnerId(userId);
      const failure = chats.status === "rejected" ? chats.reason : mine.status === "rejected" ? mine.reason : null;
      setError(failure ? getApiErrorMessage(failure) : null);
    } finally {
      if (useAppStore.getState().user?.id === userId) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [userId]);

  useFocusEffect(useCallback(() => {
    if (!userId) return;
    void fetchChats();
    const socket = getSocket();
    if (!socket) return;
    const refetch = () => void fetchChats();
    const events = ["connect", "message:new", "message:read", "chat:conversation:new", "chat:updated", "group:created",
      "group:updated", "group:deleted", "group:membership:changed", "profile:updated"];
    events.forEach((event) => socket.on(event, refetch));
    return () => events.forEach((event) => socket.off(event, refetch));
  }, [fetchChats, userId]));

  const groupCards = useMemo<GroupCard[]>(() => {
    if (dataOwnerId !== userId) return [];
    const cards: GroupCard[] = groups.filter((group) => group.name?.toLowerCase().includes(query)).map((group) => ({
      id: group._id || group.id, name: group.name, avatarUrl: group.avatarUrl ?? undefined,
      detail: group.category || `${group.memberCount || 0} members`,
      unread: 0, kind: "study" as const,
    }));
    conversations.filter((conversation) => conversation.type === "group").forEach((conversation) => {
      const name = conversation.title || "Group chat";
      if (!name.toLowerCase().includes(query)) return;
      cards.push({
        id: conversation._id, name, avatarUrl: conversation.avatarUrl,
        detail: conversation.lastMessage?.text || `${conversation.participants.length} members`,
        unread: userId ? unreadFor(conversation, userId) : 0, kind: "chat",
      });
    });
    return cards;
  }, [conversations, dataOwnerId, groups, query, userId]);

  const directChats = useMemo(() => dataOwnerId !== userId ? [] : conversations.filter((conversation) => conversation.type === "direct")
    .map((conversation) => ({ conversation, other: conversation.participants.find((p) => p._id !== userId) }))
    .filter(({ other }) => other && other.name.toLowerCase().includes(query)),
  [conversations, dataOwnerId, query, userId]);

  const openGroup = (card: GroupCard) => {
    if (card.kind === "study") navigation.navigate("GroupConversation", { groupId: card.id, name: card.name });
    else navigation.navigate("Conversation", { conversationId: card.id, name: card.name });
  };

  return (
    <CXScreen>
      <FlatList
        data={directChats}
        keyExtractor={({ conversation }) => conversation._id}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void fetchChats(true)} tintColor={colors.primary} />}
        ListHeaderComponent={
          <View>
            <CXRow style={styles.header}>
              <CXText variant="h2" style={styles.flex}>Chats</CXText>
              <CXIconButton icon="create-outline" label="New chat" onPress={() => navigation.navigate("NewChat")} />
            </CXRow>
            <CXSearchBar placeholder="Search chats and groups" value={search} onChangeText={setSearch} />
            <CXRow style={styles.sectionHeading}><CXText variant="title">Groups</CXText></CXRow>
            {groupCards.length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.groupStrip}>
                {groupCards.map((card) => (
                  <Pressable key={`${card.kind}:${card.id}`} onPress={() => openGroup(card)} onLongPress={() => {
                    if (card.kind !== 'chat') return;
                    setActiveSheet({ id: card.id, name: card.name });
                  }} style={styles.groupCard} accessibilityRole="button">
                    {card.avatarUrl ? <CXAvatar name={card.name} source={card.avatarUrl} size={52} /> :
                      <View style={styles.groupIcon}><Ionicons name="people" size={25} color={colors.primary} /></View>}
                    <CXText variant="smallStrong" numberOfLines={1} style={styles.groupName}>{card.name}</CXText>
                    <CXText variant="caption" color={colors.textMuted} numberOfLines={1} style={styles.groupName}>{card.detail}</CXText>
                    {card.unread > 0 && <View style={styles.groupUnread}><CXText variant="caption" color={colors.white}>{card.unread}</CXText></View>}
                  </Pressable>
                ))}
              </ScrollView>
            ) : <CXText variant="small" color={colors.textMuted} style={styles.groupEmpty}>
              {loading ? "Loading groups..." : query ? "No matching groups" : "Your group chats will appear here."}
            </CXText>}
            <CXRow style={styles.sectionHeading}><CXText variant="title">Messages</CXText></CXRow>
            {error && <Pressable onPress={() => void fetchChats()} style={styles.error}>
              <CXText variant="small" color={colors.danger}>{error} · Tap to retry</CXText>
            </Pressable>}
          </View>
        }
        ListEmptyComponent={loading ? <ActivityIndicator style={styles.loading} color={colors.primary} /> :
          <View style={styles.empty}>
            <Ionicons name="chatbubble-ellipses-outline" size={38} color={colors.primary} />
            <CXText variant="bodyStrong">{query ? "No matching messages" : "No direct messages yet"}</CXText>
            {!query && <CXText variant="small" color={colors.textMuted}>Start a conversation with a friend.</CXText>}
          </View>}
        renderItem={({ item: { conversation, other } }) => {
          if (!other) return null;
          const unread = userId ? unreadFor(conversation, userId) : 0;
          const preview = conversation.lastMessage?.text ||
            (conversation.lastMessage?.attachments?.length ? "Attachment" : "Start a conversation");
          return <Pressable
            onPress={() => navigation.navigate("Conversation", { conversationId: conversation._id, name: other.name })}
            onLongPress={() => setActiveSheet({ id: conversation._id, name: other.name })}
            style={({ pressed }) => [styles.chatRow, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <CXAvatar name={other.name} source={other.avatarUrl} size={52} />
            <View style={styles.flex}>
              <CXRow>
                <CXText variant="bodyStrong" style={styles.flex} numberOfLines={1}>{other.name}</CXText>
                <CXText variant="caption" color={colors.textMuted}>{chatTime(conversation.lastMessageAt)}</CXText>
              </CXRow>
              <CXRow>
                <CXText variant="small" color={unread ? colors.ink : colors.textMuted} style={styles.flex} numberOfLines={1}>{preview}</CXText>
                {unread > 0 && <View style={styles.unread}><CXText variant="caption" color={colors.white}>{unread > 99 ? "99+" : unread}</CXText></View>}
              </CXRow>
            </View>
          </Pressable>;
        }}
      />
      <CXActionSheet
        visible={!!activeSheet}
        onClose={() => setActiveSheet(null)}
        actions={[
          {
            label: "Delete Chat",
            icon: "trash-outline",
            destructive: true,
            confirmationTitle: "Delete Chat",
            confirmationMessage: `Are you sure you want to delete your chat with ${activeSheet?.name}?`,
            confirmationButtonText: "Delete",
            onPress: () => {
              if (activeSheet) {
                api.delete(`/chats/${activeSheet.id}`)
                  .then(() => void fetchChats())
                  .catch((err) => console.log(getApiErrorMessage(err)));
                setActiveSheet(null);
              }
            }
          }
        ]}
      />
    </CXScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: spacing.screen, paddingBottom: spacing.xxxl },
  header: { paddingTop: spacing.sm, paddingBottom: spacing.md },
  sectionHeading: { marginTop: spacing.lg, marginBottom: spacing.sm },
  groupStrip: { gap: spacing.sm, paddingBottom: spacing.xs },
  groupCard: { width: 116, minHeight: 122, padding: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center", gap: 4 },
  groupIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.backgroundLavender, alignItems: "center", justifyContent: "center" },
  groupName: { width: "100%", textAlign: "center" },
  groupUnread: { position: "absolute", right: 7, top: 7, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  groupEmpty: { paddingVertical: spacing.md },
  chatRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  pressed: { opacity: 0.7 },
  unread: { minWidth: 22, height: 22, paddingHorizontal: 5, borderRadius: 11, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", marginLeft: spacing.sm },
  error: { paddingVertical: spacing.sm },
  loading: { marginTop: spacing.xl },
  empty: { alignItems: "center", gap: spacing.xs, paddingVertical: spacing.xl },
});
