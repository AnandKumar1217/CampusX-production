import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useEffect, useRef, useState, useDeferredValue, useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  ActivityIndicator,
  Image,
  Linking,
  Keyboard,
  InteractionManager,
  Animated,
} from "react-native";
import { useReanimatedKeyboardAnimation } from "react-native-keyboard-controller";
import Reanimated, { useAnimatedStyle } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
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
  CXActionSheet,
} from "@/components/ui";
import { useAppStore } from "@/store/appStore";
import { generateChatResponse, type ChatMessage } from "@/services/ai";
import { api, getApiErrorMessage } from "@/services/api";
import { groupService } from "@/services/groupService";
import { getSocket } from "@/services/socket";
import { startAudioCall } from "@/services/audioCall";
import { colors, radius, spacing, typography } from "@/theme";
import type { Message } from "@/types/domain";
import type { RootStackParamList } from "@/types/navigation";

type StackProps<Name extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  Name
>;

export function ConversationScreen({ navigation, route }: StackProps<"Conversation" | "GroupConversation">) {
  const isStudyGroup = route.name === "GroupConversation";
  const conversationId = isStudyGroup ? (route.params as any).groupId : (route.params as any).conversationId;
  
  const currentUser = useAppStore((state) => state.user);
  const friends = useAppStore((state) => state.friends);
  const [text, setText] = useState("");
  const [messages, setMessages] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [remoteTyping, setRemoteTyping] = useState(false);
  const [conversation, setConversation] = useState<any>(null);
  const [dataOwnerId, setDataOwnerId] = useState<string | null>(null);
  const [messageError, setMessageError] = useState<string | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [replyTo, setReplyTo] = useState<any>(null);
  const [selectedMessage, setSelectedMessage] = useState<any>(null);
  const [deleteMessageVisible, setDeleteMessageVisible] = useState<any>(null);

  const insets = useSafeAreaInsets();
  const { height } = useReanimatedKeyboardAnimation();
  const animatedContainerStyle = useAnimatedStyle(() => ({
    paddingBottom: Math.max(insets.bottom, Math.abs(height.value)),
  }));

  const fetchMessages = async (pageNumber = 1) => {
    try {
      const endpoint = isStudyGroup 
        ? `/groups/${conversationId}/messages?page=${pageNumber}&limit=50`
        : `/chats/${conversationId}/messages?page=${pageNumber}&limit=50`;
      
      const res = await api.get<{ data: { items: any[], hasMore: boolean } }>(endpoint);
      if (useAppStore.getState().user?.id !== currentUser?.id) return;
      if (pageNumber === 1) {
        setMessages(res.data.data.items);
        setDataOwnerId(currentUser?.id || null);
      } else {
        setMessages(prev => [...prev, ...res.data.data.items]);
      }
      setHasMore(res.data.data.items.length === 50);
      setMessageError(null);

      if (pageNumber === 1 && !isStudyGroup) {
        // Mark as delivered and read for DMs only
        api.post(`/chats/${conversationId}/delivered`).catch(() => {});
        api.post(`/chats/${conversationId}/read`).catch(() => {});
      }
    } catch (err) {
      if (useAppStore.getState().user?.id === currentUser?.id) setMessageError(getApiErrorMessage(err));
    } finally {
      if (useAppStore.getState().user?.id === currentUser?.id) setLoading(false);
    }
  };

  useEffect(() => {
    setMessages([]);
    setDataOwnerId(null);
    setConversation(null);
    setLoading(true);
    setPage(1);
    setHasMore(true);
    const refreshConversation = () => {
      const endpoint = isStudyGroup ? `/groups/${conversationId}` : `/chats/${conversationId}`;
      return api.get<{ data: any }>(endpoint)
        .then((response) => { if (useAppStore.getState().user?.id === currentUser?.id) setConversation(response.data.data); })
        .catch((error) => { if (useAppStore.getState().user?.id === currentUser?.id) setMessageError(getApiErrorMessage(error)); });
    };

    void fetchMessages(1);
    void refreshConversation();

    const socket = getSocket();
    const onProfileUpdated = (payload: any) => {
      refreshConversation();
      setMessages(prev => prev.map(m => {
        if (m.sender?._id === payload.userId || m.sender?.id === payload.userId) {
          return { ...m, sender: { ...m.sender, avatarUrl: payload.avatarUrl, name: payload.name || m.sender?.name } };
        }
        return m;
      }));
    };
    socket?.on("profile:updated", onProfileUpdated);
    socket?.on("presence:changed", refreshConversation);
    socket?.on("group:updated", refreshConversation);
    socket?.on("chat:updated", refreshConversation);
    if (socket) {
      const joinEvent = isStudyGroup ? "group:join" : "conversation:join";
      const leaveEvent = isStudyGroup ? "group:leave" : "conversation:leave";
      const newMsgEvent = isStudyGroup ? "group:message:new" : "message:new";

      socket.emit(joinEvent, conversationId);
      const onReconnect = () => {
        socket.emit(joinEvent, conversationId);
        void fetchMessages(1);
        void refreshConversation();
      };
      socket.on("connect", onReconnect);

      const onNewMessage = (msg: any) => {
        const msgConvId = msg.conversation || msg.group;
        if (msgConvId?.toString() === conversationId.toString()) {
          setMessages(prev => {
            // Deduplicate by database _id or by nonce
            if (prev.some(m => m._id === msg._id || (msg.nonce && m.nonce === msg.nonce))) {
              // If we found it by nonce, we should replace the temp one with the real one
              return prev.map(m => m.nonce === msg.nonce ? msg : m);
            }
            return [msg, ...prev];
          });
          if (!isStudyGroup) {
            api.post(`/chats/${conversationId}/delivered`).catch(() => {});
            api.post(`/chats/${conversationId}/read`).catch(() => {});
          }
        }
      };

      const onMessageRead = (data: { conversationId: string, userId: string }) => {
        if (data.conversationId?.toString() === conversationId.toString()) {
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
        if (data.conversationId?.toString() === conversationId.toString()) {
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
        if (data.conversationId?.toString() === conversationId.toString() && data.userId !== currentUser?.id) {
          setRemoteTyping(true);
        }
      };

      const onTypingStop = (data: { conversationId: string, userId: string }) => {
        if (data.conversationId?.toString() === conversationId.toString() && data.userId !== currentUser?.id) {
          setRemoteTyping(false);
        }
      };

      socket.on(newMsgEvent, onNewMessage);
      socket.on("message:read", onMessageRead);
      socket.on("message:delivered", onMessageDelivered);
      socket.on("typing:start", onTypingStart);
      socket.on("typing:stop", onTypingStop);

      const onMessageDeleted = (data: { messageId: string, conversationId: string }) => {
        if (data.conversationId?.toString() === conversationId.toString()) {
          setMessages(prev => prev.filter(m => m._id !== data.messageId));
        }
      };
      socket.on("message:deleted", onMessageDeleted);

      const onMessageReaction = (data: { messageId: string, reactions: any[] }) => {
        setMessages(prev => prev.map(m => m._id === data.messageId ? { ...m, reactions: data.reactions } : m));
      };
      socket.on("message:reaction", onMessageReaction);

      return () => {
        socket.off("profile:updated", onProfileUpdated);
        socket.off("presence:changed", refreshConversation);
        socket.off("group:updated", refreshConversation);
        socket.off("chat:updated", refreshConversation);
        socket.off("connect", onReconnect);
        socket.off(newMsgEvent, onNewMessage);
        socket.off("message:read", onMessageRead);
        socket.off("message:delivered", onMessageDelivered);
        socket.off("typing:start", onTypingStart);
        socket.off("typing:stop", onTypingStop);
        socket.off("message:deleted", onMessageDeleted);
        socket.off("message:reaction", onMessageReaction);
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
          socket.emit("typing:stop", { conversationId });
        }
        socket.emit(leaveEvent, conversationId);
      };
    }
  }, [conversationId, currentUser?.id, isStudyGroup]);

  const handleTextChange = (val: string) => {
    setText(val);
    const socket = getSocket();
    if (socket) {
      socket.emit("typing:start", { conversationId });
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit("typing:stop", { conversationId });
      }, 2000);
    }
  };

  const [media, setMedia] = useState<ImagePicker.ImagePickerAsset | null>(null);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.[0]) {
      setMedia(result.assets[0]);
    }
  };

  const send = async () => {
    const value = text.trim();
    if (!value && !media) return;

    const tempId = `temp-${Date.now()}`;
    const nonce = tempId;
    const temp = {
      _id: tempId,
      nonce,
      text: value,
      sender: { _id: currentUser?.id, name: currentUser?.name || "You" },
      attachments: media ? [{ url: media.uri, name: media.fileName || "image.jpg" }] : [],
      createdAt: new Date().toISOString(),
      status: "sending"
    };

    setMessages(prev => [temp, ...prev]);
    setText("");
    const currentMedia = media;
    setMedia(null);
    setReplyTo(null);

    try {
      let attachments: any[] = [];
      if (currentMedia) {
        const formData = new FormData();
        formData.append("file", {
          uri: currentMedia.uri,
          name: currentMedia.fileName || "image.jpg",
          type: currentMedia.mimeType || "image/jpeg",
        } as any);
        const uploadRes = await api.post<{ data: any }>("/upload", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        attachments.push({
          url: uploadRes.data.data.url,
          publicId: uploadRes.data.data.publicId,
          name: uploadRes.data.data.originalName,
          mimeType: uploadRes.data.data.mimeType,
          size: uploadRes.data.data.size,
        });
      }

      const endpoint = isStudyGroup 
        ? `/groups/${conversationId}/messages`
        : `/chats/${conversationId}/messages`;

      const response = await api.post<{ data: any }>(
        endpoint,
        { text: value, replyTo: replyTo?._id, nonce, attachments }
      );
      setMessages(prev => prev.map(m => m.nonce === nonce ? { ...response.data.data, status: "sent" } : m));
    } catch {
      setMessages(prev => prev.map(m => m.nonce === nonce ? { ...m, status: "failed" } : m));
    }
  };

  const visibleConversation = dataOwnerId === currentUser?.id ? conversation : null;
  const isGroupConversation = visibleConversation?.type === "group" || isStudyGroup;
  const otherParticipant = !isGroupConversation ? visibleConversation?.participants?.find((p: any) => p._id !== currentUser?.id) : undefined;
  const title = isGroupConversation ? visibleConversation?.title || visibleConversation?.name || route.params.name || "Group chat" : otherParticipant?.name || route.params.name || "Chat";
  const avatarUrl = isGroupConversation ? visibleConversation?.avatarUrl : otherParticipant?.avatarUrl;
  const isFriend = !!otherParticipant && friends.some((friend) => friend.id === otherParticipant._id);
  const info = () => {
    if (isStudyGroup) navigation.navigate("GroupDetails", { groupId: conversationId });
    else navigation.navigate("ChatInfo", { conversationId });
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
    <CXScreen edges={["top", "right", "left"]}>
      <Reanimated.View style={[styles.flex, animatedContainerStyle]}>
        <CXRow style={styles.chatHeader}>
        <CXIconButton icon="chevron-back" label="Go back" backgroundColor={colors.transparent} onPress={navigation.goBack} />
        <Pressable onPress={info} style={styles.chatIdentity} accessibilityRole="button">
          <CXAvatar name={title} source={avatarUrl} size={40} />
          <View style={styles.flex}>
            <CXText variant="bodyStrong" numberOfLines={1}>{title}</CXText>
            {(remoteTyping || (isFriend && otherParticipant?.online)) && <CXText variant="caption" color={colors.success}>
              {remoteTyping ? "Typing..." : "Online"}
            </CXText>}
          </View>
        </Pressable>
        {Platform.OS !== "web" && !isGroupConversation && isFriend && otherParticipant && <CXIconButton icon="call-outline" label="Audio call" backgroundColor={colors.transparent}
          onPress={() => void startAudioCall({ conversationId, peerId: otherParticipant._id, name: title, avatarUrl })} />}
        <CXIconButton icon="ellipsis-horizontal" label="Chat info" backgroundColor={colors.transparent} onPress={info} />
      </CXRow>
      {messageError && <Pressable onPress={() => void fetchMessages(1)} style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.xs }}>
        <CXText variant="small" color={colors.danger}>{messageError} · Tap to retry</CXText>
      </Pressable>}
      <FlatList
        data={dataOwnerId === currentUser?.id ? messages : []}
        ListEmptyComponent={loading ? <ActivityIndicator style={{ marginTop: spacing.xl }} color={colors.primary} /> :
          !messageError ? <CXText variant="small" color={colors.textMuted} align="center" style={{ marginTop: spacing.xl }}>No messages yet</CXText> : null}
        inverted
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.messageList}
        showsVerticalScrollIndicator={false}
        initialNumToRender={15}
        maxToRenderPerBatch={10}
        windowSize={10}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        renderItem={({ item }) => (
          <MessageBubble
            message={item}
            mine={item.sender?._id === currentUser?.id || item.senderId === currentUser?.id}
            onLongPress={() => setSelectedMessage(item)}
            isGroup={isGroupConversation || isStudyGroup}
          />
        )}
      />
      {visibleConversation && (isGroupConversation || isFriend) ? <>
        {replyTo && (
          <View style={styles.replyPreviewWrapper}>
            <View style={styles.replyPreviewBar} />
            <View style={styles.flex}>
              <CXText variant="smallStrong" color={colors.primary}>{replyTo.sender?.name || "User"}</CXText>
              <CXText variant="caption" numberOfLines={1}>{replyTo.text}</CXText>
            </View>
            <CXIconButton label="Remove reply" icon="close" size={24} onPress={() => setReplyTo(null)} backgroundColor={colors.transparent} />
          </View>
        )}
        {media && (
          <View style={styles.replyPreviewWrapper}>
            <Image source={{ uri: media.uri }} style={{ width: 50, height: 50, borderRadius: 8, marginRight: 10 }} />
            <View style={styles.flex}>
              <CXText variant="smallStrong" color={colors.primary}>Attached Image</CXText>
            </View>
            <CXIconButton label="Remove media" icon="close" size={24} onPress={() => setMedia(null)} backgroundColor={colors.transparent} />
          </View>
        )}
        <CXRow style={styles.composer}>
          <CXIconButton icon="attach-outline" label="Attach file" size={38} backgroundColor={colors.backgroundLavender} onPress={pickImage} />
          <TextInput
            value={text}
            onChangeText={handleTextChange}
            placeholder="Type a message..."
            placeholderTextColor={colors.textFaint}
            multiline
            style={styles.composerInput}
          />
          {(text.trim() || media) && <CXIconButton icon="send" label="Send message" size={42} onPress={() => void send()} />}
        </CXRow>
      </> : visibleConversation?.type === "direct" ?
        <CXText variant="small" color={colors.textMuted} align="center" style={{ padding: spacing.md }}>
          You can only message friends.
        </CXText> : null}
      </Reanimated.View>

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
                    api.post(`/${isStudyGroup ? "groups" : "chats"}/${conversationId}/messages/${selectedMessage._id}/reaction`, { emoji }).catch((err) => console.log(getApiErrorMessage(err)));
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
            {(selectedMessage?.sender?._id === currentUser?.id || selectedMessage?.senderId === currentUser?.id) && (
              <>
                <View style={styles.modalDivider} />
                <Pressable style={styles.modalOption} onPress={() => {
                  setDeleteMessageVisible(selectedMessage);
                  setSelectedMessage(null);
                }}>
                  <Ionicons name="trash-outline" size={20} color={colors.danger} />
                  <CXText style={[styles.modalOptionText, { color: colors.danger }]}>Delete Message</CXText>
                </Pressable>
              </>
            )}
          </View>
        </Pressable>
      </Modal>

      <CXActionSheet
        visible={!!deleteMessageVisible}
        onClose={() => setDeleteMessageVisible(null)}
        actions={[
          {
            label: "Delete Message",
            icon: "trash-outline",
            destructive: true,
            confirmationTitle: "Delete Message",
            confirmationMessage: "Are you sure you want to delete this message for everyone?",
            confirmationButtonText: "Delete",
            onPress: () => {
              if (deleteMessageVisible) {
                api.delete(`/${isStudyGroup ? "groups" : "chats"}/${conversationId}/messages/${deleteMessageVisible._id}`).catch((err) => console.log(getApiErrorMessage(err)));
                setDeleteMessageVisible(null);
              }
            }
          }
        ]}
      />
    </CXScreen>
  );
}

function MessageBubble({ message, mine, onLongPress, isGroup }: { message: any; mine: boolean; onLongPress?: () => void, isGroup?: boolean }) {
  // Simple hash to assign a unique color to each user's name
  const nameColors = ["#E57373", "#F06292", "#BA68C8", "#9575CD", "#7986CB", "#64B5F6", "#4FC3F7", "#4DD0E1", "#4DB6AC", "#81C784", "#AED581", "#FF8A65"];
  const colorIndex = message.sender?.name ? message.sender.name.split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0) % nameColors.length : 0;
  const senderColor = nameColors[colorIndex];

  const timeString = message.createdAt
    ? new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : "Now";

  const senderId = String(message.sender?._id || message.senderId || "");
  const recipientRecorded = (entries: any[] | undefined) => entries?.some((entry) =>
    String(entry.user?._id || entry.user || "") !== senderId
  ) ?? false;
  const status = message.status === "failed" || message.status === "sending" ? message.status :
    recipientRecorded(message.readBy) ? "read" : recipientRecorded(message.deliveredTo) ? "delivered" : "sent";

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
      {!mine && isGroup && (
        <View style={{ justifyContent: 'flex-end', marginBottom: 2, marginRight: 6 }}>
          <CXAvatar source={message.sender?.avatarUrl} name={message.sender?.name || "User"} size={28} />
        </View>
      )}
      <Pressable
        style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}
        onLongPress={onLongPress}
        delayLongPress={300}
      >
        {!mine && isGroup && (
          <CXText variant="smallStrong" style={{ color: senderColor, marginBottom: 2 }}>{message.sender?.name || "Member"}</CXText>
        )}
        {message.replyTo && (
          <View style={[styles.replyQuote, mine ? styles.replyQuoteMine : styles.replyQuoteOther]}>
            <View style={[styles.replyBar, mine ? styles.replyBarMine : styles.replyBarOther]} />
            <View style={styles.flex}>
              <CXText variant="smallStrong" color={mine ? colors.white : colors.primary}>{message.replyTo.sender?.name}</CXText>
              <CXText variant="caption" color={mine ? "#EDE9FF" : colors.ink} numberOfLines={1}>{message.replyTo.text}</CXText>
            </View>
          </View>
        )}
        {message.attachments && message.attachments.length > 0 && (
          <View style={{ marginBottom: 4 }}>
            {message.attachments.map((att: any, i: number) => <Pressable key={`${message._id}-${i}`}
              onPress={() => void Linking.openURL(att.url)} accessibilityRole="link">
              {att.mimeType?.startsWith("image/") || /\.(jpg|jpeg|png|webp)(\?|$)/i.test(att.url) ?
                <Image source={{ uri: att.url }} style={{ width: 200, height: 200, borderRadius: 8, marginBottom: 4 }} /> :
                <CXRow style={{ padding: spacing.sm, gap: spacing.xs }}>
                  <Ionicons name="document-outline" size={20} color={mine ? colors.white : colors.ink} />
                  <CXText variant="small" color={mine ? colors.white : colors.ink}>{att.name || "Open attachment"}</CXText>
                </CXRow>}
            </Pressable>)}
          </View>
        )}
        {!!message.text && <CXText color={mine ? colors.white : colors.ink}>{message.text}</CXText>}
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
  const refreshFriends = useAppStore((state) => state.fetchFriends);
  const [loading, setLoading] = useState(true);
  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    void refreshFriends().finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [refreshFriends]));

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
    <CXScreen edges={["top", "right", "left", "bottom"]}>
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
              user={user as any}
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
  const refreshFriends = useAppStore((state) => state.fetchFriends);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    void refreshFriends().finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [refreshFriends]));

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
    <CXScreen edges={["top", "right", "left", "bottom"]}>
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
                  <CXAvatar name={u.name} source={u.avatarUrl || u.avatar || undefined} size={48} />
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
                <Pressable onPress={() => toggleSelect(user.id)} accessibilityRole="checkbox" accessibilityState={{ checked: selected.has(user.id) }}>
                  <CXRow style={{ paddingVertical: spacing.sm, gap: spacing.sm }}>
                    <View style={{ marginRight: spacing.sm }}>
                      <Ionicons
                        name={selected.has(user.id) ? "checkmark-circle" : "ellipse-outline"}
                        size={24}
                        color={selected.has(user.id) ? colors.primary : colors.textMuted}
                      />
                    </View>
                    <CXAvatar name={user.name} source={user.avatarUrl || user.avatar || undefined} size={42} />
                    <View style={styles.flex}>
                      <CXText variant="bodyStrong">{user.name}</CXText>
                      <CXText variant="caption" color={colors.textMuted}>
                        {[user.department, user.academicYear].filter(Boolean).join(" · ")}
                      </CXText>
                    </View>
                  </CXRow>
                </Pressable>
                {i < filtered.length - 1 && <View style={{ height: 1, backgroundColor: colors.border }} />}
              </React.Fragment>
            ))
          )}
        </CXCard>
      </ScrollView>
      {selected.size > 0 && (
        <View style={{ padding: spacing.md }}>
          <CXButton label="Next" onPress={proceed} />
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
            <Ionicons name="people-outline" size={32} color={colors.primary} />
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
          Give your group chat a name.
        </CXText>
      </ScrollView>
      <View style={{ padding: spacing.md }}>
        <CXButton label={loading ? "Creating..." : "Create"} onPress={createGroup} disabled={loading} />
      </View>
    </CXScreen>
  );
}

export function ChatInfoScreen({ navigation, route }: StackProps<"ChatInfo">) {
  const { conversationId } = route.params;
  const currentUserId = useAppStore((state) => state.user?.id);
  const [conversation, setConversation] = useState<any>(null);
  const [dataOwnerId, setDataOwnerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setConversation(null);
    setDataOwnerId(null);
    setLoading(true);
    const fetchInfo = async () => {
      try {
        const res = await api.get<{ data: any }>(`/chats/${conversationId}`);
        if (active) {
          if (useAppStore.getState().user?.id !== currentUserId) return;
          setConversation(res.data.data);
          setDataOwnerId(currentUserId || null);
          setError(null);
        }
      } catch (err) {
        if (active && useAppStore.getState().user?.id === currentUserId) setError(getApiErrorMessage(err));
      } finally {
        if (active && useAppStore.getState().user?.id === currentUserId) setLoading(false);
      }
    };
    void fetchInfo();
    const socket = getSocket();
    socket?.on("profile:updated", fetchInfo);
    return () => {
      active = false;
      socket?.off("profile:updated", fetchInfo);
    };
  }, [conversationId, currentUserId]);

  if (loading || !conversation || dataOwnerId !== currentUserId) {
    return <CXScreen>
      <CXHeader title="Chat Info" onBack={navigation.goBack} />
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm }}>
        {loading ? <ActivityIndicator color={colors.primary} /> : <CXText color={colors.danger}>{error || "Conversation unavailable"}</CXText>}
      </View>
    </CXScreen>;
  }

  const isGroup = conversation.type === "group";
  const peer = conversation.participants.find((participant: any) => participant._id !== currentUserId);
  const title = isGroup ? conversation.title || "Group chat" : peer?.name || "Chat";
  const avatarUrl = isGroup ? conversation.avatarUrl : peer?.avatarUrl;
  const admins = new Set((conversation.admins || []).map((admin: any) => typeof admin === "string" ? admin : admin._id));

  return <CXScrollScreen>
    <CXHeader title={isGroup ? "Group Info" : "Chat Info"} onBack={navigation.goBack} />
    <View style={styles.chatInfoHero}>
      <CXAvatar name={title} source={avatarUrl} size={86} />
      <CXText variant="h3">{title}</CXText>
      {isGroup && <CXText variant="caption" color={colors.textMuted}>{conversation.participants.length} members</CXText>}
      {!isGroup && peer?.username && <CXText variant="caption" color={colors.textMuted}>@{peer.username}</CXText>}
    </View>
    {!isGroup && peer && <CXCard>
      <CXListRow icon="person-outline" title="View Profile" subtitle="See their CampusX profile"
        onPress={() => navigation.navigate("UserProfile", { userId: peer._id })} />
    </CXCard>}
    {isGroup && <>
      <CXSectionHeader title="Members" />
      <CXCard>
        {conversation.participants.map((participant: any) => <Pressable key={participant._id}
          onPress={() => navigation.navigate("UserProfile", { userId: participant._id })}
          style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.sm }} accessibilityRole="button">
          <CXAvatar name={participant.name || "Member"} source={participant.avatarUrl} size={42} />
          <View style={styles.flex}>
            <CXText variant="bodyStrong">{participant.name || "Member"}</CXText>
            {admins.has(participant._id) && <CXText variant="caption" color={colors.primary}>Admin</CXText>}
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Pressable>)}
      </CXCard>
    </>}
  </CXScrollScreen>;
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

  const keyboardHeightAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEvent, (e) => {
      Animated.timing(keyboardHeightAnim, {
        toValue: e.endCoordinates.height,
        duration: 250,
        useNativeDriver: false,
      }).start();
    });

    const hideSub = Keyboard.addListener(hideEvent, (e) => {
      Animated.timing(keyboardHeightAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: false,
      }).start();
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);
  const send = async () => {
    const value = text.trim();
    if (!value || loading) return;

    const newMessages: ChatMessage[] = [...messages, { role: "user", text: value }];
    setMessages(newMessages);
    setText("");
    setLoading(true);
    setError(null);
    try {
      const { reply: aiText, conversationId: backendId } = await generateChatResponse(newMessages, chatId);
      const finalMessages: ChatMessage[] = [
        ...newMessages,
        { role: "assistant", text: aiText },
      ];
      setMessages(finalMessages);

      const title = finalMessages[0]?.text ? finalMessages[0].text.substring(0, 30) + (finalMessages[0].text.length > 30 ? "..." : "") : "Summary";
      saveAIConversation(backendId || chatId, title, finalMessages);
      if (backendId && backendId !== chatId) {
        setChatId(backendId);
      }
    } catch (caught: any) {
      setError(caught.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };
  return (
    <CXScreen>
      <CXRow style={[styles.chatHeader, { borderBottomWidth: 1, borderBottomColor: colors.borderSoft, paddingVertical: spacing.sm }]}>
        <CXIconButton
          icon="chevron-back"
          label="Go back"
          backgroundColor={colors.transparent}
          onPress={navigation.goBack}
        />
        <LinearGradient colors={["#6366F1", "#A855F7"]} style={[styles.aiAvatar, { width: 38, height: 38, borderRadius: 19, backgroundColor: 'transparent' }]}>
          <Ionicons name="sparkles" size={18} color={colors.white} />
        </LinearGradient>
        <View style={styles.flex}>
          <CXText variant="bodyStrong" style={{ fontSize: 16 }}>CampusAI</CXText>
          <CXText variant="caption" color={colors.primary} style={{ fontWeight: "600" }}>
            Study assistant
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
          contentContainerStyle={[styles.aiMessages, { paddingBottom: spacing.xxl }]}
          showsVerticalScrollIndicator={false}
        >
        {messages.length === 0 && (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 40, paddingHorizontal: spacing.lg }}>
            <LinearGradient colors={["#6366F1", "#A855F7"]} style={{ padding: 20, borderRadius: 32, marginBottom: 20, shadowColor: "#6366F1", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 15, elevation: 8 }}>
              <Ionicons name="sparkles" size={42} color={colors.white} />
            </LinearGradient>
            <CXText variant="h2" align="center" style={{ marginBottom: 8 }}>
              CampusAI
            </CXText>
            <CXText variant="body" color={colors.textMuted} align="center" style={{ marginBottom: 32 }}>
              Your personal study assistant. Ask me anything about your courses, schedules, or ideas.
            </CXText>
            
            <View style={{ width: '100%', gap: 12 }}>
              {[
                { icon: "book", text: "Explain a complex topic" },
                { icon: "pencil", text: "Help me write an essay outline" },
                { icon: "bulb", text: "Quiz me on my subjects" },
              ].map((item, idx) => (
                <Pressable key={idx} onPress={() => { setText(item.text); }} style={({pressed}) => [{ backgroundColor: colors.white, padding: 16, borderRadius: radius.xl, flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1, borderColor: colors.borderSoft, shadowColor: "#000", shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.03, shadowRadius: 8, elevation: 1 }, pressed && {opacity: 0.7, transform: [{scale: 0.98}]}]}>
                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "#F5F3FF", alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name={item.icon as any} size={20} color="#8B5CF6" />
                  </View>
                  <CXText variant="bodyStrong">{item.text}</CXText>
                  <Ionicons name="chevron-forward" size={18} color={colors.textFaint} style={{ marginLeft: 'auto' }} />
                </Pressable>
              ))}
            </View>
          </View>
        )}
        {messages.map((message, index) => (
          <View
            key={index}
            style={[
              styles.aiMessageRow,
              message.role === "user" && styles.aiMessageMine,
              { marginBottom: spacing.md }
            ]}
          >
            {message.role === "assistant" ? (
              <LinearGradient colors={["#6366F1", "#A855F7"]} style={[styles.aiMini, { marginTop: 4, backgroundColor: 'transparent' }]}>
                <Ionicons name="sparkles" size={14} color={colors.white} />
              </LinearGradient>
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
                <CXText color={colors.white} style={{ fontSize: 15, lineHeight: 22 }}>
                  {message.text}
                </CXText>
              ) : (
                <Markdown style={{ body: { color: colors.ink, fontSize: 15, lineHeight: 24 }, paragraph: { marginTop: 0, marginBottom: 10 } }}>
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
      <Animated.View style={{ paddingBottom: keyboardHeightAnim }}>
      <CXRow style={[styles.composer, { paddingVertical: spacing.sm, paddingHorizontal: spacing.md }]}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Ask CampusAI anything..."
          placeholderTextColor={colors.textFaint}
          multiline
          style={[styles.composerInput, { backgroundColor: "#F3F4F6", borderColor: colors.borderSoft, borderWidth: 1 }]}
        />
        <CXIconButton
          icon="send"
          label="Send"
          size={46}
          backgroundColor={text.trim() ? colors.primary : "#E5E7EB"}
          color={colors.white}
          disabled={loading || !text.trim()}
          onPress={() => void send()}
        />
      </CXRow>
      </Animated.View>
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
            <Pressable key={conv.id} onPress={() => {
              navigation.reset({
                index: 1,
                routes: [
                  { name: "Main" },
                  { name: "AIChat", params: { conversationId: conv.id } }
                ],
              });
            }}>
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
    maxWidth: "85%",
    borderRadius: radius.xl,
    padding: spacing.md,
    gap: spacing.xs,
  },
  bubbleMine: { backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  bubbleOther: {
    backgroundColor: colors.white,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
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
    gap: spacing.sm,
    alignItems: "flex-start",
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
  chatIdentity: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm },
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
