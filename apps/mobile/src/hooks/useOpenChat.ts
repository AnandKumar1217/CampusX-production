import { useState } from "react";
import { useNavigation } from "@react-navigation/native";
import { useQueryClient } from "@tanstack/react-query";
import { Alert, Platform, ToastAndroid } from "react-native";
import { api, getApiErrorMessage } from "@/services/api";

export function useOpenChat() {
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const [isMessaging, setIsMessaging] = useState(false);

  const openChat = async (participantId: string, participantName?: string) => {
    if (isMessaging) return;
    setIsMessaging(true);
    try {
      const res = await api.post<{ data: any }>("/chats", { participantId });
      queryClient.invalidateQueries({ queryKey: ["chats"] });
      navigation.navigate("Conversation", {
        conversationId: res.data.data._id || res.data.data.id,
        name: participantName || "Chat",
      });
    } catch (err: any) {
      const errorMsg = getApiErrorMessage(err);
      if (Platform.OS === 'android') {
        ToastAndroid.show(errorMsg, ToastAndroid.SHORT);
      } else {
        Alert.alert("Cannot start conversation", errorMsg);
      }
    } finally {
      setIsMessaging(false);
    }
  };

  return { openChat, isMessaging };
}
