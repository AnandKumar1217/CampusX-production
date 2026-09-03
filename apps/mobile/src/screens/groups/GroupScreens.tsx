import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useMemo, useState } from "react";
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
} from "react-native";

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

import { api } from "@/services/api";
import { useAppStore } from "@/store/appStore";
import { colors, radius, spacing, typography } from "@/theme";
import type { RootStackParamList } from "@/types/navigation";

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

export function StudyGroupsScreen({ navigation }: StackProps<"StudyGroups">) {
  const groups = useAppStore((state) => state.studyGroups);
  const toggleJoined = useAppStore((state) => state.toggleGroupMembership);
  const user = useAppStore((state) => state.user);
  
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"All Groups" | "My Groups" | "Joined">("All Groups");
  
  const filtered = groups.filter((group) => {
    const matchesQuery = group.name.toLowerCase().includes(query.toLowerCase()) || group.subtitle.toLowerCase().includes(query.toLowerCase());
    const matchesCategory = 
      category === "All Groups" ? true :
      category === "Joined" ? group.joined :
      category === "My Groups" ? group.creatorId === (user?.id ?? "guest") : true;
      
    return matchesQuery && matchesCategory;
  });
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
      <ScrollView contentContainerStyle={styles.page}>
        <CXSearchBar
          placeholder="Search groups, topics..."
          value={query}
          onChangeText={setQuery}
        />
        <CXRow style={styles.filters}>
          <CXChip label="All Groups" active={category === "All Groups"} onPress={() => setCategory("All Groups")} />
          <CXChip label="My Groups" active={category === "My Groups"} onPress={() => setCategory("My Groups")} />
          <CXChip label="Joined" active={category === "Joined"} onPress={() => setCategory("Joined")} />
        </CXRow>
        <CXSectionHeader title="Popular Groups" action="See all" />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.popular}
        >
          {groups.slice(0, 3).map((group) => (
            <Pressable
              key={group.id}
              onPress={() =>
                navigation.navigate("GroupDetails", { groupId: group.id })
              }
            >
              <CXCard style={styles.popularCard}>
                <GroupIcon icon={group.icon} color={group.color} />
                <CXText variant="bodyStrong" numberOfLines={2} align="center">
                  {group.name}
                </CXText>
                <CXText variant="caption" color={colors.textMuted}>
                  {group.members} members
                </CXText>
                <CXButton
                  label={group.joined ? "Open" : "Join"}
                  size="sm"
                  variant={group.joined ? "outline" : "primary"}
                  onPress={() => {
                    if (group.joined) {
                      navigation.navigate("GroupDetails", { groupId: group.id });
                    } else {
                      toggleJoined(group.id);
                    }
                  }}
                />
              </CXCard>
            </Pressable>
          ))}
        </ScrollView>
        <CXSectionHeader title="All Groups" />
        {filtered.map((group) => (
          <Pressable
            key={group.id}
            onPress={() =>
              navigation.navigate("GroupDetails", { groupId: group.id })
            }
          >
            <CXCard style={styles.groupRow}>
              <GroupIcon icon={group.icon} color={group.color} size={48} />
              <View style={styles.flex}>
                <CXText variant="bodyStrong">{group.name}</CXText>
                <CXText variant="caption" color={colors.textMuted}>
                  {group.subtitle}
                </CXText>
                <CXText variant="caption" color={colors.primary}>
                  {group.members} members · Active now
                </CXText>
              </View>
              <CXButton
                label={group.joined ? "Open" : "Join"}
                size="sm"
                variant={group.joined ? "outline" : "primary"}
                fullWidth={false}
                onPress={() => {
                  if (group.joined) {
                    navigation.navigate("GroupDetails", { groupId: group.id });
                  } else {
                    toggleJoined(group.id);
                  }
                }}
              />
            </CXCard>
          </Pressable>
        ))}
      </ScrollView>
    </CXScreen>
  );
}

export function GroupDetailsScreen({
  navigation,
  route,
}: StackProps<"GroupDetails">) {
  const allGroups = useAppStore(state => state.studyGroups);
  const user = useAppStore((state) => state.user);
  const group = allGroups.find((item) => item.id === route.params.groupId) ?? allGroups[0]!;
  const toggleJoined = useAppStore(state => state.toggleGroupMembership);
  const [menuVisible, setMenuVisible] = useState(false);
  
  const isAdmin = group.creatorId === (user?.id ?? "guest");
  const hasAccess = group.joined || isAdmin;

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
      <Modal visible={menuVisible} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={() => setMenuVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.dropdownMenu}>
              <Pressable
                style={styles.dropdownItem}
                onPress={() => {
                  setMenuVisible(false);
                }}
              >
                <Ionicons name="notifications-off-outline" size={20} color={colors.ink} />
                <CXText variant="body">Mute Notifications</CXText>
              </Pressable>
              
              {isAdmin ? (
                <>
                  <Pressable
                    style={styles.dropdownItem}
                    onPress={() => {
                      setMenuVisible(false);
                      navigation.navigate("EditGroup", { groupId: group.id });
                    }}
                  >
                    <Ionicons name="pencil-outline" size={20} color={colors.ink} />
                    <CXText variant="body">Edit Group</CXText>
                  </Pressable>
                  <Pressable
                    style={styles.dropdownItem}
                    onPress={() => {
                      setMenuVisible(false);
                      useAppStore.getState().deleteStudyGroup(group.id);
                      navigation.navigate("StudyGroups");
                    }}
                  >
                    <Ionicons name="trash-outline" size={20} color={colors.error} />
                    <CXText variant="body" color={colors.error}>Delete Group</CXText>
                  </Pressable>
                </>
              ) : (
                <Pressable
                  style={styles.dropdownItem}
                  onPress={() => {
                    setMenuVisible(false);
                    toggleJoined(group.id);
                  }}
                >
                  <Ionicons 
                    name={group.joined ? "exit-outline" : "enter-outline"} 
                    size={20} 
                    color={group.joined ? colors.error : colors.ink} 
                  />
                  <CXText variant="body" color={group.joined ? colors.error : colors.ink}>
                    {group.joined ? "Leave Group" : "Join Group"}
                  </CXText>
                </Pressable>
              )}
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
      <CXCard style={styles.groupHero}>
        <GroupIcon icon={group.icon} color={group.color} size={76} />
        <View style={styles.flex}>
          <CXText variant="h3">{group.name}</CXText>
          <CXText variant="caption" color={colors.primary}>
            {group.members} members · 12 online
          </CXText>
        </View>
      </CXCard>
      <View style={{ marginTop: spacing.md, marginBottom: spacing.md }}>
        <CXSectionHeader title="Overview" />
        <CXCard>
          <CXText variant="body" color={colors.ink}>
            {group.description || group.subtitle}
          </CXText>
        </CXCard>
      </View>
      {!hasAccess ? (
        <CXButton 
          label="Join Group" 
          onPress={() => toggleJoined(group.id)} 
        />
      ) : (
        <>
          <CXRow style={styles.groupActions}>
            <CXButton
              label="Join Chat"
              iconLeft="chatbubble-outline"
              onPress={() =>
                navigation.reset({
                  index: 1,
                  routes: [
                    { name: "Main", params: { screen: "Chats" } },
                    { 
                      name: "Conversation", 
                      params: { conversationId: group.id, name: group.name } 
                    }
                  ]
                })
              }
            />
            <CXButton
              label="Invite"
              iconLeft="person-add-outline"
              variant="outline"
              onPress={() =>
                navigation.navigate("InviteToGroup", { groupId: group.id })
              }
            />
            <CXButton
              label="Share"
              iconLeft="share-social-outline"
              variant="outline"
              onPress={() => {
                Share.share({
                  message: `Check out the ${group.name} study group on CampusX!`,
                });
              }}
            />
          </CXRow>
        </>
      )}
    </CXScrollScreen>
  );
}

export function GroupMembersScreen({
  navigation,
  route,
}: StackProps<"GroupMembers">) {
  const [query, setQuery] = useState("");
  const friends = useAppStore(state => state.friends);
  const filtered = useMemo(
    () =>
      friends.filter((user) =>
        user.name.toLowerCase().includes(query.toLowerCase()),
      ),
    [query, friends],
  );
  return (
    <CXScreen>
      <CXHeader
        title="Group Members"
        subtitle="482 members"
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
        <CXRow style={styles.filters}>
          <CXChip label="All" active />
          <CXChip label="Admins" />
          <CXChip label="Moderators" />
          <CXChip label="Online" />
        </CXRow>
        <CXSectionHeader title="Admins" action="Manage" />
        {filtered.slice(0, 2).map((user) => (
          <CXUserRow
            key={user.id}
            user={user}
            action=""
            onPress={() =>
              navigation.navigate("UserProfile", { userId: user.id })
            }
          />
        ))}
        <CXSectionHeader title="Moderators" />
        {filtered.slice(2, 4).map((user) => (
          <CXUserRow key={user.id} user={user} action="" />
        ))}
        <CXSectionHeader title="Online Members" />
        {filtered.slice(4).map((user) => (
          <CXUserRow
            key={user.id}
            user={{ ...user, online: true }}
            action="Message"
            onAction={() =>
              navigation.navigate("Conversation", {
                conversationId: `conversation-${user.id}`,
                name: user.name,
              })
            }
          />
        ))}
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
  const friends = useAppStore((state) => state.friends);
  const initial = [
    {
      id: "poll1",
      question: "Best time for the next SQL revision session?",
      options: [
        { label: "Fri · 4 PM", votes: 18 },
        { label: "Sat · 10 AM", votes: 31 },
        { label: "Sun · 3 PM", votes: 12 },
      ],
    },
    {
      id: "poll2",
      question: "Which topic should we revise next?",
      options: [
        { label: "Normalization", votes: 21 },
        { label: "Transactions", votes: 17 },
        { label: "Indexing", votes: 10 },
      ],
    },
  ];
  const [selected, setSelected] = useState<Record<string, number>>({});
  const vote = (pollId: string, option: number) => {
    setSelected((value) => ({ ...value, [pollId]: option }));
    void api
      .post(`/groups/${route.params.groupId}/polls/${pollId}/vote`, { option })
      .catch(() =>
        setSelected((value) => {
          const next = { ...value };
          delete next[pollId];
          return next;
        }),
      );
  };
  return (
    <CXScreen>
      <CXHeader
        title="Group Polls"
        subtitle="DBMS Study Circle"
        onBack={navigation.goBack}
        right={<CXIconButton icon="add" label="Create poll" />}
      />
      <ScrollView contentContainerStyle={styles.page}>
        <CXRow style={styles.filters}>
          <CXChip label="All" active />
          <CXChip label="Active" />
          <CXChip label="Closed" />
          <CXChip label="My Polls" />
        </CXRow>
        {initial.map((poll) => {
          const total =
            poll.options.reduce((sum, option) => sum + option.votes, 0) +
            (selected[poll.id] !== undefined ? 1 : 0);
          return (
            <CXCard key={poll.id} style={styles.poll}>
              <CXRow>
                <CXAvatar
                  source={friends[0]?.avatar || ""}
                  name={friends[0]?.name || "Friend"}
                  size={36}
                />
                <View style={styles.flex}>
                  <CXText variant="smallStrong">{friends[0]?.name || "Friend"}</CXText>
                  <CXText variant="caption" color={colors.textMuted}>
                    2 hours ago
                  </CXText>
                </View>
                <Ionicons
                  name="ellipsis-horizontal"
                  size={18}
                  color={colors.textMuted}
                />
              </CXRow>
              <CXText variant="title">{poll.question}</CXText>
              {poll.options.map((option, index) => {
                const count =
                  option.votes + (selected[poll.id] === index ? 1 : 0);
                const percent = Math.round((count / total) * 100);
                return (
                  <Pressable
                    key={option.label}
                    onPress={() => vote(poll.id, index)}
                    style={[
                      styles.pollOption,
                      selected[poll.id] === index && styles.pollSelected,
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
                      <View
                        style={[styles.pollFill, { width: `${percent}%` }]}
                      />
                    </View>
                  </Pressable>
                );
              })}
              <CXText variant="caption" color={colors.textMuted}>
                {total} votes · Ends in 2 days
              </CXText>
            </CXCard>
          );
        })}
        <CXButton
          label="Create New Poll"
          iconLeft="add"
          onPress={() => undefined}
        />
      </ScrollView>
    </CXScreen>
  );
}

export function GroupFilesScreen({ navigation }: StackProps<"GroupFiles">) {
  const files = [
    ["Normalization.pdf", "PDF · 2.4 MB", "document-text-outline"],
    ["ER Model Notes.docx", "DOCX · 1.8 MB", "document-outline"],
    ["DBMS Architecture.pdf", "PDF · 3.2 MB", "reader-outline"],
  ] as const;
  return (
    <CXScreen>
      <CXHeader
        title="Files & Notes"
        subtitle="Shared study resources"
        onBack={navigation.goBack}
        right={<CXIconButton icon="cloud-upload-outline" label="Upload file" />}
      />
      <ScrollView contentContainerStyle={styles.page}>
        <CXSearchBar placeholder="Search files, notes, folders..." />
        <CXRow style={styles.filters}>
          <CXChip label="Files" active />
          <CXChip label="Notes" />
          <CXChip label="Links" />
          <CXChip label="Saved" />
        </CXRow>
        <CXSectionHeader title="Recently Added" action="See all" />
        {files.map(([title, subtitle, icon]) => (
          <CXCard key={title} style={styles.fileRow}>
            <View style={styles.fileIcon}>
              <Ionicons name={icon} size={22} color={colors.primary} />
            </View>
            <View style={styles.flex}>
              <CXText variant="smallStrong">{title}</CXText>
              <CXText variant="caption" color={colors.textMuted}>
                {subtitle} · Rohit Sharma
              </CXText>
            </View>
            <CXIconButton
              icon="ellipsis-vertical"
              label="File options"
              size={34}
              backgroundColor={colors.transparent}
            />
          </CXCard>
        ))}
        <CXSectionHeader title="Folders" action="See all" />
        <CXRow style={styles.folders}>
          {["Unit 1", "Unit 2", "Unit 3", "Previous Papers"].map((folder) => (
            <CXCard key={folder} style={styles.folder}>
              <Ionicons name="folder" size={28} color={colors.primary} />
              <CXText variant="smallStrong">{folder}</CXText>
              <CXText variant="caption" color={colors.textMuted}>
                12 files
              </CXText>
            </CXCard>
          ))}
        </CXRow>
        <CXSectionHeader title="Top Notes" />
        {files.slice(0, 2).map(([title]) => (
          <CXCard key={title} style={styles.note}>
            <CXText variant="bodyStrong">{title.replace(".pdf", "")}</CXText>
            <CXText variant="small" color={colors.textMuted}>
              Compact revision notes with examples, diagrams, and important
              questions.
            </CXText>
            <CXRow>
              <CXChip label="DBMS" active />
              <CXChip label="Unit 3" />
            </CXRow>
          </CXCard>
        ))}
      </ScrollView>
    </CXScreen>
  );
}

function SessionCard() {
  return (
    <CXCard style={styles.session}>
      <View style={styles.sessionIcon}>
        <Ionicons name="code-slash-outline" size={24} color={colors.primary} />
      </View>
      <View style={styles.flex}>
        <CXText variant="bodyStrong">Dynamic Programming Deep Dive</CXText>
        <CXText variant="caption" color={colors.textMuted}>
          Thu, 22 May 2025 · 5:00–6:30 PM
        </CXText>
        <CXRow style={styles.sessionMeta}>
          <CXChip label="Google Meet" icon="videocam-outline" />
          <CXText variant="caption" color={colors.textMuted}>
            28 going
          </CXText>
        </CXRow>
      </View>
      <CXButton label="Join" size="sm" fullWidth={false} />
    </CXCard>
  );
}
export function StudySessionsScreen({
  navigation,
}: StackProps<"StudySessions">) {
  return (
    <CXScreen>
      <CXHeader
        title="Study Sessions"
        subtitle="Join and plan group study"
        onBack={navigation.goBack}
        right={<CXIconButton icon="calendar-outline" label="Calendar" />}
      />
      <ScrollView contentContainerStyle={styles.page}>
        <CXRow style={styles.filters}>
          <CXChip label="Upcoming" active />
          <CXChip label="Ongoing" />
          <CXChip label="Completed" />
        </CXRow>
        <CXSectionHeader title="Featured Session" action="See all" />
        <SessionCard />
        <CXSectionHeader title="Upcoming Sessions" />
        {[
          "SQL Quick Quiz",
          "AI Problem Solving Practice",
          "OS Revision Sprint",
        ].map((title) => (
          <CXCard key={title} style={styles.session}>
            <View style={styles.sessionIcon}>
              <Ionicons
                name="school-outline"
                size={23}
                color={colors.primary}
              />
            </View>
            <View style={styles.flex}>
              <CXText variant="bodyStrong">{title}</CXText>
              <CXText variant="caption" color={colors.textMuted}>
                25 May · 4:00 PM · Online
              </CXText>
            </View>
            <CXButton
              label="Remind Me"
              size="sm"
              variant="outline"
              fullWidth={false}
            />
          </CXCard>
        ))}
        <CXButton
          label="Create Session"
          iconLeft="add"
          onPress={() => undefined}
        />
      </ScrollView>
    </CXScreen>
  );
}

export function InviteToGroupScreen({
  navigation,
  route,
}: StackProps<"InviteToGroup">) {
  const allGroups = useAppStore(state => state.studyGroups);
  const group = allGroups.find(g => g.id === route.params.groupId);

  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("All Friends");

  const toggle = (id: string) =>
    setSelected((items) =>
      items.includes(id) ? items.filter((item) => item !== id) : [...items, id],
    );
    
  const send = () => {
    // Simulate sending invites
    Alert.alert("Success", "Invites sent successfully!", [
      { text: "OK", onPress: () => navigation.goBack() }
    ]);
  };

  let displayPeople = friends;
  
  if (query.trim()) {
    displayPeople = displayPeople.filter(p => 
      p.name.toLowerCase().includes(query.toLowerCase()) || 
      p.department.toLowerCase().includes(query.toLowerCase())
    );
  } else {
    if (activeFilter === "Recent") {
      displayPeople = displayPeople.slice(0, 3);
    }
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
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.selected}
        >
          {selected.map((id) => {
            const user = friends.find((item) => item.id === id)!;
            return (
              <Pressable
                key={id}
                onPress={() => toggle(id)}
                style={styles.selectedPerson}
              >
                <CXAvatar source={user.avatar} name={user.name} size={42} />
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
        <CXRow style={styles.filters}>
          <CXChip label="All Friends" active={activeFilter === "All Friends"} onPress={() => setActiveFilter("All Friends")} />
          <CXChip label="Recent" active={activeFilter === "Recent"} onPress={() => setActiveFilter("Recent")} />
        </CXRow>
        {displayPeople.map((user) => (
          <Pressable key={user.id} onPress={() => toggle(user.id)}>
            <CXRow style={styles.inviteRow}>
              <CXAvatar source={user.avatar} name={user.name} />
              <View style={styles.flex}>
                <CXText variant="bodyStrong">{user.name}</CXText>
                <CXText variant="caption" color={colors.textMuted}>
                  {user.department} · {user.year}
                </CXText>
              </View>
              <View
                style={[
                  styles.checkbox,
                  selected.includes(user.id) && styles.checkboxActive,
                ]}
              >
                {selected.includes(user.id) ? (
                  <Ionicons name="checkmark" size={15} color={colors.white} />
                ) : null}
              </View>
            </CXRow>
          </Pressable>
        ))}
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
    </CXScreen>
  );
}

export function GroupPostsScreen({ navigation, route }: StackProps<"GroupPosts">) {
  return (
    <CXScreen>
      <CXHeader title="Group Posts" onBack={navigation.goBack} />
      <ScrollView contentContainerStyle={styles.page}>
        <CXCard>
          <CXText variant="bodyStrong">No posts yet</CXText>
          <CXText variant="caption" color={colors.textMuted}>
            Be the first to start a discussion in this group!
          </CXText>
        </CXCard>
      </ScrollView>
    </CXScreen>
  );
}

export function CreateGroupScreen({ navigation }: StackProps<"CreateGroup">) {
  const [name, setName] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [description, setDescription] = useState("");
  const addStudyGroup = useAppStore(state => state.addStudyGroup);
  const user = useAppStore(state => state.user);

  const handleCreate = () => {
    if (!name.trim()) return;

    const newGroup = {
      id: "group-" + Date.now(),
      name: name.trim(),
      subtitle: subtitle.trim() || "A new study group",
      description: description.trim(),
      members: 1,
      icon: "school-outline",
      color: "#F59E0B", // Default color
      joined: true,
      creatorId: user?.id ?? "guest",
    };

    addStudyGroup(newGroup);
    navigation.goBack();
  };

  return (
    <CXScreen>
      <CXHeader
        title="Create Group"
        subtitle="Start a new study circle"
        onBack={navigation.goBack}
      />
      <ScrollView contentContainerStyle={styles.page}>
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
            label="Create Group"
            onPress={handleCreate}
            disabled={!name.trim()}
          />
        </CXCard>
      </ScrollView>
    </CXScreen>
  );
}

export function EditGroupScreen({ navigation, route }: StackProps<"EditGroup">) {
  const allGroups = useAppStore(state => state.studyGroups);
  const group = allGroups.find((item) => item.id === route.params.groupId);
  const updateStudyGroup = useAppStore(state => state.updateStudyGroup);

  const [name, setName] = useState(group?.name ?? "");
  const [subtitle, setSubtitle] = useState(group?.subtitle ?? "");
  const [description, setDescription] = useState(group?.description ?? "");

  const handleUpdate = () => {
    if (!name.trim() || !group) return;
    updateStudyGroup(group.id, {
      name: name.trim(),
      subtitle: subtitle.trim(),
      description: description.trim(),
    });
    navigation.goBack();
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
    </CXScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  page: {
    paddingHorizontal: spacing.screen,
    paddingBottom: 100,
    gap: spacing.md,
  },
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
    minHeight: 78,
    paddingHorizontal: spacing.screen,
    paddingBottom: spacing.lg,
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
