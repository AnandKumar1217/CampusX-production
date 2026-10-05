import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useMemo, useState } from "react";
import * as ImagePicker from "expo-image-picker";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  Share,
  Alert,
  Modal,
  TouchableWithoutFeedback,
  RefreshControl,
 ActivityIndicator } from "react-native";

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
  type CXAction,
  CXAlert,
} from "@/components/ui";

import { api } from "@/services/api";
import { useAppStore } from "@/store/appStore";
import { colors, radius, spacing, typography } from "@/theme";
import type { RootStackParamList } from "@/types/navigation";
import { groupService, Group } from "@/services/groupService";
import { useFocusEffect, CommonActions } from "@react-navigation/native";
import { getSocket } from "@/services/socket";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useOpenChat } from "@/hooks/useOpenChat";

type StackProps<Name extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  Name
>;

function GroupIcon({
  icon,
  color,
  size = 54,
}: {
  icon: string;
  color: string;
  size?: number;
}) {
  return (
    <View
      style={[
        styles.groupIcon,
        {
          width: size,
          height: size,
          borderRadius: size * 0.3,
          backgroundColor: `${color}16`,
        },
      ]}
    >
      <Ionicons
        name={icon as keyof typeof Ionicons.glyphMap}
        size={Math.round(size * 0.45)}
        color={color}
      />
    </View>
  );
}

export function StudyGroupsScreen({ navigation, route }: StackProps<"StudyGroups">) {
  const user = useAppStore((state) => state.user);

  const [query, setQuery] = useState("");
  const deferredQuery = React.useDeferredValue(query);
  const [category, setCategory] = useState<"All Groups" | "My Groups" | "Joined">(route.params?.initialCategory ?? "All Groups");

  const publicGroups = useInfiniteQuery({
    queryKey: ["groups", user?.id, "public", deferredQuery],
    enabled: !!user?.id && category === "All Groups",
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const response = await groupService.listGroups(deferredQuery, pageParam);
      return response.data as { items: Group[]; page: number; limit: number; total: number };
    },
    getNextPageParam: (lastPage) =>
      lastPage.page * lastPage.limit < lastPage.total ? lastPage.page + 1 : undefined,
  });
  const membershipGroups = useQuery({
    queryKey: ["myGroups", user?.id, category, deferredQuery],
    enabled: !!user?.id && category !== "All Groups",
    queryFn: async () => {
      const response = await groupService.getMyGroups(deferredQuery, category === "Joined" ? "joined" : undefined);
      return (response.data ?? []) as Group[];
    },
  });
  const groups = category === "All Groups"
    ? publicGroups.data?.pages.flatMap((page) => page.items) ?? []
    : membershipGroups.data ?? [];
  const loading = category === "All Groups" ? publicGroups.isLoading : membershipGroups.isLoading;
  const isRefetching = category === "All Groups" ? publicGroups.isRefetching : membershipGroups.isRefetching;
  const isError = category === "All Groups" ? publicGroups.isError : membershipGroups.isError;
  const refetch = category === "All Groups" ? publicGroups.refetch : membershipGroups.refetch;

  useFocusEffect(React.useCallback(() => {
    if (user?.id) void refetch();
  }, [user?.id, refetch]));
  return (
    <CXScreen>
      <CXHeader
        title="Study Groups"
        subtitle="Learn together. Grow together."
        onBack={navigation.goBack}
        right={
          <CXRow>
            <CXIconButton
              icon="add"
              label="Create Group"
              backgroundColor={colors.transparent}
              onPress={() => navigation.navigate("CreateGroup")}
            />
          </CXRow>
        }
      />
      <ScrollView
        contentContainerStyle={styles.page}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} tintColor={colors.primary} />
        }
      >
        <View style={{ paddingHorizontal: spacing.screen }}>
          <CXSearchBar
            placeholder="Search groups, topics..."
            value={query}
            onChangeText={setQuery}
          />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.screen, gap: spacing.sm }}>
          <CXChip label="All Groups" active={category === "All Groups"} onPress={() => setCategory("All Groups")} />
          <CXChip label="My Groups" active={category === "My Groups"} onPress={() => setCategory("My Groups")} />
          <CXChip label="Joined" active={category === "Joined"} onPress={() => setCategory("Joined")} />
        </ScrollView>

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
        ) : isError ? (
          <CXButton label="Retry groups" onPress={() => void refetch()} />
        ) : (
          <>
            <View style={{ paddingHorizontal: spacing.screen, gap: spacing.md }}>
              <CXSectionHeader title={category} />
              {groups
                .filter((g: any, index: number, self: any[]) => self.findIndex((t: any) => (t._id || t.id) === (g._id || g.id)) === index)
                .map((group: any) => (
                  <Pressable
                    key={group._id || group.id}
                    onPress={() =>
                      navigation.navigate("GroupDetails", { groupId: group._id || group.id })
                    }
                  >
                    <CXCard style={styles.groupRow}>
                      {group.avatarUrl ? (
                        <CXAvatar source={group.avatarUrl} name={group.name} size={48} />
                      ) : (
                        <GroupIcon icon="people" color={colors.primary} size={48} />
                      )}

                      <View style={styles.flex}>
                        <CXText variant="bodyStrong">{group.name}</CXText>
                        <CXText variant="caption" color={colors.textMuted} numberOfLines={1}>
                          {group.description || group.category || "No description"}
                        </CXText>
                        <CXText variant="caption" color={colors.primary}>
                          {group.memberCount} members
                        </CXText>
                      </View>
                      <CXButton
                        label="Open"
                        size="sm"
                        variant="primary"
                        fullWidth={false}
                        onPress={() => {
                          navigation.navigate("GroupDetails", { groupId: group._id || group.id });
                        }}
                      />
                    </CXCard>
                  </Pressable>
                ))}
              {groups.length === 0 && (
                <CXText color={colors.textMuted} style={{ textAlign: "center", marginTop: spacing.xl }}>
                  No groups found.
                </CXText>
              )}
              {category === "All Groups" && publicGroups.hasNextPage ? (
                <CXButton label="Load more groups" loading={publicGroups.isFetchingNextPage} onPress={() => void publicGroups.fetchNextPage()} />
              ) : null}
            </View>
          </>
        )}
      </ScrollView>
    </CXScreen>
  );
}


export function GroupDetailsScreen({
  navigation,
  route,
}: StackProps<"GroupDetails">) {
  const user = useAppStore((state) => state.user);
  const [group, setGroup] = useState<Group | null>(null);
  const [membership, setMembership] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuVisible, setMenuVisible] = useState(false);
  const [removeMemberId, setRemoveMemberId] = useState<string | null>(null);

  const [loadError, setLoadError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { openChat } = useOpenChat();
  const refreshGroupDataRef = React.useRef<() => void>(() => { });
  const refreshGroup = () => {
    refreshGroupDataRef.current();
    void queryClient.invalidateQueries({ queryKey: ["groups"] });
    void queryClient.invalidateQueries({ queryKey: ["myGroups"] });
  };

  useFocusEffect(
    React.useCallback(() => {
      let isActive = true;
      let sequence = 0;
      const fetchGroupData = async () => {
        const currentRequest = ++sequence;
        const stillCurrent = () => isActive && currentRequest === sequence && useAppStore.getState().user?.id === user?.id;
        try {
          const response = await groupService.getGroup(route.params.groupId);
          if (!stillCurrent()) return;
          const nextGroup = response.data.group as Group;
          const nextMembership = response.data.membership;
          setGroup(nextGroup);
          setMembership(nextMembership);
          setLoadError(null);
          setMembers([]);
          setRequests([]);
          if (nextMembership?.status === "active") {
            const [membersResponse, requestsResponse] = await Promise.all([
              groupService.getMembers(route.params.groupId),
              nextMembership.role === "owner" || nextMembership.role === "admin"
                ? groupService.getJoinRequests(route.params.groupId)
                : Promise.resolve({ data: [] }),
            ]);
            if (!stillCurrent()) return;
            setMembers(membersResponse.data ?? []);
            setRequests(requestsResponse.data ?? []);
          }
        } catch (error) {
          if (stillCurrent()) {
            setGroup(null);
            setLoadError("This group is unavailable. Please try again.");
          }
        } finally {
          if (stillCurrent()) setLoading(false);
        }
      };
      refreshGroupDataRef.current = () => { void fetchGroupData(); };
      void fetchGroupData();
      const socket = getSocket();
      const onChanged = (payload: { groupId?: string }) => {
        if (String(payload?.groupId) === route.params.groupId) void fetchGroupData();
      };
      const onDeleted = (payload: { groupId?: string }) => {
        if (String(payload?.groupId) !== route.params.groupId) return;
        sequence += 1;
        setGroup(null);
        setLoadError("This group is no longer available.");
        setLoading(false);
      };
      socket?.on("group:updated", onChanged);
      socket?.on("group:membership:changed", onChanged);
      socket?.on("group:deleted", onDeleted);
      return () => {
        isActive = false;
        sequence += 1;
        socket?.off("group:updated", onChanged);
        socket?.off("group:membership:changed", onChanged);
        socket?.off("group:deleted", onDeleted);
      };
    }, [route.params.groupId, user?.id])
  );
  if (loading || !group) {
    return (
      <CXScreen>
        <CXHeader title="" onBack={navigation.goBack} />
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          {loading ? (
            <ActivityIndicator color={colors.primary} size="large" />
          ) : (
            <>
              <CXText color={colors.textMuted} align="center">{loadError ?? "Group unavailable."}</CXText>
              <CXButton label="Retry" onPress={refreshGroup} />
            </>
          )}
        </View>
      </CXScreen>
    );
  }

  const isOwner = membership?.role === "owner";
  const isAdmin = isOwner || membership?.role === "admin";
  const hasAccess = membership?.status === "active";

  const handleJoin = async () => {
    try {
      const response = await groupService.joinGroup(group._id);
      if (response.data?.status === "requested") Alert.alert("Request sent", "An admin will review your request.");
      refreshGroup();
    } catch (error: any) {
      Alert.alert("Error", error.response?.data?.message || "Failed to join");
    }
  };

  const handleLeave = async () => {
    try {
      await groupService.leaveGroup(group._id);
      refreshGroup();
    } catch (error: any) {
      Alert.alert("Error", error.response?.data?.message || "Failed to leave");
    }
  };

  const handleDelete = async () => {
    try {
      await groupService.deleteGroup(group._id);
      void queryClient.invalidateQueries({ queryKey: ["groups"] });
      void queryClient.invalidateQueries({ queryKey: ["myGroups"] });
      navigation.replace("StudyGroups");
    } catch (error: any) {
      Alert.alert("Error", error.response?.data?.message || "Failed to delete");
    }
  };

  const handleAcceptInvite = async () => {
    if (!user?.id) return;
    try {
      const response = await groupService.acceptInvite(group._id, user.id);
      if (response.data?.status === "requested") Alert.alert("Request sent", "An admin will review your request.");
      refreshGroup();
    } catch (error: any) {
      Alert.alert("Error", error.response?.data?.message || "Failed to accept invite");
    }
  };

  const handleDeclineInvite = async () => {
    if (!user?.id) return;
    try {
      await groupService.declineInvite(group._id, user.id);
      refreshGroup();
    } catch (error: any) {
      Alert.alert("Error", error.response?.data?.message || "Failed to decline invite");
    }
  };

  const handleApproveRequest = async (userId: string) => {
    try {
      await groupService.approveJoinRequest(group._id, userId);
      refreshGroup();
    } catch (error: any) {
      Alert.alert("Error", error.response?.data?.message || "Failed to approve request");
    }
  };

  const handleRejectRequest = async (userId: string) => {
    try {
      await groupService.rejectJoinRequest(group._id, userId);
      refreshGroup();
    } catch (error: any) {
      Alert.alert("Error", error.response?.data?.message || "Failed to reject request");
    }
  };

  const handleRemoveMember = async (userId: string) => {
    try {
      await groupService.removeMember(group._id, userId);
      refreshGroup();
    } catch (error: any) {
      Alert.alert("Error", error.response?.data?.message || "Failed to remove member");
    }
  };

  const groupActions: CXAction[] = isAdmin
    ? [
        {
          label: "Edit Group",
          icon: "pencil-outline",
          onPress: () => navigation.navigate("EditGroup", { groupId: group._id }),
        },
        ...(isOwner
          ? [
              {
                label: "Delete Group",
                icon: "trash-outline" as const,
                destructive: true,
                confirmationTitle: "Delete Group",
                confirmationMessage: "Are you sure you want to delete this group?",
                confirmationButtonText: "Delete",
                onPress: handleDelete,
              },
            ]
          : []),
      ]
    : [
        {
          label: hasAccess
            ? "Leave Group"
            : membership?.status === "requested"
              ? "Requested"
              : "Join Group",
          icon: hasAccess ? "exit-outline" : "enter-outline",
          destructive: hasAccess,
          confirmationTitle: hasAccess ? "Leave Group" : undefined,
          confirmationMessage: hasAccess ? "Are you sure?" : undefined,
          confirmationButtonText: hasAccess ? "Leave" : undefined,
          disabled: !hasAccess && membership?.status === "requested",
          onPress: hasAccess ? handleLeave : handleJoin,
        },
      ];

  return (
    <CXScrollScreen contentContainerStyle={styles.page}>
      <CXHeader
        title=""
        onBack={navigation.goBack}
        right={
          hasAccess ? (
            <CXIconButton
              icon="ellipsis-horizontal"
              label="Group options"
              backgroundColor={colors.transparent}
              onPress={() => setMenuVisible(true)}
            />
          ) : null
        }
      />
      <CXActionSheet
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        actions={groupActions}
      />
      <CXCard style={styles.groupHero}>
        {group.avatarUrl ? (
          <CXAvatar source={group.avatarUrl} name={group.name} size={76} />
        ) : (
          <GroupIcon icon="people" color={colors.primary} size={76} />
        )}
        <View style={styles.flex}>
          <CXText variant="h3">{group.name}</CXText>
          <CXText variant="caption" color={colors.primary}>
            {group.memberCount} members
          </CXText>
        </View>
      </CXCard>
      <View style={{ marginTop: spacing.md, marginBottom: spacing.md }}>
        <CXSectionHeader title="Overview" />
        <CXCard>
          <CXText variant="body" color={colors.ink}>
            {group.description || group.category || "No description provided."}
          </CXText>
        </CXCard>
      </View>
      {!hasAccess ? (
        membership?.status === "invited" ? (
          <CXRow style={{ gap: spacing.md }}>
            <CXButton label="Accept Invite" onPress={handleAcceptInvite} style={{ flex: 1 }} />
            <CXButton label="Decline" variant="outline" onPress={handleDeclineInvite} style={{ flex: 1 }} />
          </CXRow>
        ) : (
          <CXButton
            label={membership?.status === "requested" ? "Requested" : "Join Group"}
            onPress={handleJoin}
            disabled={membership?.status === "requested"}
          />
        )
      ) : (
        <>
          <CXRow style={{ gap: spacing.sm, marginTop: spacing.xs }}>
            <CXButton
              label="Chat"
              iconLeft="chatbubble-outline"
              style={{ flex: 1 }}
              onPress={() => navigation.navigate("GroupConversation", { groupId: group._id, name: group.name })}
            />
            <CXButton
              label="Invite"
              iconLeft="person-add-outline"
              variant="outline"
              style={{ flex: 1 }}
              onPress={() =>
                navigation.navigate("InviteToGroup", { groupId: group._id })
              }
            />
            <CXButton
              label="Share"
              iconLeft="share-social-outline"
              variant="outline"
              style={{ flex: 1 }}
              onPress={() => {
                Share.share({
                  message: `Check out the ${group.name} study group on CampusX! campusx://group/${group._id}`,
                });
              }}
            />
          </CXRow>

          {isAdmin && requests.length > 0 && (
            <View style={{ marginTop: spacing.xl }}>
              <CXSectionHeader title="Pending Requests" />
              <CXCard style={{ padding: spacing.sm, gap: spacing.sm }}>
                {requests.map((req, i) => (
                  <React.Fragment key={req.user._id}>
                    {i > 0 && <View style={styles.divider} />}
                    <CXRow style={{ alignItems: "center" }}>
                      <View style={{ flex: 1 }}>
                        <CXUserRow
                          user={req.user}
                          action="Approve"
                          onAction={() => handleApproveRequest(req.user._id)}
                        />
                      </View>
                      <CXIconButton
                        icon="close-outline"
                        label="Reject"
                        color={colors.danger}
                        backgroundColor={colors.surfaceLavender}
                        onPress={() => handleRejectRequest((req.user as any)._id || req.user.id)}
                        style={{ marginLeft: spacing.xs }}
                      />
                    </CXRow>
                  </React.Fragment>
                ))}
              </CXCard>
            </View>
          )}

          <View style={{ marginTop: spacing.xl, marginBottom: spacing.xl }}>
            <CXSectionHeader 
              title="Members" 
              action="See all"
              onAction={() => navigation.navigate("GroupMembers", { groupId: group._id })}
            />
            <CXCard style={{ padding: spacing.sm, gap: spacing.sm }}>
              {members.slice(0, 5).map((m, i) => (
                <React.Fragment key={m.user._id}>
                  {i > 0 && <View style={styles.divider} />}
                  <CXUserRow
                    user={m.user}
                    onRemove={membership?.role === "owner" && ((m.user as any)._id || m.user.id) !== user?.id ? () => {
                      setRemoveMemberId((m.user as any)._id || m.user.id);
                    } : undefined}
                    action={((m.user as any)._id || m.user.id) === user?.id ? "" : m.role === "owner" ? "Owner" : m.role === "admin" ? "Admin" : m.role === "moderator" ? "Mod" : undefined}
                    onAction={() => {
                      if (((m.user as any)._id || m.user.id) !== user?.id) {
                        openChat((m.user as any)._id || m.user.id, m.user.name);
                      }
                    }}
                  />
                </React.Fragment>
              ))}
            </CXCard>
          </View>
        </>
      )}
      <CXActionSheet
        visible={!!removeMemberId}
        onClose={() => setRemoveMemberId(null)}
        actions={[
          {
            label: "Remove Member",
            icon: "person-remove-outline",
            destructive: true,
            confirmationTitle: "Remove Member?",
            confirmationButtonText: "Remove",
            onPress: () => {
              if (removeMemberId) handleRemoveMember(removeMemberId);
              setRemoveMemberId(null);
            }
          }
        ]}
      />
    </CXScrollScreen>
  );
}

export function GroupMembersScreen({
  navigation,
  route,
}: StackProps<"GroupMembers">) {
  const [query, setQuery] = useState("");
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const { openChat } = useOpenChat();
  const currentUser = useAppStore(state => state.user);

  useFocusEffect(
    React.useCallback(() => {
      let isActive = true;
      const fetchMembers = async () => {
        try {
          const res = await groupService.getMembers(route.params.groupId);
          if (isActive) {
            setMembers(res.data ?? []);
            setLoadError(false);
          }
        } catch (e) {
          if (isActive) setLoadError(true);
        } finally {
          if (isActive) setLoading(false);
        }
      };
      void fetchMembers();
      const socket = getSocket();
      const onMembershipChanged = (payload: { groupId?: string }) => {
        if (String(payload?.groupId) === route.params.groupId) void fetchMembers();
      };
      socket?.on("group:membership:changed", onMembershipChanged);
      return () => {
        isActive = false;
        socket?.off("group:membership:changed", onMembershipChanged);
      };
    }, [route.params.groupId])
  );

  const filtered = useMemo(
    () =>
      members.filter((m) =>
        m.user?.name?.toLowerCase().includes(query.toLowerCase()),
      ),
    [query, members],
  );

  const admins = filtered.filter(m => m.role === "owner" || m.role === "admin");
  const moderators = filtered.filter(m => m.role === "moderator");
  const regularMembers = filtered.filter(m => m.role === "member");
  return (
    <CXScreen>
      <CXHeader
        title="Group Members"
        subtitle={`${members.length} members`}
        onBack={navigation.goBack}
        right={
          <CXIconButton
            icon="person-add-outline"
            label="Invite friends"
            backgroundColor={colors.transparent}
            onPress={() =>
              navigation.navigate("InviteToGroup", {
                groupId: route.params.groupId,
              })
            }
          />
        }
      />
      <ScrollView contentContainerStyle={styles.page}>
        <CXSearchBar
          placeholder="Search members..."
          value={query}
          onChangeText={setQuery}
        />
        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
        ) : loadError ? (
          <CXButton label="Retry members" onPress={() => navigation.replace("GroupMembers", { groupId: route.params.groupId })} />
        ) : (
          <>
            {admins.length > 0 && (
              <>
                <CXSectionHeader title="Admins" />
                <CXCard style={{ padding: spacing.sm, gap: spacing.sm }}>
                  {admins.map((m, idx) => (
                    <React.Fragment key={m.user._id}>
                      {idx > 0 && <View style={styles.divider} />}
                      <CXUserRow
                        user={m.user}
                        action={((m.user as any)._id || m.user.id) === currentUser?.id ? "" : undefined}
                        onAction={() => {
                          if (((m.user as any)._id || m.user.id) !== currentUser?.id) {
                            openChat((m.user as any)._id || m.user.id, m.user.name);
                          }
                        }}
                        onPress={() => navigation.navigate("UserProfile", { userId: m.user._id })}
                      />
                    </React.Fragment>
                  ))}
                </CXCard>
              </>
            )}

            {moderators.length > 0 && (
              <>
                <CXSectionHeader title="Moderators" />
                <CXCard style={{ padding: spacing.sm, gap: spacing.sm }}>
                  {moderators.map((m, idx) => (
                    <React.Fragment key={m.user._id}>
                      {idx > 0 && <View style={styles.divider} />}
                      <CXUserRow
                        user={m.user}
                        action={((m.user as any)._id || m.user.id) === currentUser?.id ? "" : undefined}
                        onAction={() => {
                          if (((m.user as any)._id || m.user.id) !== currentUser?.id) {
                            openChat((m.user as any)._id || m.user.id, m.user.name);
                          }
                        }}
                        onPress={() => navigation.navigate("UserProfile", { userId: m.user._id })}
                      />
                    </React.Fragment>
                  ))}
                </CXCard>
              </>
            )}

            {regularMembers.length > 0 && (
              <>
                <CXSectionHeader title="Members" />
                <CXCard style={{ padding: spacing.sm, gap: spacing.sm }}>
                  {regularMembers.map((m, idx) => (
                    <React.Fragment key={m.user._id}>
                      {idx > 0 && <View style={styles.divider} />}
                      <CXUserRow
                        user={m.user}
                        action={((m.user as any)._id || m.user.id) === currentUser?.id ? "" : undefined}
                        onAction={() => {
                          if (((m.user as any)._id || m.user.id) !== currentUser?.id) {
                            openChat((m.user as any)._id || m.user.id, m.user.name);
                          }
                        }}
                        onPress={() => navigation.navigate("UserProfile", { userId: m.user._id })}
                      />
                    </React.Fragment>
                  ))}
                </CXCard>
              </>
            )}
            {filtered.length === 0 && (
              <CXText color={colors.textMuted} style={{ textAlign: "center", marginTop: spacing.xl }}>
                No members found.
              </CXText>
            )}
          </>
        )}
      </ScrollView>
      <CXButton
        label="Invite Friends"
        iconLeft="person-add-outline"
        style={styles.bottomButton}
        onPress={() =>
          navigation.navigate("InviteToGroup", {
            groupId: route.params.groupId,
          })
        }
      />
    </CXScreen>
  );
}

export function GroupPollsScreen({
  navigation,
  route,
}: StackProps<"GroupPolls">) {
  const [polls, setPolls] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPolls = async () => {
    try {
      const res = await groupService.getPolls(route.params.groupId);
      setPolls(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      fetchPolls();
    }, [route.params.groupId])
  );

  const vote = async (pollId: string, option: number) => {
    try {
      await groupService.votePoll(route.params.groupId, pollId, option);
      fetchPolls();
    } catch (err: any) {
      Alert.alert("Error", err.response?.data?.message || "Failed to vote");
    }
  };

  return (
    <CXScreen>
      <CXHeader
        title="Group Polls"
        subtitle="Polls"
        onBack={navigation.goBack}
      />
      <ScrollView contentContainerStyle={styles.page}>
        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
        ) : polls.length === 0 ? (
          <CXText color={colors.textMuted} style={{ textAlign: "center", marginTop: spacing.xl }}>
            No polls found.
          </CXText>
        ) : (
          polls.map((poll) => {
            const total = poll.options.reduce((sum: number, option: any) => sum + option.voters.length, 0);
            return (
              <CXCard key={poll._id} style={styles.poll}>
                <CXRow>
                  <CXAvatar
                    source={poll.author?.avatarUrl || ""}
                    name={poll.author?.name || "Member"}
                    size={36}
                  />
                  <View style={styles.flex}>
                    <CXText variant="smallStrong">{poll.author?.name || "Member"}</CXText>
                  </View>
                </CXRow>
                <CXText variant="title">{poll.question}</CXText>
                {poll.options.map((option: any, index: number) => {
                  const count = option.voters.length;
                  const percent = total > 0 ? Math.round((count / total) * 100) : 0;
                  return (
                    <Pressable
                      key={index}
                      onPress={() => vote(poll._id, index)}
                      style={[
                        styles.pollOption,
                      ]}
                    >
                      <CXRow>
                        <CXText variant="smallStrong" style={styles.flex}>
                          {option.label}
                        </CXText>
                        <CXText variant="caption" color={colors.primary}>
                          {percent}%
                        </CXText>
                      </CXRow>
                      <View style={styles.pollTrack}>
                        <View style={[styles.pollFill, { width: `${percent}%` }]} />
                      </View>
                    </Pressable>
                  );
                })}
                <CXText variant="caption" color={colors.textMuted}>
                  {total} votes
                </CXText>
              </CXCard>
            );
          })
        )}
      </ScrollView>
    </CXScreen>
  );
}

export function GroupFilesScreen({ navigation, route }: StackProps<"GroupFiles">) {
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useFocusEffect(
    React.useCallback(() => {
      groupService.getFiles(route.params.groupId)
        .then(res => setFiles(res.data))
        .catch(console.error)
        .finally(() => setLoading(false));
    }, [route.params.groupId])
  );

  return (
    <CXScreen>
      <CXHeader
        title="Files & Notes"
        subtitle="Shared study resources"
        onBack={navigation.goBack}
      />
      <ScrollView contentContainerStyle={styles.page}>
        <CXSearchBar placeholder="Search files..." value={query} onChangeText={setQuery} />

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
        ) : files.length === 0 ? (
          <CXCard style={{ marginTop: spacing.md }}>
            <CXText variant="bodyStrong">No files yet</CXText>
            <CXText variant="caption" color={colors.textMuted}>
              There are no shared files in this group.
            </CXText>
          </CXCard>
        ) : (
          <>
            <CXSectionHeader title="Shared Files" />
            {files.filter((file) => (file.title || file.name || "").toLowerCase().includes(query.trim().toLowerCase())).map((file) => (
              <CXCard key={file._id} style={styles.fileRow}>
                <View style={styles.fileIcon}>
                  <Ionicons name="document-text-outline" size={22} color={colors.primary} />
                </View>
                <View style={styles.flex}>
                  <CXText variant="smallStrong">{file.title || file.name || "Document"}</CXText>
                  <CXText variant="caption" color={colors.textMuted}>
                    PDF · {file.uploadedBy?.name || "Member"}
                  </CXText>
                </View>
              </CXCard>
            ))}
          </>
        )}
      </ScrollView>
    </CXScreen>
  );
}

function SessionCard({ session }: { session: any }) {
  const date = new Date(session.startsAt);
  const dateString = date.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <CXCard style={styles.session}>
      <View style={styles.sessionIcon}>
        <Ionicons name="code-slash-outline" size={24} color={colors.primary} />
      </View>
      <View style={styles.flex}>
        <CXText variant="bodyStrong">{session.title}</CXText>
        <CXText variant="caption" color={colors.textMuted}>
          {dateString} · {timeString}
        </CXText>
        <CXRow style={styles.sessionMeta}>
          {session.meetingUrl ? (
            <CXChip label="Online" icon="videocam-outline" />
          ) : (
            <CXChip label={session.location || "TBD"} icon="location-outline" />
          )}
        </CXRow>
      </View>
    </CXCard>
  );
}
export function StudySessionsScreen({
  navigation,
  route,
}: StackProps<"StudySessions">) {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    React.useCallback(() => {
      const groupId = route.params?.groupId;
      if (!groupId) return;
      groupService.getSessions(groupId)
        .then(res => setSessions(res.data))
        .catch(console.error)
        .finally(() => setLoading(false));
    }, [route.params?.groupId])
  );

  return (
    <CXScreen>
      <CXHeader
        title="Study Sessions"
        subtitle="Upcoming group study"
        onBack={navigation.goBack}
      />
      <ScrollView contentContainerStyle={styles.page}>
        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
        ) : sessions.length === 0 ? (
          <CXCard style={{ marginTop: spacing.md }}>
            <CXText variant="bodyStrong">No sessions scheduled</CXText>
            <CXText variant="caption" color={colors.textMuted}>
              There are no upcoming sessions in this group.
            </CXText>
          </CXCard>
        ) : (
          <>
            <CXSectionHeader title="Upcoming Sessions" />
            {sessions.map(session => (
              <SessionCard key={session._id} session={session} />
            ))}
          </>
        )}

      </ScrollView>
    </CXScreen>
  );
}

export function InviteToGroupScreen({
  navigation,
  route,
}: StackProps<"InviteToGroup">) {
  const [group, setGroup] = useState<Group | null>(null);
  const [friends, setFriends] = useState<any[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(true);

  useFocusEffect(
    React.useCallback(() => {
      let isActive = true;
      groupService.getGroup(route.params.groupId)
        .then(res => { if (isActive) setGroup(res.data.group); })
        .catch(console.error);

      Promise.all([
        api.get("/friends"),
        groupService.getMembers(route.params.groupId)
      ])
        .then(([friendsRes, membersRes]) => {
          if (isActive) {
            const memberIds = new Set(membersRes.data.map((m: any) => m.user._id || m.user));
            const availableFriends = friendsRes.data.data.filter((f: any) => !memberIds.has(f._id));
            setFriends(availableFriends);
          }
        })
        .catch(console.error)
        .finally(() => { if (isActive) setLoadingFriends(false); });

      return () => { isActive = false; };
    }, [route.params.groupId])
  );

  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [alertState, setAlertState] = useState<{ visible: boolean, title: string, message: string, type: any, onOk?: () => void }>({ visible: false, title: "", message: "", type: "error" });

  const toggle = (id: string) =>
    setSelected((items) =>
      items.includes(id) ? items.filter((item) => item !== id) : [...items, id],
    );

  const send = async () => {
    try {
      await groupService.inviteUsers(route.params.groupId, selected);
      setAlertState({
        visible: true,
        title: "Success",
        message: "Invites sent successfully!",
        type: "success",
        onOk: () => navigation.goBack()
      });
    } catch (err: any) {
      setAlertState({
        visible: true,
        title: "Error",
        message: err.response?.data?.message || "Failed to send invites",
        type: "error"
      });
    }
  };

  let displayPeople = friends;

  if (query.trim()) {
    displayPeople = displayPeople.filter(p =>
      p.name?.toLowerCase().includes(query.toLowerCase()) ||
      p.department?.toLowerCase().includes(query.toLowerCase())
    );
  }
  return (
    <CXScreen>
      <CXHeader
        title="Invite Friends"
        subtitle={group?.name ?? "Study Group"}
        onBack={navigation.goBack}
      />
      <ScrollView contentContainerStyle={styles.page}>
        <CXSearchBar
          placeholder="Search friends by name, department..."
          value={query}
          onChangeText={setQuery}
        />

        {loadingFriends ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
        ) : (
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.selected}
            >
              {selected.map((id) => {
                const user = friends.find((item) => item._id === id);
                if (!user) return null;
                return (
                  <Pressable
                    key={id}
                    onPress={() => toggle(id)}
                    style={styles.selectedPerson}
                  >
                    <CXAvatar source={user.avatarUrl} name={user.name} size={42} />
                    <View style={styles.remove}>
                      <Ionicons name="close" size={11} color={colors.white} />
                    </View>
                    <CXText variant="caption" numberOfLines={1}>
                      {user.name.split(" ")[0]}
                    </CXText>
                  </Pressable>
                );
              })}
            </ScrollView>
            {displayPeople.length > 0 ? (
              <CXCard style={{ padding: spacing.sm, gap: spacing.sm }}>
                {displayPeople.map((user, idx) => (
                  <React.Fragment key={user._id}>
                    {idx > 0 && <View style={styles.divider} />}
                    <Pressable onPress={() => toggle(user._id)}>
                      <CXRow style={styles.inviteRow}>
                        <CXAvatar source={user.avatarUrl} name={user.name} />
                        <View style={styles.flex}>
                          <CXText variant="bodyStrong">{user.name}</CXText>
                          <CXText variant="caption" color={colors.textMuted}>
                            {user.department || "No Department"} · {user.academicYear || "N/A"}
                          </CXText>
                        </View>
                        <View
                          style={[
                            styles.checkbox,
                            selected.includes(user._id) && styles.checkboxActive,
                          ]}
                        >
                          {selected.includes(user._id) ? (
                            <Ionicons name="checkmark" size={15} color={colors.white} />
                          ) : null}
                        </View>
                      </CXRow>
                    </Pressable>
                  </React.Fragment>
                ))}
              </CXCard>
            ) : (
              <CXText color={colors.textMuted} style={{ textAlign: "center", marginTop: spacing.xl }}>
                No friends found.
              </CXText>
            )}
          </>
        )}
      </ScrollView>
      <View style={styles.inviteFooter}>
        <CXText variant="small" color={colors.textMuted}>
          {selected.length} selected
        </CXText>
        <CXButton
          label="Send Invites"
          iconLeft="paper-plane-outline"
          fullWidth={false}
          disabled={!selected.length}
          onPress={() => void send()}
        />
      </View>
      <CXAlert
        visible={alertState.visible}
        title={alertState.title}
        message={alertState.message}
        type={alertState.type}
        onClose={() => {
          setAlertState(s => ({ ...s, visible: false }));
          if (alertState.onOk) alertState.onOk();
        }}
      />
    </CXScreen>
  );
}

export function GroupPostsScreen({ navigation, route }: StackProps<"GroupPosts">) {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    React.useCallback(() => {
      groupService.getPosts(route.params.groupId)
        .then(res => setPosts(res.data))
        .catch(console.error)
        .finally(() => setLoading(false));
    }, [route.params.groupId])
  );

  return (
    <CXScreen>
      <CXHeader title="Group Posts" onBack={navigation.goBack} />
      <ScrollView contentContainerStyle={styles.page}>
        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
        ) : posts.length === 0 ? (
          <CXCard>
            <CXText variant="bodyStrong">No posts yet</CXText>
            <CXText variant="caption" color={colors.textMuted}>
              Be the first to start a discussion in this group!
            </CXText>
          </CXCard>
        ) : (
          posts.map(post => (
            <CXCard key={post._id} style={{ marginBottom: spacing.sm }}>
              <CXText variant="bodyStrong">{post.title || "Post"}</CXText>
              <CXText variant="caption" color={colors.textMuted}>{post.content}</CXText>
            </CXCard>
          ))
        )}
      </ScrollView>
    </CXScreen>
  );
}

export function CreateGroupScreen({ navigation }: StackProps<"CreateGroup">) {
  const [name, setName] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [description, setDescription] = useState("");
  const [privacy, setPrivacy] = useState<"public" | "private">("public");
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets?.[0]?.uri) {
      setAvatarUri(result.assets[0].uri);
    }
  };

  const handleCreate = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      let finalAvatarUrl: string | undefined;
      let finalAvatarPublicId: string | undefined;

      if (avatarUri) {
        const formData = new FormData();
        const filename = avatarUri.split('/').pop() || 'avatar.jpg';
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : "image";

        formData.append('file', {
          uri: avatarUri,
          name: filename,
          type,
        } as any);

        const uploadRes = await api.post('/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });

        finalAvatarUrl = uploadRes.data.data.url;
        finalAvatarPublicId = uploadRes.data.data.publicId;
      }

      const res = await groupService.createGroup({
        name: name.trim(),
        category: subtitle.trim(),
        description: description.trim(),
        privacy: privacy,
        avatarUrl: finalAvatarUrl,
        avatarPublicId: finalAvatarPublicId
      });
      navigation.dispatch(
        CommonActions.reset({
          index: 1,
          routes: [
            { name: "Main", params: { screen: "Chats" } },
            { name: "GroupDetails", params: { groupId: res.data._id } },
          ],
        })
      );
    } catch (err: any) {
      Alert.alert("Error", err.response?.data?.message || "Failed to create group");
    } finally {
      setLoading(false);
    }
  };

  return (
    <CXScreen style={{ backgroundColor: "#FAFAFA" }}>
      <CXHeader
        title="Create Group"
        subtitle="Start a new study circle"
        onBack={navigation.goBack}
      />
      <ScrollView contentContainerStyle={[styles.page, { paddingBottom: 100 }]}>

        {/* Avatar Section */}
        <View style={{ alignItems: "center", marginBottom: spacing.xl, marginTop: spacing.lg }}>
          <Pressable onPress={pickImage} style={{ position: "relative" }}>
            <CXAvatar size={100} source={avatarUri || undefined} name={name || "Group"} />
            <View style={{
              position: "absolute",
              bottom: 0,
              right: 0,
              backgroundColor: colors.primary,
              width: 32,
              height: 32,
              borderRadius: 16,
              justifyContent: "center",
              alignItems: "center",
              borderWidth: 3,
              borderColor: "#FAFAFA"
            }}>
              <Ionicons name="camera" size={16} color="white" />
            </View>
          </Pressable>
          <CXText variant="caption" style={{ marginTop: spacing.sm, color: colors.textMuted }}>
            Tap to upload group picture
          </CXText>
        </View>

        {/* Form Section */}
        <CXCard style={{ backgroundColor: "white", padding: spacing.lg, borderRadius: radius.lg, elevation: 1, shadowOpacity: 0.05, shadowRadius: 10 }}>

          <CXText variant="caption" style={{ fontWeight: "700", color: colors.primary, marginBottom: spacing.xs, textTransform: "uppercase", letterSpacing: 1 }}>
            Group Name *
          </CXText>
          <TextInput
            style={[styles.input, { backgroundColor: "#F5F5F7", borderWidth: 0, fontSize: 16, paddingVertical: 14, marginBottom: spacing.lg }]}
            placeholder="e.g. Algorithms & Data Structures"
            placeholderTextColor={colors.textMuted}
            value={name}
            onChangeText={setName}
          />

          <CXText variant="caption" style={{ fontWeight: "700", color: colors.primary, marginBottom: spacing.xs, textTransform: "uppercase", letterSpacing: 1 }}>
            Category
          </CXText>
          <TextInput
            style={[styles.input, { backgroundColor: "#F5F5F7", borderWidth: 0, fontSize: 16, paddingVertical: 14, marginBottom: spacing.lg }]}
            placeholder="e.g. Computer Science"
            placeholderTextColor={colors.textMuted}
            value={subtitle}
            onChangeText={setSubtitle}
          />

          <CXText variant="caption" style={{ fontWeight: "700", color: colors.primary, marginBottom: spacing.xs, textTransform: "uppercase", letterSpacing: 1 }}>
            Description
          </CXText>
          <TextInput
            style={[styles.input, { backgroundColor: "#F5F5F7", borderWidth: 0, fontSize: 16, paddingVertical: 14, minHeight: 100, textAlignVertical: 'top', marginBottom: spacing.lg }]}
            placeholder="What is this group about?"
            placeholderTextColor={colors.textMuted}
            value={description}
            onChangeText={setDescription}
            multiline
          />

        </CXCard>

        {/* Privacy Section */}
        <View style={{ marginTop: spacing.xl, marginBottom: spacing.sm, paddingHorizontal: spacing.sm }}>
          <CXText variant="bodyStrong" style={{ fontSize: 18, marginBottom: spacing.md }}>
            Privacy Setting
          </CXText>

          <Pressable
            onPress={() => setPrivacy("public")}
            style={{
              flexDirection: "row",
              padding: spacing.lg,
              backgroundColor: "white",
              borderRadius: radius.md,
              borderWidth: 2,
              borderColor: privacy === "public" ? colors.primary : "transparent",
              marginBottom: spacing.md,
              alignItems: "center"
            }}
          >
            <View style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              backgroundColor: privacy === "public" ? `${colors.primary}15` : "#F5F5F7",
              justifyContent: "center",
              alignItems: "center",
              marginRight: spacing.md
            }}>
              <Ionicons name="earth" size={24} color={privacy === "public" ? colors.primary : colors.textMuted} />
            </View>
            <View style={{ flex: 1 }}>
              <CXText variant="bodyStrong" style={{ fontSize: 16, color: privacy === "public" ? colors.ink : colors.textMuted }}>Public Group</CXText>
              <CXText variant="caption" style={{ color: colors.textMuted, marginTop: 2 }}>Anyone on CampusX can find and join.</CXText>
            </View>
          </Pressable>

          <Pressable
            onPress={() => setPrivacy("private")}
            style={{
              flexDirection: "row",
              padding: spacing.lg,
              backgroundColor: "white",
              borderRadius: radius.md,
              borderWidth: 2,
              borderColor: privacy === "private" ? colors.primary : "transparent",
              alignItems: "center"
            }}
          >
            <View style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              backgroundColor: privacy === "private" ? `${colors.primary}15` : "#F5F5F7",
              justifyContent: "center",
              alignItems: "center",
              marginRight: spacing.md
            }}>
              <Ionicons name="lock-closed" size={24} color={privacy === "private" ? colors.primary : colors.textMuted} />
            </View>
            <View style={{ flex: 1 }}>
              <CXText variant="bodyStrong" style={{ fontSize: 16, color: privacy === "private" ? colors.ink : colors.textMuted }}>Private Group</CXText>
              <CXText variant="caption" style={{ color: colors.textMuted, marginTop: 2 }}>Members must be invited or approved to join.</CXText>
            </View>
          </Pressable>

        </View>

      </ScrollView>

      <View style={{ padding: spacing.lg, backgroundColor: "white", borderTopWidth: 1, borderTopColor: colors.border }}>
        <CXButton
          label="Create Group"
          onPress={handleCreate}
          disabled={!name.trim() || loading}
        />
      </View>
    </CXScreen>
  );
}

export function EditGroupScreen({ navigation, route }: StackProps<"EditGroup">) {
  const queryClient = useQueryClient();
  const [group, setGroup] = useState<Group | null>(null);

  const [name, setName] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [description, setDescription] = useState("");
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [avatarOptionsVisible, setAvatarOptionsVisible] = useState(false);

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets?.[0]?.uri) {
      setAvatarUri(result.assets[0].uri);
    }
    setAvatarOptionsVisible(false);
  };

  useFocusEffect(
    React.useCallback(() => {
      groupService.getGroup(route.params.groupId)
        .then(res => {
          setGroup(res.data.group);
          setName(res.data.group.name);
          setSubtitle(res.data.group.category || "");
          setDescription(res.data.group.description || "");
          if (res.data.group.avatarUrl) setAvatarUri(res.data.group.avatarUrl);
        })
        .catch(console.error);
    }, [route.params.groupId])
  );

  const handleUpdate = async () => {
    if (!name.trim() || !group) return;
    setLoading(true);
    try {
      let finalAvatarUrl = group.avatarUrl;
      let finalAvatarPublicId = group.avatarPublicId;

      if (avatarUri === "") {
        finalAvatarUrl = "";
        finalAvatarPublicId = "";
      } else if (avatarUri && avatarUri !== group.avatarUrl) {
        const formData = new FormData();
        const filename = avatarUri.split('/').pop() || 'avatar.jpg';
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : "image";

        formData.append('file', {
          uri: avatarUri,
          name: filename,
          type,
        } as any);

        const uploadRes = await api.post('/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });

        finalAvatarUrl = uploadRes.data.data.url;
        finalAvatarPublicId = uploadRes.data.data.publicId;
      }

      await groupService.updateGroup(group._id || group.id, {
        name: name.trim(),
        category: subtitle.trim(),
        description: description.trim(),
        avatarUrl: finalAvatarUrl,
        avatarPublicId: finalAvatarPublicId
      });

      queryClient.invalidateQueries({ queryKey: ["groups"] });
      queryClient.invalidateQueries({ queryKey: ["myGroups"] });
      queryClient.invalidateQueries({ queryKey: ["group", group._id || group.id] });

      navigation.goBack();
    } catch (err: any) {
      Alert.alert("Error", err.response?.data?.message || "Failed to update group");
    } finally {
      setLoading(false);
    }
  };

  if (!group) return null;

  return (
    <CXScreen>
      <CXHeader
        title="Edit Group"
        subtitle="Update group details"
        onBack={navigation.goBack}
      />
      <ScrollView contentContainerStyle={styles.page}>
        {/* Avatar Section */}
        <View style={{ alignItems: "center", marginBottom: spacing.xl, marginTop: spacing.md }}>
          <Pressable onPress={() => setAvatarOptionsVisible(true)} style={{ position: "relative" }}>
            <CXAvatar size={100} source={avatarUri === "" ? undefined : (avatarUri || undefined)} name={name || "Group"} />
            <View style={{
              position: "absolute",
              bottom: 0,
              right: 0,
              backgroundColor: colors.primary,
              width: 32,
              height: 32,
              borderRadius: 16,
              justifyContent: "center",
              alignItems: "center",
              borderWidth: 3,
              borderColor: "#FAFAFA"
            }}>
              <Ionicons name="camera" size={16} color="white" />
            </View>
          </Pressable>
        </View>

        <CXCard>
          <CXText variant="bodyStrong" style={{ marginBottom: spacing.sm }}>
            Group Name
          </CXText>
          <TextInput
            style={[styles.input, { marginBottom: spacing.md }]}
            placeholder="e.g. DBMS Study Circle"
            value={name}
            onChangeText={setName}
            autoFocus
          />

          <CXText variant="bodyStrong" style={{ marginBottom: spacing.sm }}>
            Subtitle / Topic
          </CXText>
          <TextInput
            style={[styles.input, { marginBottom: spacing.md }]}
            placeholder="e.g. Notes, queries, and discussions"
            value={subtitle}
            onChangeText={setSubtitle}
          />

          <CXText variant="bodyStrong" style={{ marginBottom: spacing.sm }}>
            Description
          </CXText>
          <TextInput
            style={[styles.input, { marginBottom: spacing.md, minHeight: 80, textAlignVertical: 'top' }]}
            placeholder="Detailed description of the group"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
          />

          <CXButton
            label="Save Changes"
            onPress={handleUpdate}
            disabled={!name.trim()}
          />
        </CXCard>
      </ScrollView>

      <CXActionSheet
        visible={avatarOptionsVisible}
        onClose={() => setAvatarOptionsVisible(false)}
        actions={[
          {
            label: "Choose Photo",
            icon: "image-outline",
            onPress: pickImage,
          },
          {
            label: "Remove Photo",
            icon: "trash-outline",
            destructive: true,
            onPress: () => {
              setAvatarUri("");
              setAvatarOptionsVisible(false);
            },
          }
        ]}
      />
    </CXScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  page: {
    paddingTop: spacing.md,
    paddingBottom: 100,
    paddingHorizontal: spacing.screen,
    gap: spacing.md,
  },
  divider: { height: 1, backgroundColor: colors.borderSoft },
  input: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.surfaceLavender,
    ...typography.body,
  },
  filters: { gap: spacing.xs, flexWrap: "wrap" },
  groupIcon: { alignItems: "center", justifyContent: "center" },
  popular: { gap: spacing.sm },
  popularCard: {
    width: 158,
    minHeight: 190,
    alignItems: "center",
    gap: spacing.xs,
  },
  groupRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.sm,
  },
  groupHero: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.backgroundLavender,
  },
  groupActions: { gap: spacing.xs },
  pinned: { gap: spacing.xs },
  pinnedCard: { flex: 1, minHeight: 100, gap: spacing.xs, padding: spacing.sm },
  discussion: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    padding: spacing.sm,
  },
  bottomButton: {
    position: "absolute",
    left: spacing.screen,
    right: spacing.screen,
    bottom: spacing.lg,
  },
  request: { minHeight: 74 },
  poll: { gap: spacing.md },
  pollOption: {
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pollSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceLavender,
  },
  pollTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.borderSoft,
    overflow: "hidden",
  },
  pollFill: { height: 6, borderRadius: 3, backgroundColor: colors.primary },
  fileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.sm,
  },
  fileIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceLavender,
    alignItems: "center",
    justifyContent: "center",
  },
  folders: { flexWrap: "wrap", gap: spacing.sm },
  folder: { width: "47.8%", gap: spacing.xs },
  note: { gap: spacing.sm },
  session: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.sm,
  },
  sessionIcon: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceLavender,
    alignItems: "center",
    justifyContent: "center",
  },
  sessionMeta: { gap: spacing.xs, marginTop: spacing.xs },
  selected: { minHeight: 66, gap: spacing.sm, alignItems: "center" },
  selectedPerson: { width: 52, alignItems: "center", gap: 3 },
  remove: {
    position: "absolute",
    right: -2,
    top: -2,
    width: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  inviteRow: { minHeight: 68, gap: spacing.sm, alignItems: "center" },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  inviteFooter: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalOverlay: {
    flex: 1,
  },
  dropdownMenu: {
    position: "absolute",
    top: 50,
    right: 20,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.sm,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
    minWidth: 200,
  },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    gap: spacing.sm,
  },
});
