import React, { useState, useMemo } from "react";
import { FlatList, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import { getUserAvatar } from "@/utils/user";
import { useAppStore } from "@/store/appStore";
import { queryClient } from "@/query/queryClient";

import {
  CXAvatar,
  CXHeader,
  CXRow,
  CXScreen,
  CXText,
  CXActionSheet,
} from "@/components/ui";
import { colors, spacing } from "@/theme";
import type { RootStackParamList } from "@/types/navigation";

export function ArchivedChatsScreen({ navigation }: NativeStackScreenProps<RootStackParamList, "ArchivedChats">) {
  const currentUser = useAppStore((state) => state.user);
  const [selectedChat, setSelectedChat] = useState<any>(null);
  
  const { data: conversations = [], refetch, isFetching } = useQuery({
    queryKey: ["chats"],
    queryFn: async () => {
      const res = await api.get<{ data: any[] }>("/chats");
      return res.data.data;
    }
  });

  const formattedConversations = useMemo(() => {
    const list: any[] = [];
    const seen = new Set();

    conversations.forEach(c => {
      const otherParticipant = c.participants.find((p: any) => p._id !== currentUser?.id) || c.participants[0];
      const meta = c.participantMetadata?.find((m: any) => m.user === currentUser?.id);
      
      if (!meta?.archived) return;

      const title = c.type === "group" ? c.title : (otherParticipant?.name || "Unknown");
      if (!seen.has(c._id)) {
        seen.add(c._id);
        list.push({
          id: c._id,
          type: c.type,
          title,
          avatarUrl: c.type === "group" ? c.avatarUrl : getUserAvatar(otherParticipant),
          online: otherParticipant?.online,
          unread: meta?.unreadCount || 0,
          pinned: Boolean(meta?.pinned),
          muted: Boolean(meta?.muted),
          archived: true,
          lastMessage: c.lastMessage?.text || (c.lastMessage?.attachments?.length ? "Sent an attachment" : "Started a conversation"),
          updatedAt: c.lastMessageAt ? new Date(c.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ""
        });
      }
    });

    return list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [conversations, currentUser]);

  const updatePreference = async (key: string, value: boolean) => {
    if (!selectedChat) return;
    try {
      const original = [...conversations];
      const updated = original.map(c => {
        if (c._id === selectedChat.id) {
          const meta = c.participantMetadata?.find((m: any) => m.user === currentUser?.id) || { user: currentUser?.id };
          return {
            ...c,
            participantMetadata: [
              ...(c.participantMetadata?.filter((m: any) => m.user !== currentUser?.id) || []),
              { ...meta, [key]: value }
            ]
          };
        }
        return c;
      });
      
      queryClient.setQueryData(["chats"], updated);
      setSelectedChat(null);
      await api.patch(`/chats/${selectedChat.id}/preferences`, { [key]: value });
    } catch (err) {
      refetch();
    }
  };

  const deleteChat = async () => {
    if (!selectedChat) return;
    try {
      const original = [...conversations];
      queryClient.setQueryData(["chats"], original.filter(c => c._id !== selectedChat.id));
      setSelectedChat(null);
      await api.delete(`/chats/${selectedChat.id}`);
    } catch (err) {
      refetch();
    }
  };

  return (
    <CXScreen>
      <CXHeader title="Archived Chats" onBack={navigation.goBack} />
      <FlatList
        data={formattedConversations}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          !isFetching ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="archive-outline" size={48} color={colors.border} />
              <CXText variant="bodyStrong" color={colors.textMuted} style={{ marginTop: spacing.md }}>
                No archived chats
              </CXText>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            onLongPress={() => setSelectedChat(item)}
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
                {item.unread > 0 && (
                  <View style={styles.unread}>
                    <CXText variant="caption" color={colors.white}>{item.unread}</CXText>
                  </View>
                )}
              </CXRow>
            </View>
          </Pressable>
        )}
      />
      
      <CXActionSheet
        visible={Boolean(selectedChat)}
        onClose={() => setSelectedChat(null)}
        title="Chat options"
        actions={selectedChat ? [
          {
            label: "Unarchive chat",
            icon: "arrow-undo-outline",
            onPress: () => void updatePreference("archived", false),
          },
          {
            label: selectedChat.muted ? "Unmute notifications" : "Mute notifications",
            icon: selectedChat.muted ? "notifications-outline" : "notifications-off-outline",
            onPress: () => void updatePreference("muted", !selectedChat.muted),
          },
          {
            label: "Delete chat",
            icon: "trash-outline",
            destructive: true,
            confirmationTitle: "Delete this chat?",
            confirmationMessage: "This hides the conversation only for you. It can reappear if a new message arrives.",
            confirmationButtonText: "Delete",
            onPress: () => void deleteChat(),
          },
        ] : []}
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
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xxxl,
  },
  chat: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  pressed: { opacity: 0.7 },
  unread: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
});
