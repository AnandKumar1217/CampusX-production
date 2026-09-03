import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useEffect, useRef, useState, useDeferredValue } from "react";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  ActivityIndicator,
} from "react-native";
import Markdown from 'react-native-markdown-display';

import { CXUserRow } from "@/components/cards";
import {
  CXAvatar,
  CXButton,
  CXCard,
  CXChip,
  CXHeader,
  CXIconButton,
  CXListRow,
  CXRow,
  CXScreen,
  CXScrollScreen,
  CXSearchBar,
  CXSectionHeader,
  CXText,
} from "@/components/ui";
import { useAppStore } from "@/store/appStore";
import { generateChatResponse, type ChatMessage } from "@/services/ai";
import { api, getApiErrorMessage } from "@/services/api";
import { getSocket } from "@/services/socket";
import { colors, radius, spacing, typography } from "@/theme";
import type { Message } from "@/types/domain";
import type { RootStackParamList } from "@/types/navigation";

type StackProps<Name extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  Name
>;

export function ConversationScreen({ navigation, route }: StackProps<"Conversation">) {
  const currentUser = useAppStore((state) => state.user);
  const [text, setText] = useState("");
  const [messages, setMessages] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [remoteTyping, setRemoteTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const [replyTo, setReplyTo] = useState<any>(null);
  const [selectedMessage, setSelectedMessage] = useState<any>(null);

  const fetchMessages = async (pageNumber = 1) => {
    try {
      const res = await api.get<{ data: { items: any[], hasMore: boolean } }>(
        `/chats/${route.params.conversationId}/messages?page=${pageNumber}&limit=50`
      );
      if (pageNumber === 1) {
        setMessages(res.data.data.items);
      } else {
        setMessages(prev => [...prev, ...res.data.data.items]);
      }
      setHasMore(res.data.data.items.length === 50); // Since limit is 50
      
      if (pageNumber === 1) {
        // Mark as delivered and read
        api.post(`/chats/${route.params.conversationId}/delivered`).catch(() => {});
        api.post(`/chats/${route.params.conversationId}/read`).catch(() => {});
      }
    } catch (err) {
      console.log(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages(1);
    const socket = getSocket();
    if (socket) {
      socket.emit("conversation:join", route.params.conversationId);
      
      const onNewMessage = (msg: any) => {
        if (msg.conversation.toString() === route.params.conversationId.toString()) {
          setMessages(prev => {
            if (prev.some(m => m._id === msg._id)) return prev;
            return [msg, ...prev];
          });
          api.post(`/chats/${route.params.conversationId}/delivered`).catch(() => {});
          api.post(`/chats/${route.params.conversationId}/read`).catch(() => {});
        }
      };

      const onMessageRead = (data: { conversationId: string, userId: string }) => {
        if (data.conversationId.toString() === route.params.conversationId.toString()) {
          setMessages(prev => prev.map(m => {
            if (m.sender?._id === currentUser?.id || m.senderId === currentUser?.id) {
              const readBy = m.readBy || [];
              if (!readBy.find((r: any) => r.user === data.userId)) {
                return { ...m, readBy: [...readBy, { user: data.userId, readAt: new Date().toISOString() }] };
              }
            }
            return m;
          }));
        }
      };

      const onMessageDelivered = (data: { conversationId: string, userId: string }) => {
        if (data.conversationId.toString() === route.params.conversationId.toString()) {
          setMessages(prev => prev.map(m => {
            if (m.sender?._id === currentUser?.id || m.senderId === currentUser?.id) {
              const deliveredTo = m.deliveredTo || [];
              if (!deliveredTo.find((r: any) => r.user === data.userId)) {
                return { ...m, deliveredTo: [...deliveredTo, { user: data.userId, deliveredAt: new Date().toISOString() }] };
              }
            }
            return m;
          }));
        }
      };

      const onTypingStart = (data: { conversationId: string, userId: string }) => {
        if (data.conversationId.toString() === route.params.conversationId.toString() && data.userId !== currentUser?.id) {
          setRemoteTyping(true);
        }
      };

      const onTypingStop = (data: { conversationId: string, userId: string }) => {
        if (data.conversationId.toString() === route.params.conversationId.toString() && data.userId !== currentUser?.id) {
          setRemoteTyping(false);
        }
      };

      socket.on("message:new", onNewMessage);
      socket.on("message:read", onMessageRead);
      socket.on("message:delivered", onMessageDelivered);
      socket.on("typing:start", onTypingStart);
      socket.on("typing:stop", onTypingStop);
      
      const onMessageReaction = (data: { messageId: string, reactions: any[] }) => {
        setMessages(prev => prev.map(m => m._id === data.messageId ? { ...m, reactions: data.reactions } : m));
      };
      socket.on("message:reaction", onMessageReaction);

      return () => {
        socket.off("message:new", onNewMessage);
        socket.off("message:read", onMessageRead);
        socket.off("message:delivered", onMessageDelivered);
        socket.off("typing:start", onTypingStart);
        socket.off("typing:stop", onTypingStop);
        socket.off("message:reaction", onMessageReaction);
        socket.emit("conversation:leave", route.params.conversationId);
      };
    }
  }, [route.params.conversationId]);

  const handleTextChange = (val: string) => {
    setText(val);
    const socket = getSocket();
    if (socket) {
      socket.emit("typing:start", { conversationId: route.params.conversationId });
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit("typing:stop", { conversationId: route.params.conversationId });
      }, 2000);
    }
  };

  const send = async () => {
    const value = text.trim();
    if (!value) return;
    
    const tempId = `temp-${Date.now()}`;
    const temp = {
      _id: tempId,
      text: value,
      sender: { _id: currentUser?.id, name: currentUser?.name || "You" },
      createdAt: new Date().toISOString(),
      status: "sending"
    };
    
    setMessages(prev => [temp, ...prev]);
    setText("");
    
    setReplyTo(null);
    
    try {
      const response = await api.post<{ data: any }>(
        `/chats/${route.params.conversationId}/messages`,
        { text: value, replyTo: replyTo?._id }
      );
      setMessages(prev => prev.map(m => m._id === tempId ? { ...response.data.data, status: "sent" } : m));
    } catch {
      setMessages(prev => prev.map(m => m._id === tempId ? { ...m, status: "failed" } : m));
    }
  };

  const loadMore = () => {
    if (!loading && hasMore) {
      setPage(p => {
        const next = p + 1;
        fetchMessages(next);
        return next;
      });
    }
  };

  return (
    <CXScreen>
      <CXRow style={styles.chatHeader}>
        <CXIconButton icon="chevron-back" label="Go back" backgroundColor={colors.transparent} onPress={navigation.goBack} />
        <CXAvatar name={route.params.name ?? "Friend"} size={40} online />
        <View style={styles.flex}>
          <CXText variant="bodyStrong">{route.params.name ?? "Friend"}</CXText>
          <CXText variant="caption" color={colors.success}>
            {remoteTyping ? "Typing..." : "Online"}
          </CXText>
        </View>
        <CXIconButton icon="call-outline" label="Call" backgroundColor={colors.transparent} />
        <CXIconButton icon="videocam-outline" label="Video call" backgroundColor={colors.transparent} />
        <CXIconButton
          icon="ellipsis-horizontal"
          label="Chat info"
          backgroundColor={colors.transparent}
          onPress={() => navigation.navigate("ChatInfo" as any, { conversationId: route.params.conversationId })}
        />
      </CXRow>
      <FlatList
        data={messages}
        inverted
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.messageList}
        showsVerticalScrollIndicator={false}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        renderItem={({ item }) => (
          <MessageBubble
            message={item}
            mine={item.sender?._id === currentUser?.id || item.senderId === currentUser?.id}
            onLongPress={() => setSelectedMessage(item)}
          />
        )}
      />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={8}>
        {replyTo && (
          <View style={styles.replyPreviewWrapper}>
            <View style={styles.replyPreviewBar} />
            <View style={styles.flex}>
              <CXText variant="captionStrong" color={colors.primary}>{replyTo.sender?.name || "User"}</CXText>
              <CXText variant="caption" numberOfLines={1}>{replyTo.text}</CXText>
            </View>
            <CXIconButton icon="close" size={24} onPress={() => setReplyTo(null)} backgroundColor={colors.transparent} />
          </View>
        )}
        <CXRow style={styles.composer}>
          <CXIconButton icon="attach-outline" label="Attach file" size={38} backgroundColor={colors.backgroundLavender} />
          <TextInput
            value={text}
            onChangeText={handleTextChange}
            placeholder="Type a message..."
            placeholderTextColor={colors.textFaint}
            multiline
            style={styles.composerInput}
          />
          <CXIconButton icon="happy-outline" label="Emoji" size={38} backgroundColor={colors.transparent} />
          <CXIconButton
            icon={text.trim() ? "send" : "mic"}
            label={text.trim() ? "Send message" : "Voice message"}
            size={42}
            onPress={() => void send()}
          />
        </CXRow>
      </KeyboardAvoidingView>
      
      <Modal
        visible={!!selectedMessage}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedMessage(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setSelectedMessage(null)}>
          <View style={styles.modalContent}>
            <CXRow style={styles.reactionRow}>
              {["👍", "❤️", "😂", "😮", "😢", "🙏"].map((emoji) => (
                <Pressable
                  key={emoji}
                  onPress={() => {
                    api.post(`/chats/${route.params.conversationId}/messages/${selectedMessage._id}/reaction`, { emoji }).catch((err) => console.log(getApiErrorMessage(err)));
                    setSelectedMessage(null);
                  }}
                  style={styles.reactionBtn}
                >
                  <CXText style={{ fontSize: 24 }}>{emoji}</CXText>
                </Pressable>
              ))}
            </CXRow>
            <View style={styles.modalDivider} />
            <Pressable style={styles.modalOption} onPress={() => { setReplyTo(selectedMessage); setSelectedMessage(null); }}>
              <Ionicons name="arrow-undo-outline" size={20} color={colors.ink} />
              <CXText style={styles.modalOptionText}>Reply</CXText>
            </Pressable>
            <Pressable style={styles.modalOption} onPress={() => setSelectedMessage(null)}>
              <Ionicons name="copy-outline" size={20} color={colors.ink} />
              <CXText style={styles.modalOptionText}>Copy</CXText>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </CXScreen>
  );
}

function MessageBubble({ message, mine, onLongPress }: { message: any; mine: boolean; onLongPress?: () => void }) {
  const timeString = message.createdAt 
    ? new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
    : "Now";
    
  let status = message.status;
  if (!status) {
    if (message.readBy && message.readBy.length > 0) status = "read";
    else if (message.deliveredTo && message.deliveredTo.length > 0) status = "delivered";
    else status = "sent";
  }

  let iconName = "checkmark";
  let iconColor = "#EDE9FF";
  if (status === "failed") {
    iconName = "alert-circle";
    iconColor = "#FFD2D2";
  } else if (status === "sending") {
    iconName = "time-outline";
  } else if (status === "delivered") {
    iconName = "checkmark-done";
  } else if (status === "read") {
    iconName = "checkmark-done";
    iconColor = "#34B7F1"; // blue tick
  }

  return (
    <View style={[styles.messageRow, mine && styles.messageRowMine]}>
      <Pressable 
        style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}
        onLongPress={onLongPress}
        delayLongPress={300}
      >
        {message.replyTo && (
          <View style={[styles.replyQuote, mine ? styles.replyQuoteMine : styles.replyQuoteOther]}>
            <View style={[styles.replyBar, mine ? styles.replyBarMine : styles.replyBarOther]} />
            <View style={styles.flex}>
              <CXText variant="captionStrong" color={mine ? colors.white : colors.primary}>{message.replyTo.sender?.name}</CXText>
              <CXText variant="caption" color={mine ? "#EDE9FF" : colors.ink} numberOfLines={1}>{message.replyTo.text}</CXText>
            </View>
          </View>
        )}
        <CXText color={mine ? colors.white : colors.ink}>{message.text}</CXText>
        <CXRow style={styles.messageMeta}>
          <CXText variant="caption" color={mine ? "#EDE9FF" : colors.textMuted}>{timeString}</CXText>
          {mine ? (
            <Ionicons name={iconName as any} size={14} color={iconColor} />
          ) : null}
        </CXRow>
        
        {message.reactions && message.reactions.length > 0 && (
          <View style={[styles.reactionBadge, mine ? styles.reactionBadgeMine : styles.reactionBadgeOther]}>
            <CXText style={styles.reactionText}>
              {Array.from(new Set(message.reactions.map((r: any) => r.emoji))).join(" ")}
            </CXText>
          </View>
        )}
      </Pressable>
    </View>
  );
}

export function NewChatScreen({ navigation }: StackProps<"NewChat">) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const friends = useAppStore((state) => state.friends);
  const loading = false;

  const startChat = async (user: any) => {
    try {
      const res = await api.post<{ data: any }>("/chats", { participantId: user.id });
      navigation.replace("Conversation", {
        conversationId: res.data.data._id,
        name: user.name,
      });
    } catch (err) {
      Alert.alert("Error", getApiErrorMessage(err));
    }
  };

  const createGroup = () => {
    navigation.navigate("CreateChatGroup" as any);
  };

  const filtered = friends.filter((user) =>
    user.name.toLowerCase().includes(deferredQuery.toLowerCase())
  );

  return (
    <CXScreen>
      <CXHeader title="New Chat" onBack={navigation.goBack} />
      <ScrollView contentContainerStyle={styles.page}>
        <CXSearchBar
          placeholder="Search friends..."
          value={query}
          onChangeText={setQuery}
        />
        
        <CXCard style={{ marginVertical: spacing.md }}>
          <Pressable onPress={createGroup}>
            <CXListRow
              icon="people-outline"
              title="New Group"
              iconColor={colors.primary}
            />
          </Pressable>
        </CXCard>

        <CXSectionHeader title="All Friends" />
        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
        ) : filtered.length > 0 ? (
          filtered.map((user) => (
            <CXUserRow
              key={user.id}
              user={user}
              action=""
              onPress={() => startChat(user)}
              onAction={() => startChat(user)}
            />
          ))
        ) : (
          <CXText variant="body" color={colors.textMuted} style={{ textAlign: "center", marginTop: 20 }}>
            {query ? "No friends found matching your search." : "You have no friends yet."}
          </CXText>
        )}
      </ScrollView>
    </CXScreen>
  );
}

export function CreateChatGroupScreen({ navigation }: StackProps<"CreateChatGroup">) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const friends = useAppStore((state) => state.friends);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const loading = false;

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const proceed = () => {
    if (selected.size === 0) return Alert.alert("Select at least 1 friend");
    navigation.navigate("CreateChatGroupDetails" as any, { selectedIds: Array.from(selected) });
  };

  const filtered = friends.filter((user) =>
    user.name.toLowerCase().includes(deferredQuery.toLowerCase())
  );

  return (
    <CXScreen>
      <CXHeader title="New Group" onBack={navigation.goBack} />
      <View style={{ padding: spacing.md, paddingBottom: 0 }}>
        <CXSearchBar placeholder="Search friends..." value={query} onChangeText={setQuery} />
      </View>
      <ScrollView contentContainerStyle={styles.page}>
        {selected.size > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
            {Array.from(selected).map(id => {
              const u = friends.find(f => f.id === id);
              if (!u) return null;
              return (
                <View key={id} style={{ alignItems: "center", marginRight: spacing.sm, position: "relative" }}>
                  <CXAvatar name={u.name} size={48} />
                  <CXText variant="caption" style={{ marginTop: 4 }}>{u.name.split(" ")[0]}</CXText>
                  <Pressable 
                    onPress={() => toggleSelect(id)} 
                    style={{ position: "absolute", top: 0, right: 0, backgroundColor: colors.white, borderRadius: 10 }}
                  >
                    <Ionicons name="close-circle" size={20} color={colors.textMuted} />
                  </Pressable>
                </View>
              );
            })}
          </ScrollView>
        )}
        <CXSectionHeader title="Contacts" />
        <CXCard>
          {loading ? (
            <View style={{ padding: spacing.md }}><CXText>Loading...</CXText></View>
          ) : (
            filtered.map((user, i) => (
              <React.Fragment key={user.id}>
                <Pressable onPress={() => toggleSelect(user.id)}>
                  <CXRow style={{ paddingVertical: spacing.sm }}>
                    <View style={{ marginRight: spacing.sm }}>
                      <Ionicons 
                        name={selected.has(user.id) ? "checkmark-circle" : "ellipse-outline"} 
                        size={24} 
                        color={selected.has(user.id) ? colors.primary : colors.textMuted} 
                      />
                    </View>
                    <CXUserRow
                      name={user.name}
                      subtitle={user.status}
                      avatar={{ name: user.name }}
                    />
                  </CXRow>
                </Pressable>
                {i < filtered.length - 1 && <View style={styles.divider} />}
              </React.Fragment>
            ))
          )}
        </CXCard>
      </ScrollView>
      {selected.size > 0 && (
        <View style={{ padding: spacing.md }}>
          <CXButton title="Next" onPress={proceed} />
        </View>
      )}
    </CXScreen>
  );
}

export function CreateChatGroupDetailsScreen({ navigation, route }: StackProps<"CreateChatGroupDetails">) {
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);

  const createGroup = async () => {
    if (!title.trim()) return Alert.alert("Please enter a group subject");
    setLoading(true);
    try {
      const res = await api.post<{ data: any }>("/chats/groups", {
        title: title.trim(),
        participantIds: route.params.selectedIds
      });
      navigation.replace("Conversation", {
        conversationId: res.data.data._id,
        name: res.data.data.title,
      });
    } catch (err) {
      Alert.alert("Error", getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <CXScreen>
      <CXHeader title="New Group Subject" onBack={navigation.goBack} />
      <ScrollView contentContainerStyle={styles.page}>
        <View style={{ alignItems: "center", marginVertical: spacing.lg }}>
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.backgroundLavender, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="camera-outline" size={32} color={colors.primary} />
          </View>
        </View>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Group Subject"
          placeholderTextColor={colors.textFaint}
          style={{
            borderBottomWidth: 1,
            borderBottomColor: colors.primary,
            padding: spacing.sm,
            fontSize: 16,
            marginBottom: spacing.lg
          }}
        />
        <CXText variant="caption" color={colors.textMuted}>
          Provide a group subject and optional group icon
        </CXText>
      </ScrollView>
      <View style={{ padding: spacing.md }}>
        <CXButton title={loading ? "Creating..." : "Create"} onPress={createGroup} disabled={loading} />
      </View>
    </CXScreen>
  );
}

export function ChatInfoScreen({ navigation, route }: StackProps<"ChatInfo">) {
  const { conversationId } = route.params;
  const [conversation, setConversation] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchInfo() {
      try {
        const res = await api.get<{ data: any }>(`/chats/${conversationId}`);
        setConversation(res.data.data);
      } catch (err) {
        Alert.alert("Error", getApiErrorMessage(err));
      } finally {
        setLoading(false);
      }
    }
    fetchInfo();
  }, [conversationId]);

  if (loading || !conversation) {
    return (
      <CXScreen>
        <CXHeader title="Chat Info" onBack={navigation.goBack} />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <CXText>Loading...</CXText>
        </View>
      </CXScreen>
    );
  }

  const isGroup = conversation.type === "group";
  // For direct chats, the title is the other person's name
  const title = isGroup ? conversation.title : conversation.participants.find((p: any) => p._id !== useAppStore.getState().user?._id)?.name || "Chat";
  const memberCount = conversation.participants.length;

  return (
    <CXScrollScreen>
      <CXHeader title="Chat Info" onBack={navigation.goBack} />
      <View style={styles.chatInfoHero}>
        <CXAvatar name={title} size={86} />
        <CXText variant="h3">{title}</CXText>
        {isGroup && (
          <CXText variant="caption" color={colors.textMuted}>
            {memberCount} members
          </CXText>
        )}
      </View>
      <CXRow style={styles.infoActions}>
        {[
          ["Mute", "notifications-off-outline"],
          ["Search", "search-outline"],
          ["Shared Files", "folder-outline"],
          ["Notifications", "notifications-outline"],
        ].map(([label, icon]) => (
          <Pressable key={label} style={styles.infoAction}>
            <View style={styles.infoActionIcon}>
              <Ionicons
                name={icon as keyof typeof Ionicons.glyphMap}
                size={21}
                color={colors.primary}
              />
            </View>
            <CXText variant="caption" align="center">
              {label}
            </CXText>
          </Pressable>
        ))}
      </CXRow>
      <CXCard>
        <CXListRow
          icon="images-outline"
          title="Shared Media"
          subtitle="0 photos and videos"
        />
        <CXListRow
          icon="document-text-outline"
          title="Shared Files"
          subtitle="0 documents"
        />
        <CXListRow
          icon="link-outline"
          title="Shared Links"
          subtitle="0 links"
        />
      </CXCard>
      
      {isGroup && (
        <>
          <CXSectionHeader title="Members" action="View all members" />
          {conversation.participants.map((user: any) => (
            <CXUserRow
              key={user._id}
              user={user}
              action=""
              onPress={() =>
                navigation.navigate("UserProfile", { userId: user._id })
              }
            />
          ))}
        </>
      )}

      {isGroup && (
        <CXCard style={styles.dangerCard}>
          <Pressable onPress={() => Alert.alert("Leave Group", "Are you sure you want to leave this group?", [
            { text: "Cancel", style: "cancel" },
            { text: "Leave", style: "destructive", onPress: () => {
              // Leave group logic
              navigation.navigate("Chats" as any);
            }}
          ])}>
            <CXListRow
              icon="log-out-outline"
              iconColor={colors.danger}
              title="Leave group"
            />
          </Pressable>
        </CXCard>
      )}
    </CXScrollScreen>
  );
}

export function AIChatScreen({ route, navigation }: StackProps<"AIChat">) {
  const existingId = route.params?.conversationId;
  const aiConversations = useAppStore((state) => state.aiConversations);
  const saveAIConversation = useAppStore((state) => state.saveAIConversation);
  
  const conversation = existingId ? aiConversations.find(c => c.id === existingId) : null;
  const [chatId, setChatId] = useState(existingId || Math.random().toString(36).substring(7));
  const [messages, setMessages] = useState<ChatMessage[]>(conversation?.messages || []);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const send = async () => {
    const value = text.trim();
    if (!value) return;
    
    const newMessages: ChatMessage[] = [...messages, { role: "user", text: value }];
    setMessages(newMessages);
    setText("");
    setLoading(true);
    setError(null);
    try {
      const reply = await generateChatResponse(newMessages);
      const finalMessages: ChatMessage[] = [
        ...newMessages,
        { role: "assistant", text: reply },
      ];
      setMessages(finalMessages);
      
      const title = finalMessages[0].text.substring(0, 30) + (finalMessages[0].text.length > 30 ? "..." : "");
      saveAIConversation(chatId, title, finalMessages);
    } catch (caught: any) {
      setError(caught.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };
  return (
    <CXScreen>
      <CXRow style={styles.chatHeader}>
        <CXIconButton
          icon="chevron-back"
          label="Go back"
          backgroundColor={colors.transparent}
          onPress={navigation.goBack}
        />
        <View style={styles.aiAvatar}>
          <Ionicons name="sparkles" size={22} color={colors.primary} />
        </View>
        <View style={styles.flex}>
          <CXText variant="bodyStrong">CampusAI</CXText>
          <CXText variant="caption" color={colors.success}>
            Study assistant · Online
          </CXText>
        </View>
        <CXRow>
          <CXIconButton
            icon="create-outline"
            label="New chat"
            backgroundColor={colors.transparent}
            onPress={() => {
              setChatId(Math.random().toString(36).substring(7));
              setMessages([]);
              setError(null);
            }}
          />
          <CXIconButton
            icon="time-outline"
            label="Old conversations"
            backgroundColor={colors.transparent}
            onPress={() => navigation.navigate("AIHistory")}
          />
        </CXRow>
      </CXRow>
        <ScrollView
          contentContainerStyle={styles.aiMessages}
          showsVerticalScrollIndicator={false}
        >
        {messages.length === 0 && (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 100 }}>
            <View style={{ backgroundColor: colors.white, padding: 20, borderRadius: 50, marginBottom: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 }}>
              <Ionicons name="sparkles" size={40} color={colors.primary} />
            </View>
            <CXText variant="h2" align="center" style={{ marginBottom: 10 }}>
              How can I help you today?
            </CXText>
          </View>
        )}
        {messages.map((message, index) => (
          <View
            key={index}
            style={[
              styles.aiMessageRow,
              message.role === "user" && styles.aiMessageMine,
            ]}
          >
            {message.role === "assistant" ? (
              <View style={styles.aiMini}>
                <Ionicons name="sparkles" size={15} color={colors.primary} />
              </View>
            ) : null}
            <View
              style={[
                styles.bubble,
                message.role === "user"
                  ? styles.bubbleMine
                  : styles.bubbleOther,
              ]}
            >
              {message.role === "user" ? (
                <CXText color={colors.white}>
                  {message.text}
                </CXText>
              ) : (
                <Markdown style={{ body: { color: colors.ink, fontSize: 15 } }}>
                  {message.text}
                </Markdown>
              )}
            </View>
          </View>
        ))}
        {loading ? (
          <CXText color={colors.textMuted}>CampusAI is thinking…</CXText>
        ) : null}
        {error ? <CXText color={colors.danger}>{error}</CXText> : null}
      </ScrollView>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={8}>
      <CXRow style={styles.composer}>
        <CXIconButton
          icon="attach-outline"
          label="Attach study material"
          size={38}
          backgroundColor={colors.backgroundLavender}
        />
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Ask CampusAI anything..."
          placeholderTextColor={colors.textFaint}
          multiline
          style={styles.composerInput}
        />
        <CXIconButton
          icon="send"
          label="Send"
          size={42}
          onPress={() => void send()}
        />
      </CXRow>
      </KeyboardAvoidingView>
    </CXScreen>
  );
}

export function AIHistoryScreen({ navigation }: StackProps<"AIHistory">) {
  const aiConversations = useAppStore((state) => state.aiConversations);
  return (
    <CXScreen>
      <CXHeader
        title="AI History"
        onBack={navigation.goBack}
        right={
          <CXIconButton
            icon="trash-outline"
            label="Clear history"
            backgroundColor={colors.transparent}
            onPress={() => useAppStore.getState().clearAIConversations()}
          />
        }
      />
      <ScrollView contentContainerStyle={styles.page}>
        {aiConversations.length === 0 ? (
          <View style={{ flex: 1, alignItems: 'center', marginTop: 100 }}>
            <CXText color={colors.textMuted}>No previous conversations</CXText>
          </View>
        ) : (
          aiConversations.map((conv) => (
            <Pressable key={conv.id} onPress={() => navigation.navigate("AIChat", { conversationId: conv.id })}>
              <CXCard style={styles.historyRow}>
                <View style={styles.historyIcon}>
                  <Ionicons
                    name="chatbubble-ellipses-outline"
                    size={20}
                    color={colors.primary}
                  />
                </View>
                <View style={styles.flex}>
                  <CXText variant="bodyStrong">{conv.title}</CXText>
                  <CXText
                    variant="caption"
                    color={colors.textMuted}
                    numberOfLines={2}
                  >
                    {conv.messages[conv.messages.length - 1]?.text}
                  </CXText>
                </View>
                <CXText variant="caption" color={colors.textFaint}>
                  {new Date(conv.updatedAt).toLocaleDateString()}
                </CXText>
              </CXCard>
            </Pressable>
          ))
        )}
      </ScrollView>
    </CXScreen>
  );
}

export function AIToolsScreen({ navigation }: StackProps<"AITools">) {
  const tools = [
    ["Summarize", "reader-outline", "Turn files into concise notes"],
    ["Quiz me", "help-circle-outline", "Generate practice questions"],
    ["Notes", "create-outline", "Create structured study notes"],
    ["Flashcards", "albums-outline", "Build revision flashcards"],
    ["Explain", "bulb-outline", "Get clear explanations"],
    ["Coding help", "code-slash-outline", "Fix and explain code"],
  ];
  return (
    <CXScrollScreen>
      <CXHeader
        title="AI Study Tools"
        subtitle="Study smarter with CampusAI ✨"
        onBack={navigation.goBack}
      />
      <Pressable
        onPress={() => navigation.navigate("AIChat")}
        style={styles.upload}
      >
        <Ionicons
          name="cloud-upload-outline"
          size={34}
          color={colors.primary}
        />
        <CXText variant="bodyStrong">Upload PDF, notes, or images</CXText>
        <CXText variant="caption" color={colors.textMuted}>
          Drag & drop or tap to browse your study material
        </CXText>
        <CXButton
          label="Browse Files"
          size="sm"
          variant="outline"
          fullWidth={false}
        />
      </Pressable>
      <View style={styles.toolGrid}>
        {tools.map(([label, icon, subtitle]) => (
          <Pressable
            key={label}
            style={styles.toolCell}
            onPress={() => navigation.navigate("AIChat")}
          >
            <View style={styles.toolIcon}>
              <Ionicons
                name={icon as keyof typeof Ionicons.glyphMap}
                size={23}
                color={colors.primary}
              />
            </View>
            <CXText variant="bodyStrong">{label}</CXText>
            <CXText variant="caption" color={colors.textMuted}>
              {subtitle}
            </CXText>
          </Pressable>
        ))}
      </View>
      <CXSectionHeader title="Recent Documents" action="See all" />
      {[
        ["Database Management Systems.pdf", "PDF · 2.4 MB"],
        ["Operating Systems Notes.pdf", "PDF · 1.8 MB"],
        ["Data Structures Diagrams.png", "Image · 820 KB"],
      ].map(([title, subtitle]) => (
        <CXCard key={title} style={styles.document}>
          <Ionicons
            name="document-text-outline"
            size={22}
            color={colors.primary}
          />
          <View style={styles.flex}>
            <CXText variant="smallStrong">{title}</CXText>
            <CXText variant="caption" color={colors.textMuted}>
              {subtitle}
            </CXText>
          </View>
          <Ionicons
            name="ellipsis-vertical"
            size={18}
            color={colors.textMuted}
          />
        </CXCard>
      ))}
    </CXScrollScreen>
  );
}

export function VideoCallScreen({ navigation }: StackProps<"VideoCall">) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.ink }}>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <CXAvatar size={120} name={"Caller"} />
        <CXText variant="h2" color={colors.white} style={{ marginTop: spacing.md }}>{"Caller"}</CXText>
        <CXText variant="body" color={colors.textFaint} style={{ marginTop: spacing.xs }}>Ringing...</CXText>
      </View>
      <View style={{ position: 'absolute', bottom: 60, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: spacing.xl }}>
        <View style={styles.callActionButton}>
          <Ionicons name="mic-off" size={28} color={colors.white} />
        </View>
        <Pressable style={[styles.callActionButton, { backgroundColor: colors.danger }]} onPress={navigation.goBack}>
          <Ionicons name="call" size={28} color={colors.white} style={{ transform: [{ rotate: '135deg' }] }} />
        </Pressable>
        <View style={styles.callActionButton}>
          <Ionicons name="camera-reverse" size={28} color={colors.white} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  page: {
    paddingHorizontal: spacing.screen,
    paddingBottom: spacing.xxxl,
    gap: spacing.md,
  },
  chatHeader: {
    minHeight: 58,
    paddingHorizontal: spacing.xs,
    gap: spacing.xxs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.white,
  },
  messageList: { padding: spacing.md, gap: spacing.sm },
  messageRow: { alignItems: "flex-start" },
  messageRowMine: { alignItems: "flex-end" },
  bubble: {
    maxWidth: "82%",
    borderRadius: radius.md,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  bubbleMine: { backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  bubbleOther: {
    backgroundColor: colors.surfaceLavender,
    borderBottomLeftRadius: 4,
  },
  attachment: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    padding: spacing.xs,
    borderRadius: radius.sm,
    backgroundColor: colors.white,
  },
  attachmentMine: { backgroundColor: "rgba(255,255,255,.16)" },
  messageMeta: { alignSelf: "flex-end", gap: 3 },
  composer: {
    padding: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.white,
    gap: spacing.xs,
  },
  composerInput: {
    flex: 1,
    maxHeight: 110,
    minHeight: 42,
    borderRadius: radius.pill,
    backgroundColor: colors.backgroundLavender,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    color: colors.ink,
    ...typography.body,
  },
  frequent: { gap: spacing.sm },
  frequentPerson: { width: 64, alignItems: "center", gap: 4 },
  frequentRing: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.primary,
  },
  chatInfoHero: { alignItems: "center", gap: spacing.xs },
  infoActions: { justifyContent: "space-between", marginVertical: spacing.md },
  infoAction: { width: "24%", alignItems: "center", gap: spacing.xs },
  infoActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: colors.surfaceLavender,
    alignItems: "center",
    justifyContent: "center",
  },
  dangerCard: { marginTop: spacing.md, borderColor: colors.dangerTint },
  aiAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.surfaceLavender,
    alignItems: "center",
    justifyContent: "center",
  },
  aiMessages: { padding: spacing.md, gap: spacing.sm },
  aiQuick: { justifyContent: "space-between" },
  aiQuickItem: {
    width: "23%",
    minHeight: 72,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  aiMessageRow: {
    flexDirection: "row",
    gap: spacing.xs,
    alignItems: "flex-end",
  },
  aiMessageMine: { justifyContent: "flex-end" },
  aiMini: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surfaceLavender,
    alignItems: "center",
    justifyContent: "center",
  },
  historyRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    padding: spacing.sm,
  },
  historyIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceLavender,
    alignItems: "center",
    justifyContent: "center",
  },
  feedFilters: { gap: spacing.xs },
  upload: {
    minHeight: 170,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.primary,
    backgroundColor: colors.backgroundLavender,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
    gap: spacing.xs,
  },
  toolGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  toolCell: {
    width: "48%",
    minHeight: 130,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    padding: spacing.md,
    gap: spacing.xs,
  },
  toolIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.surfaceLavender,
    alignItems: "center",
    justifyContent: "center",
  },
  document: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.sm,
  },
  callActionButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  replyPreviewWrapper: {
    flexDirection: "row",
    backgroundColor: colors.backgroundLavender,
    marginHorizontal: spacing.sm,
    marginBottom: spacing.xs,
    borderRadius: radius.md,
    overflow: "hidden",
    alignItems: "center",
  },
  replyPreviewBar: {
    width: 4,
    height: "100%",
    backgroundColor: colors.primary,
    marginRight: spacing.sm,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: 320,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.md,
    elevation: 5,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  reactionRow: {
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
  },
  reactionBtn: {
    padding: spacing.xs,
  },
  modalDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  modalOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  modalOptionText: {
    fontSize: 16,
    color: colors.ink,
  },
  replyQuote: {
    flexDirection: "row",
    backgroundColor: "rgba(0,0,0,0.05)",
    borderRadius: radius.sm,
    overflow: "hidden",
    marginBottom: 4,
    paddingRight: spacing.sm,
  },
  replyQuoteMine: {
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  replyQuoteOther: {
    backgroundColor: "rgba(0,0,0,0.05)",
  },
  replyBar: {
    width: 4,
    marginRight: spacing.xs,
  },
  replyBarMine: {
    backgroundColor: colors.white,
  },
  replyBarOther: {
    backgroundColor: colors.primary,
  },
  reactionBadge: {
    position: "absolute",
    bottom: -10,
    backgroundColor: colors.white,
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
  },
  reactionBadgeMine: {
    right: 12,
  },
  reactionBadgeOther: {
    left: 12,
  },
  reactionText: {
    fontSize: 12,
  },
});
