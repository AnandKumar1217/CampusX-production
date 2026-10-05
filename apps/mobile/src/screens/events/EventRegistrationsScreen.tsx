import React from "react";
import { View, ActivityIndicator } from "react-native";
import { CXText, CXButton } from "@/components/ui";
import { useQuery } from "@tanstack/react-query";
import { eventService } from "@/services/eventService";
import { PeopleListPage } from "@/screens/social/SocialScreens";

export function EventRegistrationsScreen({ navigation, route }: any) {
  const { eventId } = route.params;

  const { data: event, isLoading, isError, refetch } = useQuery({
    queryKey: ["event", eventId],
    queryFn: () => eventService.getEvent(eventId),
  });

  if (isLoading) return <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}><ActivityIndicator color="#7c3aed" /></View>;
  if (isError) return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <CXText style={{marginBottom: 16}}>Couldn&apos;t load event registrations.</CXText>
      <CXButton label="Retry" onPress={() => refetch()} variant="outline" />
    </View>
  );

  const attendees = event?.attendees?.filter((a: any) => a.status === "going") || [];
  
  const users = attendees.map((r: any) => ({
    ...r.user,
    id: r.user?._id || r.user?.id,
    avatar: r.user?.avatarUrl || r.user?.avatar || undefined,
    avatarUrl: r.user?.avatarUrl || undefined,
  })).filter((u: any) => u.id);

  return (
    <PeopleListPage
      navigation={navigation}
      title="Registrations"
      subtitle={`${users.length} registered`}
      users={users}
      action="View"
    />
  );
}
