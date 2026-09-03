import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Image } from "expo-image";
import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { CXTripCard } from "@/components/cards";
import {
  CXAvatar,
  CXButton,
  CXCard,
  CXChip,
  CXHeader,
  CXIconButton,
  CXInput,
  CXListRow,
  CXRow,
  CXScreen,
  CXScrollScreen,
  CXSearchBar,
  CXSectionHeader,
  CXText,
} from "@/components/ui";

import { api, getApiErrorMessage } from "@/services/api";
import { colors, radius, spacing } from "@/theme";
import type { RootStackParamList } from "@/types/navigation";

type StackProps<Name extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  Name
>;

import type { Trip } from "@/types/domain";
import { useAppStore } from "@/store/appStore";

export function TripsScreen({ navigation }: StackProps<"Trips">) {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    api.get<{ data: Trip[] }>("/trips")
      .then((res) => setTrips(res.data.data))
      .catch((err) => console.log(getApiErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);
  return (
    <CXScreen>
      <CXHeader
        title="Trips"
        subtitle="Plan together. Travel forever."
        right={
          <CXRow>
            <CXIconButton
              icon="notifications-outline"
              label="Trip alerts"
              backgroundColor={colors.transparent}
            />
            <CXIconButton
              icon="ellipsis-horizontal"
              label="Trip options"
              backgroundColor={colors.transparent}
            />
          </CXRow>
        }
      />
      <ScrollView contentContainerStyle={styles.page}>
        <CXSearchBar placeholder="Search trips, destinations, or friends..." />
        <CXRow style={styles.filters}>
          <CXChip label="Upcoming" active />
          <CXChip label="Past" />
          <CXChip label="Drafts" />
        </CXRow>
        {trips.length > 0 && (
          <>
            <CXSectionHeader title="Featured Trip" action="Featured" />
            <CXTripCard
              trip={trips[0]!}
              featured
              onPress={() =>
                navigation.navigate("TripDetails", { tripId: trips[0]!.id })
              }
            />
          </>
        )}
        <CXSectionHeader title="Upcoming Trips" action="See all" />
        {trips.map((trip) => (
          <CXTripCard
            key={trip.id}
            trip={trip}
            onPress={() =>
              navigation.navigate("TripDetails", { tripId: trip.id })
            }
          />
        ))}
        <CXSectionHeader title="Trip Ideas by AI" action="Refresh" />
        <CXRow style={styles.ideas}>
          {[
            ["Weekend Trek", "mountain.jpg"],
            ["Beach Break", "beach.jpg"],
            ["Heritage Tour", "city.jpg"],
          ].map(([label]) => (
            <CXCard key={label} style={styles.idea}>
              <Ionicons name="sparkles" size={22} color={colors.primary} />
              <CXText variant="smallStrong">{label}</CXText>
              <CXText variant="caption" color={colors.textMuted}>
                Budget-friendly student plan
              </CXText>
            </CXCard>
          ))}
        </CXRow>
        <CXButton
          label="Create Trip"
          iconLeft="add"
          onPress={() => navigation.navigate("CreateTrip")}
        />
      </ScrollView>
    </CXScreen>
  );
}

export function TripDetailsScreen({
  navigation,
  route,
}: StackProps<"TripDetails">) {
  const friends = useAppStore(state => state.friends);
  const [trip, setTrip] = useState<Trip | null>(null);

  React.useEffect(() => {
    api.get<{ data: Trip }>(`/trips/${route.params.tripId}`)
      .then((res) => setTrip(res.data.data))
      .catch((err) => console.log(getApiErrorMessage(err)));
  }, [route.params.tripId]);

  if (!trip) return null;
  return (
    <CXScreen edges={[]}>
      <ScrollView contentContainerStyle={styles.detailPage}>
        <View style={styles.tripHero}>
          <Image
            source={trip.image}
            contentFit="cover"
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.heroActions}>
            <CXIconButton
              icon="chevron-back"
              label="Go back"
              backgroundColor="rgba(255,255,255,.9)"
              onPress={navigation.goBack}
            />
            <View style={styles.flex} />
            <CXIconButton
              icon="share-social-outline"
              label="Share trip"
              backgroundColor="rgba(255,255,255,.9)"
            />
          </View>
        </View>
        <View style={styles.detailContent}>
          <CXRow>
            <CXText variant="h2" style={styles.flex}>
              {trip.title}
            </CXText>
            <CXChip label="Upcoming" active />
          </CXRow>
          <CXText variant="small" color={colors.textMuted}>
            {trip.startDate} – {trip.endDate} · {trip.destination}
          </CXText>
          <CXRow style={styles.tripMembers}>
            {trip.members.slice(0, 6).map((user, index) => (
              <View key={user.id} style={{ marginLeft: index ? -8 : 0 }}>
                <CXAvatar source={user.avatarUrl} name={user.name} size={34} />
              </View>
            ))}
            <CXText variant="caption" color={colors.textMuted}>
              +2 members
            </CXText>
          </CXRow>
          <CXCard style={styles.organizer}>
            <CXAvatar source={friends[0]?.avatar} name={friends[0]?.name} />
            <View style={styles.flex}>
              <CXText variant="caption" color={colors.textMuted}>
                Trip organized by
              </CXText>
              <CXText variant="bodyStrong">{friends[0]?.name}</CXText>
            </View>
            <CXButton
              label="Message"
              size="sm"
              variant="outline"
              fullWidth={false}
            />
          </CXCard>
          <CXRow style={styles.tripStats}>
            {[
              ["₹7,500", "Total budget", "wallet-outline"],
              ["₹2,450", "Your share", "card-outline"],
              ["₹2,100", "Settled", "checkmark-circle-outline"],
            ].map(([value, label, icon]) => (
              <CXCard key={label} style={styles.tripStat}>
                <Ionicons
                  name={icon as keyof typeof Ionicons.glyphMap}
                  size={20}
                  color={colors.primary}
                />
                <CXText variant="bodyStrong">{value}</CXText>
                <CXText variant="caption" color={colors.textMuted}>
                  {label}
                </CXText>
              </CXCard>
            ))}
          </CXRow>
          <CXSectionHeader
            title="Itinerary Preview"
            action="View full itinerary"
            onAction={() =>
              navigation.navigate("TripItinerary", { tripId: trip.id })
            }
          />
          {[
            ["Day 1", "Arrive, check-in and explore Madikeri"],
            ["Day 2", "Abbey Falls, plantation walk and campfire"],
            ["Day 3", "Raja’s Seat and return to Bengaluru"],
          ].map(([day, label]) => (
            <CXCard key={day} style={styles.itineraryPreview}>
              <View style={styles.dayBadge}>
                <CXText variant="smallStrong" color={colors.white}>
                  {day}
                </CXText>
              </View>
              <CXText style={styles.flex}>{label}</CXText>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={colors.textFaint}
              />
            </CXCard>
          ))}
          <CXSectionHeader title="Trip Progress" />
          <CXListRow
            icon="people-outline"
            title="Invitations"
            subtitle="6 accepted · 2 pending"
            onPress={() =>
              navigation.navigate("InviteToTrip", { tripId: trip.id })
            }
          />
          <CXListRow
            icon="checkbox-outline"
            title="Trip Voting"
            subtitle="Choose dates and activities"
            onPress={() =>
              navigation.navigate("TripVoting", { tripId: trip.id })
            }
          />
          <CXListRow
            icon="cash-outline"
            title="Expenses & Settlement"
            subtitle="Track and settle shared expenses"
            onPress={() =>
              navigation.navigate("TripExpenses", { tripId: trip.id })
            }
          />
          <CXRow style={styles.detailButtons}>
            <CXButton
              label="Open Chat"
              variant="outline"
              iconLeft="chatbubble-outline"
            />
            <CXButton label="Manage Trip" iconLeft="settings-outline" />
          </CXRow>
        </View>
      </ScrollView>
    </CXScreen>
  );
}

export function CreateTripScreen({ navigation }: StackProps<"CreateTrip">) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    destination: "",
    dates: "",
    friends: "7 selected",
    budget: "7500",
    transport: "Train from Bengaluru",
    stay: "Homestay",
    interests: "Adventure, Nature, Photography, Food",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const save = async (draft = false) => {
    if (!draft && !form.destination.trim()) {
      setError("Destination is required");
      return;
    }
    setSaving(true);
    try {
      await api.post("/trips", { ...form, budget: Number(form.budget), draft });
      navigation.goBack();
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    } finally {
      setSaving(false);
    }
  };
  return (
    <CXScrollScreen>
      <CXHeader
        title="Create Trip"
        onBack={navigation.goBack}
        right={
          <CXIconButton
            icon="close"
            label="Close"
            backgroundColor={colors.transparent}
            onPress={navigation.goBack}
          />
        }
      />
      <View style={styles.stepper}>
        {["Details", "Friends", "Plan", "Review", "Confirm"].map(
          (label, index) => (
            <View key={label} style={styles.step}>
              <View
                style={[
                  styles.stepCircle,
                  index + 1 <= step && styles.stepCircleActive,
                ]}
              >
                <CXText
                  variant="caption"
                  color={index + 1 <= step ? colors.white : colors.textMuted}
                >
                  {index + 1}
                </CXText>
              </View>
              <CXText
                variant="caption"
                color={index + 1 === step ? colors.primary : colors.textMuted}
              >
                {label}
              </CXText>
            </View>
          ),
        )}
      </View>
      <CXSectionHeader title="Trip Details" />
      {(
        [
          [
            "Destination",
            "location-outline",
            "Where do you want to go?",
            "destination",
          ],
          ["Dates", "calendar-outline", "23 May 2025 – 25 May 2025", "dates"],
          ["Invite Friends", "people-outline", "Select friends", "friends"],
          ["Budget", "wallet-outline", "Estimated budget per person", "budget"],
          ["Transport", "train-outline", "Select transport", "transport"],
          ["Stay", "bed-outline", "Hotel or homestay", "stay"],
          [
            "Interests",
            "sparkles-outline",
            "Adventure, nature, food...",
            "interests",
          ],
        ] as const
      ).map(([label, icon, placeholder, key]) => (
        <View key={key} style={styles.tripField}>
          <View style={styles.fieldIcon}>
            <Ionicons name={icon} size={20} color={colors.primary} />
          </View>
          <View style={styles.flex}>
            <CXText variant="smallStrong">{label}</CXText>
            <CXInput
              placeholder={placeholder}
              keyboardType={key === "budget" ? "numeric" : "default"}
              value={form[key as keyof typeof form]}
              onChangeText={(value) =>
                setForm((current) => ({ ...current, [key]: value }))
              }
            />
          </View>
        </View>
      ))}
      <CXCard style={styles.aiPlanner}>
        <Ionicons name="sparkles" size={26} color={colors.primary} />
        <View style={styles.flex}>
          <CXText variant="bodyStrong">AI Trip Planner</CXText>
          <CXText variant="caption" color={colors.textMuted}>
            Generate a complete itinerary from your trip details.
          </CXText>
        </View>
        <CXButton
          label="Generate Plan"
          size="sm"
          variant="outline"
          fullWidth={false}
          onPress={() => setStep(3)}
        />
      </CXCard>
      {error ? <CXText color={colors.danger}>{error}</CXText> : null}
      <CXButton
        label="Create Trip"
        iconRight="arrow-forward"
        loading={saving}
        onPress={() => void save()}
      />
      <CXButton
        label="Save Draft"
        variant="outline"
        onPress={() => void save(true)}
      />
    </CXScrollScreen>
  );
}

export function InviteToTripScreen({ navigation }: StackProps<"InviteToTrip">) {
  const friends = useAppStore(state => state.friends);
  const [selected, setSelected] = useState<string[]>(
    friends.slice(0, 2).map((user) => user.id),
  );
  const toggle = (id: string) =>
    setSelected((items) =>
      items.includes(id) ? items.filter((item) => item !== id) : [...items, id],
    );
  const send = async () => {
    await api.post(`/trips/${route.params.tripId}/invites`, {
      userIds: selected,
    });
    navigation.goBack();
  };
  return (
    <CXScreen>
      <CXHeader
        title="Invite Friends"
        subtitle="Invite your friends to join the trip"
        onBack={navigation.goBack}
        right={
          <CXIconButton
            icon="person-add-outline"
            label="Invite by link"
            backgroundColor={colors.transparent}
          />
        }
      />
      <ScrollView contentContainerStyle={styles.page}>
        <CXSearchBar placeholder="Search friends by name, department..." />
        <CXSectionHeader title="Selected" action="Clear all" />
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
                style={styles.selectedPerson}
                onPress={() => toggle(id)}
              >
                <CXAvatar source={user.avatarUrl} name={user.name} size={42} />
                <View style={styles.remove}>
                  <Ionicons name="close" size={11} color={colors.white} />
                </View>
                <CXText variant="caption">{user.name.split(" ")[0]}</CXText>
              </Pressable>
            );
          })}
        </ScrollView>
        <CXRow style={styles.filters}>
          <CXChip label="All Friends" active />
          <CXChip label="Recent" />
          <CXChip label="Classmates" />
          <CXChip label="Suggested" />
        </CXRow>
        {friends.map((user) => (
          <Pressable key={user.id} onPress={() => toggle(user.id)}>
            <CXRow style={styles.personRow}>
              <CXAvatar source={user.avatarUrl} name={user.name} />
              <View style={styles.flex}>
                <CXText variant="bodyStrong">{user.name}</CXText>
                <CXText variant="caption" color={colors.textMuted}>
                  {user.department} · {user.department}
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
      <View style={styles.footer}>
        <CXText variant="small" color={colors.textMuted}>
          {selected.length} selected
        </CXText>
        <CXButton
          label="Send Invites"
          iconLeft="paper-plane-outline"
          fullWidth={false}
          onPress={() => void send()}
        />
      </View>
    </CXScreen>
  );
}

export function TripItineraryScreen({
  navigation,
  route,
}: StackProps<"TripItinerary">) {
  const activities = [
    ["08:00", "Breakfast at Riverside Café", "cafe-outline"],
    ["09:30", "Travel to Abbey Falls", "car-outline"],
    ["11:00", "Abbey Falls Sightseeing", "water-outline"],
    ["13:00", "Lunch at Coorg Cuisine", "restaurant-outline"],
    ["15:00", "Raja’s Seat View Point", "camera-outline"],
    ["17:30", "Check-in at Coorg Valley Resort", "bed-outline"],
    ["20:00", "Bonfire & Leisure", "flame-outline"],
  ];
  return (
    <CXScreen>
      <CXHeader
        title="Coorg Weekend Escape"
        subtitle="23–25 May · 8 members"
        onBack={navigation.goBack}
        right={
          <CXRow>
            <CXIconButton
              icon="share-social-outline"
              label="Share itinerary"
              backgroundColor={colors.transparent}
            />
            <CXIconButton
              icon="ellipsis-horizontal"
              label="More"
              backgroundColor={colors.transparent}
            />
          </CXRow>
        }
      />
      <ScrollView contentContainerStyle={styles.page}>
        <CXRow style={styles.dayTabs}>
          {["Day 1\n23 May", "Day 2\n24 May", "Day 3\n25 May"].map(
            (item, index) => (
              <Pressable
                key={item}
                style={[styles.dayTab, index === 0 && styles.dayTabActive]}
              >
                <CXText
                  variant="smallStrong"
                  color={index === 0 ? colors.white : colors.ink}
                  align="center"
                >
                  {item}
                </CXText>
              </Pressable>
            ),
          )}
        </CXRow>
        {activities.map(([time, title, icon], index) => (
          <CXRow key={time} style={styles.activity}>
            <View style={styles.time}>
              <CXText variant="smallStrong">{time}</CXText>
            </View>
            <View style={styles.activityLine}>
              <View style={styles.activityDot} />
              {index < activities.length - 1 ? (
                <View style={styles.line} />
              ) : null}
            </View>
            <CXCard style={styles.activityCard}>
              <View style={styles.activityIcon}>
                <Ionicons
                  name={icon as keyof typeof Ionicons.glyphMap}
                  size={20}
                  color={colors.primary}
                />
              </View>
              <View style={styles.flex}>
                <CXText variant="bodyStrong">{title}</CXText>
                <CXText variant="caption" color={colors.textMuted}>
                  Madikeri, Coorg · 1.5 hours
                </CXText>
              </View>
              <Ionicons
                name="location-outline"
                size={18}
                color={colors.primary}
              />
            </CXCard>
          </CXRow>
        ))}
        <CXCard style={styles.notes}>
          <Ionicons
            name="document-text-outline"
            size={22}
            color={colors.primary}
          />
          <View style={styles.flex}>
            <CXText variant="bodyStrong">Trip Notes</CXText>
            <CXText variant="caption" color={colors.textMuted}>
              Carry raincoats, comfortable shoes, ID cards, and a power bank.
            </CXText>
          </View>
          <CXButton
            label="Share Itinerary"
            size="sm"
            variant="outline"
            fullWidth={false}
          />
        </CXCard>
        <CXButton
          label="Open Map"
          iconLeft="map-outline"
          iconRight="arrow-forward"
          onPress={() => navigation.navigate("CampusMap")}
        />
      </ScrollView>
    </CXScreen>
  );
}

export function TripVotingScreen({
  navigation,
  route,
}: StackProps<"TripVoting">) {
  const options = [
    { label: "Jul 20 – Jul 24", note: "5 Days", votes: 12 },
    { label: "Jul 21 – Jul 25", note: "5 Days", votes: 7 },
    { label: "Jul 22 – Jul 26", note: "5 Days", votes: 4 },
    { label: "Other Dates", note: "Suggest your own dates", votes: 2 },
  ];
  const [selected, setSelected] = useState(0);
  const total = options.reduce((sum, item) => sum + item.votes, 0) + 1;
  const submit = async () => {
    await api.post(`/trips/${route.params.tripId}/votes`, { option: selected });
    navigation.goBack();
  };
  return (
    <CXScrollScreen>
      <CXHeader
        title="Trip Voting"
        subtitle="Manali Trip · Jul 20 – Jul 24"
        onBack={navigation.goBack}
        right={
          <CXIconButton
            icon="ellipsis-horizontal"
            label="Voting options"
            backgroundColor={colors.transparent}
          />
        }
      />
      <CXCard style={styles.voteCard}>
        <CXText variant="h3" color={colors.primary}>
          Which dates work best for you?
        </CXText>
        {options.map((option, index) => {
          const percent = Math.round(
            ((option.votes + (selected === index ? 1 : 0)) / total) * 100,
          );
          return (
            <Pressable
              key={option.label}
              onPress={() => setSelected(index)}
              style={styles.voteOption}
            >
              <View
                style={[styles.radio, selected === index && styles.radioActive]}
              >
                {selected === index ? <View style={styles.radioDot} /> : null}
              </View>
              <View style={styles.flex}>
                <CXRow>
                  <View style={styles.flex}>
                    <CXText variant="bodyStrong">{option.label}</CXText>
                    <CXText variant="caption" color={colors.textMuted}>
                      ({option.note})
                    </CXText>
                  </View>
                  <CXText variant="caption" color={colors.textMuted}>
                    {option.votes} votes
                  </CXText>
                </CXRow>
                <View style={styles.voteTrack}>
                  <View style={[styles.voteFill, { width: `${percent}%` }]} />
                </View>
              </View>
            </Pressable>
          );
        })}
        <CXText variant="caption" color={colors.textMuted}>
          Vote ends in 2d 14h 32m
        </CXText>
      </CXCard>
      <CXButton
        label="Submit Vote"
        iconLeft="checkmark-circle-outline"
        onPress={() => void submit()}
      />
    </CXScrollScreen>
  );
}

type Expense = {
  id: string;
  user: string;
  paid: string;
  amount: number;
  owes: number;
};
export function TripExpensesScreen({
  navigation,
  route,
}: StackProps<"TripExpenses">) {
  const expenses: Expense[] = [
    {
      id: "e1",
      user: "Rohit Verma",
      paid: "Paid for Hotel",
      amount: 4500,
      owes: -750,
    },
    {
      id: "e2",
      user: "Ananya Iyer",
      paid: "Paid for Fuel",
      amount: 2300,
      owes: -850,
    },
    {
      id: "e3",
      user: "Vikram Singh",
      paid: "Paid for Food",
      amount: 3250,
      owes: 542,
    },
    {
      id: "e4",
      user: "Neha Kapoor",
      paid: "Paid for Activities",
      amount: 2600,
      owes: 860,
    },
    {
      id: "e5",
      user: "Arjun Sharma",
      paid: "Paid for Tolls",
      amount: 600,
      owes: 1100,
    },
  ];
  const total = expenses.reduce((sum, item) => sum + item.amount, 0);
  const youOwe = expenses
    .filter((item) => item.owes > 0)
    .reduce((sum, item) => sum + item.owes, 0);
  return (
    <CXScrollScreen>
      <CXHeader
        title="Trip Expenses"
        subtitle="Manali Trip"
        onBack={navigation.goBack}
        right={
          <CXIconButton
            icon="filter-outline"
            label="Filter expenses"
            backgroundColor={colors.transparent}
          />
        }
      />
      <CXCard style={styles.expenseSummary}>
        <View>
          <CXText variant="caption" color={colors.textMuted}>
            Total Expenses
          </CXText>
          <CXText variant="h2">₹{total.toLocaleString("en-IN")}</CXText>
        </View>
        <View>
          <CXText variant="caption" color={colors.textMuted}>
            You Owe
          </CXText>
          <CXText variant="h2" color={colors.danger}>
            ₹{youOwe.toLocaleString("en-IN")}
          </CXText>
        </View>
      </CXCard>
      <CXRow style={styles.filters}>
        <CXChip label="All" active />
        <CXChip label="To Settle" />
        <CXChip label="Settled" />
      </CXRow>
      {expenses.map((expense) => (
        <CXRow key={expense.id} style={styles.expense}>
          <CXAvatar name={expense.user} size={42} />
          <View style={styles.flex}>
            <CXText variant="bodyStrong">{expense.user}</CXText>
            <CXText variant="caption" color={colors.textMuted}>
              {expense.paid} · ₹{expense.amount.toLocaleString("en-IN")}
            </CXText>
          </View>
          <View style={styles.amount}>
            <CXText
              variant="bodyStrong"
              color={expense.owes < 0 ? colors.success : colors.danger}
            >
              {expense.owes < 0 ? "+" : "-"}₹
              {Math.abs(expense.owes).toLocaleString("en-IN")}
            </CXText>
            <CXText variant="caption" color={colors.textMuted}>
              {expense.owes < 0 ? "You owe them" : "They owe you"}
            </CXText>
          </View>
        </CXRow>
      ))}
      <CXButton
        label="Settle Up"
        iconLeft="wallet-outline"
        onPress={() =>
          void api.post(`/trips/${route.params.tripId}/expenses/settle`, {
            amount: youOwe,
          })
        }
      />
    </CXScrollScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  page: {
    paddingHorizontal: spacing.screen,
    paddingBottom: 100,
    gap: spacing.md,
  },
  filters: { gap: spacing.xs },
  ideas: { gap: spacing.xs },
  idea: { flex: 1, gap: spacing.xs, padding: spacing.sm },
  detailPage: { paddingBottom: spacing.xxxl },
  tripHero: { height: 300 },
  heroActions: {
    position: "absolute",
    top: 48,
    left: spacing.md,
    right: spacing.md,
    flexDirection: "row",
    gap: spacing.xs,
  },
  detailContent: { padding: spacing.screen, gap: spacing.md },
  tripMembers: { gap: 0 },
  organizer: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.backgroundLavender,
  },
  tripStats: { gap: spacing.xs },
  tripStat: {
    flex: 1,
    alignItems: "center",
    gap: spacing.xs,
    padding: spacing.sm,
  },
  itineraryPreview: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.sm,
  },
  dayBadge: {
    minWidth: 54,
    minHeight: 34,
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  detailButtons: { gap: spacing.sm },
  stepper: { flexDirection: "row", justifyContent: "space-between" },
  step: { alignItems: "center", gap: 3 },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  stepCircleActive: { backgroundColor: colors.primary },
  tripField: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  fieldIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceLavender,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 22,
  },
  aiPlanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.backgroundLavender,
  },
  selected: { minHeight: 66, gap: spacing.sm },
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
  personRow: { minHeight: 68, gap: spacing.sm },
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
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: 78,
    paddingHorizontal: spacing.screen,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dayTabs: { gap: spacing.xs },
  dayTab: {
    flex: 1,
    minHeight: 56,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dayTabActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  activity: { alignItems: "stretch", gap: spacing.xs },
  time: { width: 48, paddingTop: spacing.sm },
  activityLine: { width: 18, alignItems: "center" },
  activityDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
    marginTop: spacing.md,
  },
  line: { flex: 1, width: 2, backgroundColor: colors.border },
  activityCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.sm,
    marginBottom: spacing.xs,
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceLavender,
    alignItems: "center",
    justifyContent: "center",
  },
  notes: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.backgroundLavender,
  },
  voteCard: { gap: spacing.md, backgroundColor: colors.backgroundLavender },
  voteOption: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "flex-start",
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  radioActive: { borderColor: colors.primary },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  voteTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
    overflow: "hidden",
    marginTop: spacing.xs,
  },
  voteFill: { height: 6, borderRadius: 3, backgroundColor: colors.primary },
  expenseSummary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  expense: { minHeight: 68, gap: spacing.sm },
  amount: { alignItems: "flex-end" },
});


