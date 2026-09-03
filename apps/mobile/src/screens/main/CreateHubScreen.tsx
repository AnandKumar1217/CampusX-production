import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { CXCard, CXIconButton, CXRow, CXScreen, CXText } from "@/components/ui";
import { useRootNavigation } from "@/hooks/useRootNavigation";
import { colors, gradients, radius, spacing } from "@/theme";

const actions = [
  [
    "Create Post",
    "Share updates, ideas, and moments",
    "create-outline",
    "CreatePost",
    "#6D4AF6",
  ],
  [
    "Create Story",
    "Share moments that disappear in 24h",
    "camera-outline",
    "CreateStory",
    "#EC4899",
  ],
  [
    "Create Group",
    "Build a community around your goals",
    "people-outline",
    "CreateGroup",
    "#3B82F6",
  ],
  [
    "Create Event",
    "Plan and invite people to an event",
    "calendar-outline",
    "EditEvent",
    "#F59E0B",
  ],
  [
    "Create Trip",
    "Plan a trip together with friends",
    "map-outline",
    "CreateTrip",
    "#22C55E",
  ],
  [
    "Sell Item",
    "List books, gadgets, or furniture",
    "storefront-outline",
    "CreateListing",
    "#F97316",
  ],
  [
    "Ask CampusAI",
    "Get instant help for your studies",
    "sparkles-outline",
    "AIChat",
    "#111827",
  ],
] as const;

export function CreateHubScreen() {
  const navigation = useRootNavigation();
  return (
    <CXScreen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <CXRow style={styles.header}>
          <View style={styles.flex}>
            <CXText variant="h2">Create</CXText>
            <CXText variant="caption" color={colors.textMuted}>
              Start something on CampusX
            </CXText>
          </View>
          <CXIconButton
            icon="notifications-outline"
            label="Notifications"
            backgroundColor={colors.white}
            onPress={() => navigation.navigate("Notifications")}
          />
        </CXRow>
        <LinearGradient colors={["#F6F1FF", "#FFFFFF"]} style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name="add" size={32} color={colors.white} />
          </View>
          <View style={styles.flex}>
            <CXText variant="h3">What do you want to create?</CXText>
            <CXText color={colors.textMuted}>
              Choose an option below and bring your campus idea to life.
            </CXText>
          </View>
        </LinearGradient>
        <View style={styles.list}>
          {actions.map(([title, subtitle, icon, route, color]) => (
            <Pressable
              key={title}
              style={({ pressed }) => [pressed && styles.pressed]}
              onPress={() => navigation.navigate(route as never)}
            >
              <CXCard style={styles.actionRow}>
                <View style={[styles.heroIcon, { backgroundColor: color }]}>
                  <Ionicons name={icon} size={26} color={colors.white} />
                </View>
                <View style={styles.flex}>
                  <CXText variant="bodyStrong">{title}</CXText>
                  <CXText variant="caption" color={colors.textMuted}>
                    {subtitle}
                  </CXText>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textFaint} />
              </CXCard>
            </Pressable>
          ))}
        </View>
        <LinearGradient colors={gradients.soft} style={styles.idea}>
          <Ionicons name="bulb-outline" size={24} color={colors.primary} />
          <View style={styles.flex}>
            <CXText variant="bodyStrong">Need ideas?</CXText>
            <CXText variant="caption" color={colors.textMuted}>
              Let CampusAI help you create something interesting.
            </CXText>
          </View>
          <Pressable onPress={() => navigation.navigate("AIChat")}>
            <CXText variant="smallStrong" color={colors.primary}>
              Ask now
            </CXText>
          </Pressable>
        </LinearGradient>
      </ScrollView>
    </CXScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    paddingHorizontal: spacing.screen,
    paddingBottom: spacing.xxxl,
    gap: spacing.md,
  },
  header: { minHeight: 58 },
  hero: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  list: { 
    flexDirection: "column", 
    gap: spacing.sm 
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    gap: spacing.md,
  },
  icon: {
    width: 48,
    height: 48,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { opacity: 0.75 },
  idea: {
    borderRadius: radius.md,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
});

