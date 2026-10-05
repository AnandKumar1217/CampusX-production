import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useEffect, useMemo, useRef, useState, useDeferredValue, useCallback } from "react";
import { useFocusEffect, useIsFocused } from "@react-navigation/native";
import {
  Alert,
  AppState,
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
  Keyboard,
  InteractionManager,
  Animated,
  Text,
} from "react-native";
import { useReanimatedKeyboardAnimation } from "react-native-keyboard-controller";
import Reanimated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import * as Clipboard from "expo-clipboard";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
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
  CXSnackbar,
} from "@/components/ui";
import { useAppStore } from "@/store/appStore";
import { generateChatResponse, type ChatMessage } from "@/services/ai";
import { api, getApiErrorMessage } from "@/services/api";
import { groupService } from "@/services/groupService";
import { connectSocket, getSocket, subscribeSocketEvent, emitSocketEvent } from "@/services/socket";
import { startAudioCall } from "@/services/audioCall";
import { getChatDateLabel, mergeChatMessages } from "@/services/chatLogic";
import { queryClient } from "@/query/queryClient";
import { colors, radius, spacing, typography } from "@/theme";
import type { Message } from "@/types/domain";
import type { RootStackParamList } from "@/types/navigation";

type StackProps<Name extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  Name
>;

type MessageCursor = { createdAt: string; id: string } | null;
type ChatListRow = any | { _rowType: "date"; _id: string; label: string } | { _rowType: "unread"; _id: string; count: number };
type PendingOutgoing = {
  clientMessageId: string;
  conversationId: string;
  text: string;
  replyTo?: string;
  createdAt: string;
  localImage?: Pick<ImagePicker.ImagePickerAsset, "uri" | "fileName" | "mimeType" | "width" | "height" | "fileSize">;
  attachments?: any[];
};

const CHAT_OUTBOX_KEY = "campusx.chat.outbox.v2";


export function ConversationScreen({ navigation, route }: StackProps<"Conversation" | "GroupConversation">) {
  const isStudyGroup = route.name === "GroupConversation";
  const conversationId = isStudyGroup ? (route.params as any).groupId : (route.params as any).conversationId;

  const currentUser = useAppStore((state) => state.user);
  const accessToken = useAppStore((state) => state.accessToken);
  const friends = useAppStore((state) => state.friends);
  const isFocused = useIsFocused();
  const isFocusedRef = useRef(isFocused);
  const appStateRef = useRef(AppState.currentState);
  const [text, setText] = useState("");
  const [messages, setMessages] = useState<any[]>([]);
  const [groupPage, setGroupPage] = useState(1);
  const [nextCursor, setNextCursor] = useState<MessageCursor>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [remoteTyping, setRemoteTyping] = useState(false);
  const [conversation, setConversation] = useState<any>(null);
  const [dataOwnerId, setDataOwnerId] = useState<string | null>(null);
  const [messageError, setMessageError] = useState<string | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryingOutboxRef = useRef(new Set<string>());
  const listRef = useRef<FlatList<ChatListRow>>(null);
  const nearBottomRef = useRef(true);
  const [newMessageCount, setNewMessageCount] = useState(0);
  const [initialUnreadCount, setInitialUnreadCount] = useState(0);

  useEffect(() => {
    isFocusedRef.current = isFocused;
  }, [isFocused]);

  useFocusEffect(useCallback(() => {
    isFocusedRef.current = true;
    if (!isStudyGroup && AppState.currentState === "active") {
      getSocket()?.emit("conversation:active", { conversationId });
    }
    return () => {
      isFocusedRef.current = false;
      if (!isStudyGroup) getSocket()?.emit("conversation:inactive", { conversationId });
    };
  }, [conversationId, isStudyGroup]));

  const [replyTo, setReplyTo] = useState<any>(null);
  const [editingMessage, setEditingMessage] = useState<any>(null);
  const [selectedMessage, setSelectedMessage] = useState<any>(null);
  const [deleteMessageVisible, setDeleteMessageVisible] = useState<any>(null);
  const [attachmentSheetVisible, setAttachmentSheetVisible] = useState(false);
  const [imageViewerUrl, setImageViewerUrl] = useState<string | null>(null);
  const [mediaPreviewVisible, setMediaPreviewVisible] = useState(false);
  const [emojiPickerVisible, setEmojiPickerVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const [snackbarVisible, setSnackbarVisible] = useState(false);

  const insets = useSafeAreaInsets();
  const { height } = useReanimatedKeyboardAnimation();
  const animatedContainerStyle = useAnimatedStyle(() => ({
    paddingBottom: Math.max(insets.bottom, Math.abs(height.value)),
  }));

  const fetchMessages = async (cursor: MessageCursor = null, replace = false, groupPageNumber = 1) => {
    try {
      const endpoint = isStudyGroup
        ? `/groups/${conversationId}/messages?page=${groupPageNumber}&limit=30`
        : `/chats/${conversationId}/messages?limit=30${cursor ? `&beforeCreatedAt=${encodeURIComponent(cursor.createdAt)}&beforeId=${cursor.id}` : ""}`;

      const res = await api.get<{ data: { items: any[], hasMore: boolean, nextCursor?: MessageCursor } }>(endpoint);
      if (useAppStore.getState().user?.id !== currentUser?.id) return;
      if (replace) {
        setMessages(res.data.data.items);
        queryClient.setQueryData(["chatMessages", conversationId], res.data.data.items);
        AsyncStorage.setItem(`chatMessages_${conversationId}`, JSON.stringify(res.data.data.items)).catch(() => {});
        setDataOwnerId(currentUser?.id || null);
      } else {
        setMessages(prev => mergeChatMessages(prev, res.data.data.items));
      }
      setHasMore(res.data.data.hasMore ?? res.data.data.items.length === 30);
      if (!isStudyGroup) setNextCursor(res.data.data.nextCursor ?? null);
      setMessageError(null);

      if (replace && !isStudyGroup) {
        // Mark as delivered and read for DMs only
        api.post(`/chats/${conversationId}/delivered`).catch(() => { });
        api.post(`/chats/${conversationId}/read`).catch(() => { });
      }
    } catch (err) {
      if (useAppStore.getState().user?.id === currentUser?.id) setMessageError(getApiErrorMessage(err));
    } finally {
      if (useAppStore.getState().user?.id === currentUser?.id) setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    const cachedConversation = queryClient.getQueryData(["chat", conversationId]);
    const cachedMessages = queryClient.getQueryData(["chatMessages", conversationId]);

    setConversation(cachedConversation || null);
    if (cachedMessages) {
      setMessages(cachedMessages as any[]);
      setDataOwnerId(currentUser?.id || null);
      setLoading(false);
    } else {
      setMessages([]);
      setDataOwnerId(currentUser?.id || null);
      setLoading(true);
      // Load from disk for instant UI
      AsyncStorage.getItem(`chatMessages_${conversationId}`).then(val => {
        if (active && val) {
          const parsed = JSON.parse(val);
          if (parsed.length > 0) {
            setMessages(parsed);
            setDataOwnerId(currentUser?.id || null);
            setLoading(false);
            queryClient.setQueryData(["chatMessages", conversationId], parsed);
          }
        }
      }).catch(() => {});
    }
    
    setGroupPage(1);
    setNextCursor(null);
    setInitialUnreadCount(0);
    setNewMessageCount(0);
    setHasMore(true);

    const refreshConversation = () => {
      const endpoint = isStudyGroup ? `/groups/${conversationId}` : `/chats/${conversationId}`;
      return api.get<{ data: any }>(endpoint)
        .then((response) => {
          if (useAppStore.getState().user?.id !== currentUser?.id) return;
          setConversation(response.data.data);
          queryClient.setQueryData(["chat", conversationId], response.data.data);
          if (!isStudyGroup) {
            const metadata = response.data.data.participantMetadata?.find(
              (entry: any) => String(entry.user?._id ?? entry.user) === currentUser?.id,
            );
            setInitialUnreadCount((current) => current || Number(metadata?.unreadCount ?? 0));
          }
        })
        .catch((error) => { if (useAppStore.getState().user?.id === currentUser?.id) setMessageError(getApiErrorMessage(error)); });
    };

    Promise.allSettled([
      refreshConversation(),
      fetchMessages(null, true)
    ]).then(() => retryOutbox());

    const socket = accessToken ? connectSocket(accessToken) : getSocket();
    if (__DEV__) {
      console.info("[CHAT_OPEN]", {
        source: (route.params as any).source ?? "chat_list",
        conversationId: String(conversationId),
        socketConnected: Boolean(socket?.connected),
        socketId: socket?.id,
      });
    }

    useAppStore.getState().setActiveConversationId(String(conversationId));

    const onProfileUpdated = (payload: any) => {
      refreshConversation();
      setMessages(prev => prev.map(m => {
        if (m.sender?._id === payload.userId || m.sender?.id === payload.userId) {
          return { ...m, sender: { ...m.sender, avatarUrl: payload.avatarUrl, name: payload.name || m.sender?.name } };
        }
        return m;
      }));
    };

    const unsubProfile = subscribeSocketEvent("profile:updated", onProfileUpdated);
    const unsubPresence = subscribeSocketEvent("presence:changed", refreshConversation);
    const unsubGroupUpdated = subscribeSocketEvent("group:updated", refreshConversation);
    const unsubChatUpdated = subscribeSocketEvent("chat:updated", refreshConversation);

    const joinEvent = isStudyGroup ? "group:join" : "conversation:join";
    const leaveEvent = isStudyGroup ? "group:leave" : "conversation:leave";
    const newMsgEvent = isStudyGroup ? "group:message:new" : "message:new";

    emitSocketEvent(joinEvent, conversationId);
    if (!isStudyGroup && isFocusedRef.current && appStateRef.current === "active") {
      emitSocketEvent("conversation:active", { conversationId });
    }

    const onReconnect = () => {
      emitSocketEvent(joinEvent, conversationId);
      if (!isStudyGroup && isFocusedRef.current && appStateRef.current === "active") {
        emitSocketEvent("conversation:active", { conversationId });
      }
      void fetchMessages();
      void refreshConversation();
      void retryOutbox();
    };
    const unsubConnect = subscribeSocketEvent("connect", onReconnect);

    const onNewMessage = (msg: any) => {
      // Robust ID extraction handling Mongoose populated or unpopulated paths
      const rawConvId = msg.conversation?._id || msg.conversation || msg.group?._id || msg.group || msg.conversationId;
      const msgConvId = rawConvId ? String(rawConvId) : null;

      if (__DEV__) {
        console.info("[CHAT_MESSAGE_NEW_RECEIVED]", {
          messageId: msg._id,
          conversationId: msgConvId,
          activeConversationId: String(conversationId),
        });
      }
      if (msgConvId === String(conversationId)) {
        setMessages(prev => {
          const exists = prev.some(m =>
            (m._id && msg._id && String(m._id) === String(msg._id)) ||
            (m.nonce && msg.nonce && String(m.nonce) === String(msg.nonce))
          );

          if (exists) {
            if (__DEV__) console.info("[CHAT_MESSAGE_INSERTED]", false);
            return prev.map(m =>
              ((m._id && msg._id && String(m._id) === String(msg._id)) ||
                (m.nonce && msg.nonce && String(m.nonce) === String(msg.nonce))) ? { ...m, ...msg } : m
            );
          }
          if (__DEV__) console.info("[CHAT_MESSAGE_INSERTED]", true);
          if (nearBottomRef.current) {
            requestAnimationFrame(() => listRef.current?.scrollToOffset({ offset: 0, animated: true }));
          } else {
            setNewMessageCount((count) => count + 1);
          }
          return [msg, ...prev];
        });

        // WhatsApp-style: If user receives a message while screen is active, mark it delivered AND read immediately
        if (!isStudyGroup) {
          const msgId = msg._id;
          const senderId = msg.senderId || msg.sender?._id || msg.sender;
          if (
            msgId &&
            senderId !== currentUser?.id &&
            isFocusedRef.current &&
            appStateRef.current === "active"
          ) {
            api.post(`/chats/${conversationId}/read`).catch(() => { });
          }
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

    const unsubNewMsg = subscribeSocketEvent(newMsgEvent, onNewMessage);
    const unsubMsgRead = subscribeSocketEvent("message:read", onMessageRead);
    const unsubMsgDelivered = subscribeSocketEvent("message:delivered", onMessageDelivered);
    const unsubTypingStart = subscribeSocketEvent("typing:start", onTypingStart);
    const unsubTypingStop = subscribeSocketEvent("typing:stop", onTypingStop);

    const onMessageDeleted = (data: { messageId: string, conversationId: string, deletedForEveryoneAt?: string }) => {
      if (data.conversationId?.toString() === conversationId.toString()) {
        setMessages(prev => prev.map(m => String(m._id) === String(data.messageId)
          ? { ...m, text: "", attachments: [], deletedForEveryoneAt: data.deletedForEveryoneAt ?? new Date().toISOString() }
          : m));
      }
    };
    const unsubMsgDeleted = subscribeSocketEvent("message:deleted", onMessageDeleted);

    const onMessageReaction = (data: { messageId: string, reactions: any[] }) => {
      setMessages(prev => prev.map(m => m._id === data.messageId ? { ...m, reactions: data.reactions } : m));
    };
    const unsubMsgReaction = subscribeSocketEvent("message:reaction_updated", onMessageReaction);
    const onMessageEdited = (message: any) => {
      if (String(message.conversationId) !== String(conversationId)) return;
      setMessages((current) => current.map((item) => String(item._id) === String(message._id) ? { ...item, ...message } : item));
    };
    const unsubMsgEdited = subscribeSocketEvent("message:edited", onMessageEdited);

    const appStateSubscription = AppState.addEventListener("change", (nextState) => {
      appStateRef.current = nextState;
      if (nextState === "active") {
        const currentSocket = getSocket();
        if (currentSocket && !currentSocket.connected) currentSocket.connect();
        emitSocketEvent(joinEvent, conversationId);
        if (!isStudyGroup) emitSocketEvent("conversation:active", { conversationId });
        void fetchMessages();
        void refreshConversation();
        void retryOutbox();
        if (!isStudyGroup && isFocusedRef.current) {
          void api.post(`/chats/${conversationId}/delivered`);
          void api.post(`/chats/${conversationId}/read`);
        }
      } else if (!isStudyGroup) {
        emitSocketEvent("conversation:inactive", { conversationId });
      }
    });

    return () => {
      unsubProfile();
      unsubPresence();
      unsubGroupUpdated();
      unsubChatUpdated();
      unsubConnect();
      unsubNewMsg();
      unsubMsgRead();
      unsubMsgDelivered();
      unsubTypingStart();
      unsubTypingStop();
      unsubMsgDeleted();
      unsubMsgReaction();
      unsubMsgEdited();

      appStateSubscription.remove();
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        emitSocketEvent("typing:stop", { conversationId });
      }
      emitSocketEvent(leaveEvent, conversationId);
      if (!isStudyGroup) emitSocketEvent("conversation:inactive", { conversationId });
      useAppStore.getState().setActiveConversationId(null);
    };
  }, [accessToken, conversationId, currentUser?.id, isStudyGroup]);

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
      setMediaPreviewVisible(true);
    }
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setMessageError("Camera permission is required to take a photo.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.[0]) {
      setMedia(result.assets[0]);
      setMediaPreviewVisible(true);
    }
  };

  async function readOutbox(): Promise<PendingOutgoing[]> {
    try {
      return JSON.parse(await AsyncStorage.getItem(CHAT_OUTBOX_KEY) ?? "[]");
    } catch {
      return [];
    }
  }

  async function savePending(item: PendingOutgoing) {
    const queue = await readOutbox();
    const next = [...queue.filter((entry) => entry.clientMessageId !== item.clientMessageId), item].slice(-100);
    await AsyncStorage.setItem(CHAT_OUTBOX_KEY, JSON.stringify(next));
  }

  async function removePending(clientMessageId: string) {
    const queue = await readOutbox();
    await AsyncStorage.setItem(CHAT_OUTBOX_KEY, JSON.stringify(queue.filter((entry) => entry.clientMessageId !== clientMessageId)));
  }

  async function deliverPending(original: PendingOutgoing) {
    if (retryingOutboxRef.current.has(original.clientMessageId)) return;
    retryingOutboxRef.current.add(original.clientMessageId);
    let pending = original;
    setMessages((current) => current.map((message) =>
      String(message.clientMessageId ?? message.nonce) === original.clientMessageId
        ? { ...message, status: pending.localImage && !pending.attachments?.length ? "uploading" : "sending" }
        : message,
    ));
    try {
      let attachments = pending.attachments ?? [];
      if (pending.localImage && attachments.length === 0) {
        const formData = new FormData();
        formData.append("file", {
          uri: pending.localImage.uri,
          name: pending.localImage.fileName || "image.jpg",
          type: pending.localImage.mimeType || "image/jpeg",
        } as any);
        const uploadRes = await api.post<{ data: any }>("/upload", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        attachments = [{
          url: uploadRes.data.data.url,
          thumbnailUrl: uploadRes.data.data.thumbnailUrl,
          publicId: uploadRes.data.data.publicId,
          name: uploadRes.data.data.originalName,
          mimeType: uploadRes.data.data.mimeType,
          size: uploadRes.data.data.size,
          width: pending.localImage.width,
          height: pending.localImage.height,
        }];
        pending = { ...pending, attachments };
        await savePending(pending);
      }
      const endpoint = isStudyGroup
        ? `/groups/${pending.conversationId}/messages`
        : `/chats/${pending.conversationId}/messages`;
      const response = await api.post<{ data: any }>(endpoint, {
        text: pending.text,
        replyTo: pending.replyTo,
        nonce: pending.clientMessageId,
        attachments,
      });
      setMessages((current) => current.map((message) =>
        String(message.clientMessageId ?? message.nonce) === pending.clientMessageId
          ? { ...response.data.data, status: "sent" }
          : message,
      ));
      await removePending(pending.clientMessageId);
    } catch {
      await savePending(pending);
      setMessages((current) => current.map((message) =>
        String(message.clientMessageId ?? message.nonce) === pending.clientMessageId
          ? { ...message, status: "failed", _pending: pending }
          : message,
      ));
    } finally {
      retryingOutboxRef.current.delete(original.clientMessageId);
    }
  }

  async function retryOutbox() {
    const queue = await readOutbox();
    for (const item of queue.filter((entry) => entry.conversationId === String(conversationId))) {
      setMessages((current) => {
        const exists = current.some((message) => String(message.clientMessageId ?? message.nonce) === item.clientMessageId);
        if (exists) return current;
        return [{
          _id: `temp-${item.clientMessageId}`,
          clientMessageId: item.clientMessageId,
          nonce: item.clientMessageId,
          text: item.text,
          sender: { _id: currentUser?.id, name: currentUser?.name || "You" },
          attachments: item.localImage ? [{ url: item.localImage.uri, mimeType: item.localImage.mimeType }] : item.attachments ?? [],
          createdAt: item.createdAt,
          status: "failed",
          _pending: item,
        }, ...current];
      });
      await deliverPending(item);
    }
  }

  const send = async () => {
    const value = text.trim();
    if (!value && !media) return;

    if (editingMessage) {
      try {
        const response = await api.patch<{ data: any }>(
          `/chats/${conversationId}/messages/${editingMessage._id}`,
          { text: value },
        );
        setMessages((current) => current.map((message) => message._id === editingMessage._id ? { ...message, ...response.data.data } : message));
        setText("");
        setEditingMessage(null);
      } catch (error) {
        setMessageError(getApiErrorMessage(error));
      }
      return;
    }

    const nonce = `${currentUser?.id ?? "user"}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const tempId = `temp-${nonce}`;
    if (__DEV__) {
      console.info("[CHAT_SEND_START]", {
        clientMessageId: nonce,
        conversationId: String(conversationId),
      });
    }
    const pending: PendingOutgoing = {
      clientMessageId: nonce,
      conversationId: String(conversationId),
      text: value,
      replyTo: replyTo?._id,
      createdAt: new Date().toISOString(),
      localImage: media ? {
        uri: media.uri,
        fileName: media.fileName,
        mimeType: media.mimeType,
        width: media.width,
        height: media.height,
        fileSize: media.fileSize,
      } : undefined,
    };
    const temp = {
      _id: tempId,
      clientMessageId: nonce,
      nonce,
      text: value,
      sender: { _id: currentUser?.id, name: currentUser?.name || "You" },
      attachments: media ? [{ url: media.uri, name: media.fileName || "image.jpg" }] : [],
      createdAt: pending.createdAt,
      status: media ? "uploading" : "sending",
      _pending: pending,
    };

    setMessages(prev => [temp, ...prev]);
    setText("");
    setMedia(null);
    setReplyTo(null);

    await savePending(pending);
    await deliverPending(pending);
  };

  const visibleConversation = dataOwnerId === currentUser?.id ? conversation : null;
  const isGroupConversation = visibleConversation?.type === "group" || isStudyGroup;
  const groupData = isStudyGroup ? visibleConversation?.group : visibleConversation;
  const otherParticipant = !isGroupConversation ? visibleConversation?.participants?.find((p: any) => p._id !== currentUser?.id) : undefined;
  const title = isGroupConversation ? groupData?.title || groupData?.name || route.params.name || "Group chat" : otherParticipant?.name || route.params.name || "Chat";
  const avatarUrl = isGroupConversation ? groupData?.avatarUrl : otherParticipant?.avatarUrl;
  const isFriend = !!otherParticipant && friends.some((friend) => friend.id === otherParticipant._id);
  const info = () => {
    if (isStudyGroup) navigation.navigate("GroupDetails", { groupId: conversationId });
    else navigation.navigate("ChatInfo", { conversationId });
  };

  const loadMore = () => {
    if (!loading && hasMore) {
      if (isStudyGroup) {
        setGroupPage((current) => {
          const next = current + 1;
          void fetchMessages(null, false, next);
          return next;
        });
      } else if (nextCursor) {
        void fetchMessages(nextCursor);
      }
    }
  };

  const messageRows = useMemo<ChatListRow[]>(() => {
    const rows: ChatListRow[] = [];
    messages.forEach((message, index) => {
      rows.push(message);
      if (initialUnreadCount > 0 && index === initialUnreadCount - 1) {
        rows.push({ _rowType: "unread", _id: `unread-${conversationId}`, count: initialUnreadCount });
      }
      const next = messages[index + 1];
      if (!next || new Date(next.createdAt).toDateString() !== new Date(message.createdAt).toDateString()) {
        rows.push({ _rowType: "date", _id: `date-${new Date(message.createdAt).toDateString()}`, label: getChatDateLabel(message.createdAt) });
      }
    });
    return rows;
  }, [conversationId, initialUnreadCount, messages]);

  return (
    <CXScreen edges={["top", "right", "left"]}>
      <Reanimated.View style={[styles.flex, animatedContainerStyle]}>
        <CXRow style={styles.chatHeader}>
          <CXIconButton icon="chevron-back" label="Go back" backgroundColor={colors.transparent} onPress={navigation.goBack} />
          <Pressable onPress={info} style={styles.chatIdentity} accessibilityRole="button">
            <CXAvatar name={title} source={avatarUrl} size={40} />
            <View style={styles.flex}>
              <CXText variant="bodyStrong" numberOfLines={1}>{title}</CXText>
              <CXText variant="caption" color={remoteTyping || otherParticipant?.online ? colors.success : colors.textMuted}>
                {remoteTyping
                  ? "typing…"
                  : otherParticipant?.online
                    ? "Online"
                    : otherParticipant?.lastSeenAt
                      ? `last seen ${new Date(otherParticipant.lastSeenAt).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}`
                      : "Offline"}
              </CXText>
            </View>
          </Pressable>
          {Platform.OS !== "web" && !isGroupConversation && isFriend && otherParticipant && <CXIconButton icon="call-outline" label="Audio call" backgroundColor={colors.transparent}
            onPress={() => void startAudioCall({ conversationId, peerId: otherParticipant._id, name: title, avatarUrl })} />}
          <CXIconButton icon="ellipsis-horizontal" label="Chat info" backgroundColor={colors.transparent} onPress={info} />
        </CXRow>
        {messageError && <Pressable onPress={() => void fetchMessages()} style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.xs }}>
          <CXText variant="small" color={colors.danger}>{messageError} · Tap to retry</CXText>
        </Pressable>}
        <FlatList
          ref={listRef}
          data={dataOwnerId === currentUser?.id ? messageRows : []}
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
          onScroll={(event) => {
            const nearBottom = event.nativeEvent.contentOffset.y < 80;
            nearBottomRef.current = nearBottom;
            if (nearBottom && newMessageCount) setNewMessageCount(0);
          }}
          scrollEventThrottle={32}
          renderItem={({ item }) => {
            if (item._rowType === "date") {
              return <View style={styles.dateSeparator}><CXText variant="caption" color={colors.textMuted}>{item.label}</CXText></View>;
            }
            if (item._rowType === "unread") {
              return <View style={styles.unreadDivider}><View style={styles.dividerLine} /><CXText variant="caption" color={colors.primary}>{item.count} unread messages</CXText><View style={styles.dividerLine} /></View>;
            }
            return (
              <MessageBubble
                message={item}
                mine={item.sender?._id === currentUser?.id || item.senderId === currentUser?.id}
                onLongPress={() => setSelectedMessage(item)}
                onReply={() => setReplyTo(item)}
                onRetry={item._pending ? () => void deliverPending(item._pending) : undefined}
                onOpenImage={setImageViewerUrl}
                isGroup={isGroupConversation || isStudyGroup}
              />
            );
          }}
        />
        {newMessageCount > 0 ? (
          <Pressable
            style={styles.newMessagesButton}
            onPress={() => {
              listRef.current?.scrollToOffset({ offset: 0, animated: true });
              setNewMessageCount(0);
            }}
          >
            <Ionicons name="arrow-down" size={16} color={colors.white} />
            <CXText variant="smallStrong" color={colors.white}>{newMessageCount} new messages</CXText>
          </Pressable>
        ) : null}
        {visibleConversation && (isGroupConversation || isFriend) ? <>
          {replyTo && (
            <View style={styles.replyPreviewWrapper}>
              <View style={styles.replyPreviewBar} />
              <View style={[styles.flex, { paddingVertical: 8 }]}>
                <CXText variant="smallStrong" color={colors.primary}>{replyTo.sender?.name || "User"}</CXText>
                <CXText variant="caption" numberOfLines={1}>{replyTo.text}</CXText>
              </View>
              <CXIconButton label="Remove reply" icon="close" size={24} onPress={() => setReplyTo(null)} backgroundColor={colors.transparent} />
            </View>
          )}
          {editingMessage && (
            <View style={styles.replyPreviewWrapper}>
              <View style={styles.replyPreviewBar} />
              <View style={[styles.flex, { paddingVertical: 8 }]}>
                <CXText variant="smallStrong" color={colors.primary}>Editing message</CXText>
                <CXText variant="caption" numberOfLines={1}>{editingMessage.text}</CXText>
              </View>
              <CXIconButton label="Cancel edit" icon="close" size={24} onPress={() => { setEditingMessage(null); setText(""); }} backgroundColor={colors.transparent} />
            </View>
          )}
          <CXRow style={styles.composer}>
            <CXIconButton icon="add" label="Add photo" size={38} backgroundColor={colors.backgroundLavender} onPress={() => setAttachmentSheetVisible(true)} />
            <TextInput
              value={text}
              onChangeText={handleTextChange}
              placeholder="Type a message..."
              placeholderTextColor={colors.textFaint}
              multiline
              style={styles.composerInput}
              onFocus={() => setEmojiPickerVisible(false)}
            />
            <CXIconButton
              icon="happy-outline"
              label="Add emoji"
              size={36}
              backgroundColor={colors.transparent}
              color={emojiPickerVisible ? colors.primary : colors.textMuted}
              onPress={() => {
                if (!emojiPickerVisible) Keyboard.dismiss();
                setEmojiPickerVisible(!emojiPickerVisible);
              }}
            />
            {(text.trim() || media) && <CXIconButton icon="send" label="Send message" size={42} onPress={() => void send()} />}
          </CXRow>
          {emojiPickerVisible && (
            <ScrollView style={{ height: 250, backgroundColor: colors.white, borderTopWidth: 1, borderColor: colors.border }}>
              <View style={{ flexDirection: "row", flexWrap: "wrap", padding: spacing.sm, justifyContent: "space-between" }}>
                {["😂", "❤️", "👍", "🙏", "😢", "😮", "🔥", "💯", "✨", "😊", "🎉", "🙌", "🤔", "🙄", "💀", "👀", "😎", "🥳", "😭", "😡", "💩", "👻", "👽", "🤖", "🙈", "🙉", "🙊", "🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼"].map(e => (
                  <Pressable key={e} onPress={() => handleTextChange(`${text}${e}`)} style={{ padding: 10 }}>
                    <Text style={{ fontSize: 32 }}>{e}</Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          )}
        </> : visibleConversation?.type === "direct" ?
          <CXText variant="small" color={colors.textMuted} align="center" style={{ padding: spacing.md }}>
            You can only message friends.
          </CXText> : null}
      </Reanimated.View>

      <CXActionSheet
        visible={attachmentSheetVisible}
        onClose={() => setAttachmentSheetVisible(false)}
        title="Add a photo"
        actions={[
          { label: "Camera", icon: "camera-outline", onPress: () => void takePhoto() },
          { label: "Photos", icon: "images-outline", onPress: () => void pickImage() },
        ]}
      />
      <Modal
        visible={mediaPreviewVisible && Boolean(media)}
        animationType="slide"
        onRequestClose={() => { setMediaPreviewVisible(false); setMedia(null); }}
      >
        <CXScreen edges={["top", "right", "bottom", "left"]} style={styles.mediaPreviewScreen}>
          <CXRow style={styles.mediaPreviewHeader}>
            <CXIconButton
              icon="close"
              label="Cancel photo"
              backgroundColor="rgba(255,255,255,0.16)"
              color={colors.white}
              onPress={() => { setMediaPreviewVisible(false); setMedia(null); }}
            />
            <CXText variant="bodyStrong" color={colors.white}>Photo preview</CXText>
            <View style={{ width: 42 }} />
          </CXRow>
          {media ? <Image source={{ uri: media.uri }} style={styles.mediaPreviewImage} resizeMode="contain" /> : null}
          <View style={styles.mediaPreviewActions}>
            <CXButton
              label="Send photo"
              iconRight="send"
              onPress={() => { setMediaPreviewVisible(false); void send(); }}
            />
          </View>
        </CXScreen>
      </Modal>

      <CXActionSheet
        visible={Boolean(selectedMessage)}
        onClose={() => setSelectedMessage(null)}
        title="Message actions"
        headerContent={selectedMessage ? (
          <CXRow style={styles.reactionRow}>
            {["❤️", "👍", "😂", "😮", "😢", "🙏"].map((emoji) => (
              <Pressable
                key={emoji}
                onPress={() => {
                  const mine = selectedMessage.reactions?.find(
                    (reaction: any) => String(reaction.userId ?? reaction.user?._id ?? reaction.user) === currentUser?.id,
                  );
                  api.post(`/${isStudyGroup ? "groups" : "chats"}/${conversationId}/messages/${selectedMessage._id}/reaction`, {
                    emoji: mine?.emoji === emoji ? "" : emoji,
                  }).catch((err) => console.log(getApiErrorMessage(err)));
                  setSelectedMessage(null);
                }}
                style={styles.reactionBtn}
              >
                <Text style={{ fontSize: 24 }}>{emoji}</Text>
              </Pressable>
            ))}
          </CXRow>
        ) : null}
        actions={selectedMessage ? [
          {
            label: "Reply",
            icon: "arrow-undo-outline",
            onPress: () => setReplyTo(selectedMessage),
          },
          ...((selectedMessage.text && !selectedMessage.deletedForEveryoneAt) ? [{
            label: "Copy",
            icon: "copy-outline" as const,
            onPress: () => {
              void Clipboard.setStringAsync(selectedMessage.text).then(() => {
                setSnackbarMessage("Copied");
                setSnackbarVisible(true);
              });
            },
          }] : []),
          ...(((selectedMessage.sender?._id === currentUser?.id || selectedMessage.senderId === currentUser?.id) && selectedMessage.text && !selectedMessage.attachments?.length) ? [{
            label: "Edit",
            icon: "create-outline" as const,
            onPress: () => {
              setEditingMessage(selectedMessage);
              setReplyTo(null);
              setText(selectedMessage.text);
            },
          }] : []),
          {
            label: "Delete",
            icon: "trash-outline",
            destructive: true,
            onPress: () => setDeleteMessageVisible(selectedMessage),
          },
        ] : []}
      />

      <CXActionSheet
        visible={!!deleteMessageVisible}
        onClose={() => setDeleteMessageVisible(null)}
        title="Delete message"
        actions={[
          {
            label: "Delete for me",
            icon: "trash-outline",
            destructive: true,
            onPress: () => {
              if (deleteMessageVisible) {
                setMessages((current) => current.filter((message) => message._id !== deleteMessageVisible._id));
                api.delete(`/${isStudyGroup ? "groups" : "chats"}/${conversationId}/messages/${deleteMessageVisible._id}?scope=me`).catch((err) => {
                  console.log(getApiErrorMessage(err));
                  void fetchMessages();
                });
                setDeleteMessageVisible(null);
              }
            }
          },
          ...((deleteMessageVisible?.sender?._id === currentUser?.id || deleteMessageVisible?.senderId === currentUser?.id) ? [{
            label: "Delete for everyone",
            icon: "trash-outline" as const,
            destructive: true,
            confirmationTitle: "Delete for everyone?",
            confirmationMessage: "Everyone in this conversation will see a deleted-message placeholder.",
            confirmationButtonText: "Delete for everyone",
            onPress: () => {
              if (deleteMessageVisible) {
                api.delete(`/${isStudyGroup ? "groups" : "chats"}/${conversationId}/messages/${deleteMessageVisible._id}?scope=everyone`).catch((err) => console.log(getApiErrorMessage(err)));
                setDeleteMessageVisible(null);
              }
            },
          }] : []),
        ]}
      />
      <Modal
        visible={Boolean(imageViewerUrl)}
        transparent
        animationType="fade"
        onRequestClose={() => setImageViewerUrl(null)}
      >
        <View style={styles.imageViewer}>
          <CXIconButton
            icon="close"
            label="Close image"
            backgroundColor="rgba(255,255,255,0.16)"
            color={colors.white}
            onPress={() => setImageViewerUrl(null)}
          />
          {imageViewerUrl ? <Image source={{ uri: imageViewerUrl }} style={styles.viewerImage} resizeMode="contain" /> : null}
        </View>
      </Modal>
      <CXSnackbar
        visible={snackbarVisible}
        message={snackbarMessage}
        duration={1600}
        onDismiss={() => setSnackbarVisible(false)}
      />
    </CXScreen>
  );
}

function MessageSkeleton({ mine }: { mine: boolean }) {
  return (
    <View style={[styles.messageRow, mine ? styles.messageRowMine : null]}>
      <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther, { width: Math.random() * 100 + 100, height: 42, opacity: 0.5, backgroundColor: mine ? colors.primaryTint : colors.surfaceLavender }]} />
    </View>
  );
}

function ChatSkeletonList() {
  return (
    <View style={{ gap: spacing.sm, padding: spacing.md, width: '100%', height: '100%', justifyContent: 'flex-end', paddingBottom: 100 }}>
      <MessageSkeleton mine={true} />
      <MessageSkeleton mine={false} />
      <MessageSkeleton mine={false} />
      <MessageSkeleton mine={true} />
      <MessageSkeleton mine={false} />
    </View>
  );
}

function MessageBubble({ message, mine, onLongPress, onReply, onRetry, onOpenImage, isGroup }: { message: any; mine: boolean; onLongPress?: () => void; onReply?: () => void; onRetry?: () => void; onOpenImage?: (url: string) => void; isGroup?: boolean }) {
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
  const status = ["failed", "sending", "uploading"].includes(message.status) ? message.status :
    recipientRecorded(message.readBy) ? "read" : recipientRecorded(message.deliveredTo) ? "delivered" : "sent";

  let iconName = "checkmark";
  let iconColor = "#EDE9FF";
  if (status === "failed") {
    iconName = "alert-circle";
    iconColor = "#FFD2D2";
  } else if (status === "sending" || status === "uploading") {
    iconName = "time-outline";
  } else if (status === "delivered") {
    iconName = "checkmark-done";
  } else if (status === "read") {
    iconName = "checkmark-done";
    iconColor = "#34B7F1"; // blue tick
  }

  const swipeX = useSharedValue(0);
  const swipeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: swipeX.value }] }));
  const swipeGesture = Gesture.Pan()
    .enabled(Boolean(onReply) && !message.deletedForEveryoneAt)
    .activeOffsetX(14)
    .failOffsetY([-12, 12])
    .onUpdate((event) => {
      swipeX.value = Math.min(76, Math.max(0, event.translationX));
    })
    .onEnd(() => {
      if (swipeX.value >= 58 && onReply) runOnJS(onReply)();
    })
    .onFinalize(() => {
      swipeX.value = withSpring(0, { damping: 18, stiffness: 240 });
    });
  const reactionCounts = ((message.reactions ?? []) as Array<{ emoji: string }>).reduce((counts, reaction) => {
    counts.set(reaction.emoji, (counts.get(reaction.emoji) ?? 0) + 1);
    return counts;
  }, new Map<string, number>());
  const reactionSummary = Array.from(reactionCounts.entries())
    .map(([emoji, count]) => `${emoji}${count > 1 ? ` ${count}` : ""}`)
    .join("  ");

  return (
    <GestureDetector gesture={swipeGesture}>
      <View style={styles.swipeContainer}>
        <Reanimated.View style={[styles.messageRow, mine && styles.messageRowMine, swipeStyle]}>
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
                <View style={[styles.flex, { paddingVertical: 6, paddingRight: 8 }]}>
                  <CXText variant="smallStrong" color={mine ? colors.white : colors.primary}>{message.replyTo.sender?.name}</CXText>
                  <CXText variant="caption" color={mine ? "#EDE9FF" : colors.ink} numberOfLines={1}>{message.replyTo.text}</CXText>
                </View>
              </View>
            )}
            {message.deletedForEveryoneAt ? (
              <CXRow style={{ gap: spacing.xs }}>
                <Ionicons name="ban-outline" size={15} color={mine ? "#EDE9FF" : colors.textMuted} />
                <CXText color={mine ? "#EDE9FF" : colors.textMuted} style={{ fontStyle: "italic" }}>
                  This message was deleted
                </CXText>
              </CXRow>
            ) : message.attachments && message.attachments.length > 0 && (
              <View style={{ marginBottom: 4 }}>
                {message.attachments.map((att: any, i: number) => <Pressable key={`${message._id}-${i}`}
                  onPress={() => onOpenImage?.(att.url)} onLongPress={onLongPress} delayLongPress={300} accessibilityRole="button">
                  {att.mimeType?.startsWith("image/") || /\.(jpg|jpeg|png|webp)(\?|$)/i.test(att.url) ?
                    <Image source={{ uri: att.url }} style={{ width: 200, height: 200, borderRadius: 8, marginBottom: 4 }} /> :
                    <CXRow style={{ padding: spacing.sm, gap: spacing.xs }}>
                      <Ionicons name="document-outline" size={20} color={mine ? colors.white : colors.ink} />
                      <CXText variant="small" color={mine ? colors.white : colors.ink}>{att.name || "Open attachment"}</CXText>
                    </CXRow>}
                </Pressable>)}
              </View>
            )}
            <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
              {!message.deletedForEveryoneAt && !!message.text && (
                <CXText style={{ flexShrink: 1, marginRight: 8 }} color={mine ? colors.white : colors.ink}>{message.text}</CXText>
              )}
              <CXRow style={styles.messageMeta}>
                <CXText variant="caption" color={mine ? "#EDE9FF" : colors.textMuted}>{timeString}</CXText>
                {message.editedAt ? <CXText variant="caption" color={mine ? "#EDE9FF" : colors.textMuted}>edited</CXText> : null}
                {mine ? (
                  <Pressable disabled={status !== "failed" || !onRetry} onPress={onRetry} hitSlop={8}>
                    <Ionicons name={iconName as any} size={14} color={iconColor} />
                  </Pressable>
                ) : null}
              </CXRow>
            </View>

            {message.reactions && message.reactions.length > 0 && (
              <View style={[styles.reactionBadge, mine ? styles.reactionBadgeMine : styles.reactionBadgeOther]}>
                <Text style={styles.reactionText}>
                  {reactionSummary}
                </Text>
              </View>
            )}
          </Pressable>
        </Reanimated.View>
      </View>
    </GestureDetector>
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
    navigation.navigate("CreateGroup" as any);
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
              title="New Study Group"
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
      <View style={[styles.chatInfoHero, { paddingVertical: spacing.xxl, alignItems: "center", backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.borderSoft, marginBottom: spacing.md }]}>
        <LinearGradient
          colors={[colors.primary, "#A855F7"]}
          style={{
            padding: 4,
            borderRadius: 999,
            marginBottom: spacing.md,
            shadowColor: colors.primary,
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.3,
            shadowRadius: 16,
            elevation: 10
          }}
        >
          <View style={{ backgroundColor: colors.surface, padding: 2, borderRadius: 999 }}>
            <CXAvatar name={title} source={avatarUrl} size={100} />
          </View>
        </LinearGradient>
  
        <CXText variant="h2" style={{ textAlign: "center", paddingHorizontal: spacing.md }}>{title}</CXText>
  
        {isGroup && (
          <View style={{
            backgroundColor: colors.primary + "15",
            paddingHorizontal: spacing.md,
            paddingVertical: 6,
            borderRadius: radius.pill,
            marginTop: spacing.sm
          }}>
            <CXText variant="bodyStrong" color={colors.primary}>{conversation.participants.length} Members</CXText>
          </View>
        )}
  
        {!isGroup && peer?.username && (
          <CXText variant="body" color={colors.textMuted} style={{ marginTop: spacing.xs }}>@{peer.username}</CXText>
        )}
      </View>
  
      {!isGroup && peer && (
        <View style={{ paddingHorizontal: spacing.md, marginBottom: spacing.lg }}>
          <CXCard style={{ shadowColor: colors.ink, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 }}>
          <CXListRow
            icon="person-outline"
            title="View Profile"
            subtitle="See their CampusX profile"
            onPress={() => navigation.navigate("UserProfile", { userId: peer._id })}
          />
        </CXCard>
      </View>
    )}

    {isGroup && (
      <View style={{ paddingHorizontal: spacing.sm, paddingBottom: spacing.xl }}>
        <CXSectionHeader title="Members" />
        <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, overflow: "hidden" }}>
          {conversation.participants.map((participant: any, index: number) => (
            <Pressable
              key={participant._id}
              onPress={() => navigation.navigate("UserProfile", { userId: participant._id })}
              style={({ pressed }) => [
                {
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.md,
                  padding: spacing.md,
                  borderBottomWidth: index < conversation.participants.length - 1 ? 1 : 0,
                  borderBottomColor: colors.border
                },
                pressed && { backgroundColor: colors.background }
              ]}
              accessibilityRole="button"
            >
              <CXAvatar name={participant.name || "Member"} source={participant.avatarUrl} size={46} />
              <View style={styles.flex}>
                <CXText variant="bodyStrong">{participant.name || "Member"}</CXText>
                {admins.has(participant._id) && (
                  <View style={{
                    alignSelf: "flex-start",
                    backgroundColor: colors.primary + "15",
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                    borderRadius: 4,
                    marginTop: 2
                  }}>
                    <CXText variant="caption" color={colors.primary}>Admin</CXText>
                  </View>
                )}
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textFaint} />
            </Pressable>
          ))}
        </View>
      </View>
    )}
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
        <View style={[styles.aiAvatar, { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.white, borderStyle: 'solid', borderWidth: 1, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center' }]}>
          <Ionicons name="sparkles" size={18} color={colors.primary} />
        </View>
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
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 60, paddingHorizontal: spacing.xl }}>
            <LinearGradient
              colors={["#EEF2FF", "#F5F3FF"]}
              style={{ width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center", marginBottom: spacing.lg }}
            >
              <Ionicons name="sparkles" size={40} color="#6366F1" />
            </LinearGradient>
            <CXText variant="h2" align="center" style={{ marginBottom: spacing.xs, color: "#312E81" }}>
              How can I help you today?
            </CXText>
            <CXText variant="body" align="center" style={{ marginBottom: spacing.xl, color: "#6B7280" }}>
              Ask anything about your courses, schedules, or ideas.
            </CXText>

            <View style={{ width: '100%', gap: spacing.md }}>
              {[
                { icon: "book-outline", text: "Explain a complex topic" },
                { icon: "pencil-outline", text: "Help me write an essay" },
                { icon: "bulb-outline", text: "Quiz me on my subjects" },
              ].map((item, idx) => (
                <Pressable
                  key={idx}
                  onPress={() => { setText(item.text); }}
                  style={({ pressed }) => [
                    {
                      backgroundColor: colors.white,
                      padding: spacing.md,
                      borderRadius: radius.lg,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing.md,
                      borderWidth: 1,
                      borderColor: "#EEF2FF",
                      shadowColor: "#6366F1",
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.05,
                      shadowRadius: 4,
                      elevation: 1
                    },
                    pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] }
                  ]}
                >
                  <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "#F3F4F6", alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name={item.icon as any} size={18} color="#4B5563" />
                  </View>
                  <CXText variant="bodyStrong" style={{ color: "#4B5563" }}>{item.text}</CXText>
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
        <CXRow style={[styles.composer, { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.borderSoft }]}>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: "#F3F4F6", borderRadius: 24, paddingHorizontal: spacing.sm }}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Message CampusAI..."
              placeholderTextColor="#9CA3AF"
              multiline
              style={[styles.composerInput, { flex: 1, maxHeight: 100, minHeight: 40, paddingTop: 10, paddingBottom: 10, paddingHorizontal: 8, fontSize: 16 }]}
            />
            <Pressable
              disabled={loading || !text.trim()}
              onPress={() => void send()}
              style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: text.trim() ? "#6366F1" : "#E5E7EB", alignItems: 'center', justifyContent: 'center', marginLeft: 8 }}
            >
              <Ionicons name="arrow-up" size={20} color={colors.white} />
            </Pressable>
          </View>
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
  imageViewer: {
    flex: 1,
    backgroundColor: "rgba(12, 10, 26, 0.98)",
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.md,
    alignItems: "flex-end",
  },
  viewerImage: {
    flex: 1,
    width: "100%",
  },
  mediaPreviewScreen: { backgroundColor: "#0E0C1C" },
  mediaPreviewHeader: {
    minHeight: 58,
    justifyContent: "space-between",
    paddingHorizontal: spacing.sm,
  },
  mediaPreviewImage: { flex: 1, width: "100%" },
  mediaPreviewActions: { padding: spacing.md },
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
  messageList: { padding: spacing.md, gap: 4 },
  swipeContainer: { position: "relative" },
  swipeReplyIcon: {
    position: "absolute",
    left: spacing.md,
    top: "50%",
    marginTop: -16,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceLavender,
  },
  messageRow: { alignItems: "flex-start" },
  messageRowMine: { alignItems: "flex-end" },
  bubble: {
    maxWidth: "85%",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 2,
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
  dateSeparator: {
    alignSelf: "center",
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceLavender,
    marginVertical: spacing.xs,
  },
  unreadDivider: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginVertical: spacing.sm,
  },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.primary },
  newMessagesButton: {
    position: "absolute",
    right: spacing.md,
    bottom: 66,
    zIndex: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    shadowColor: colors.primaryDark,
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 5,
  },
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
