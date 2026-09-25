import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { CXIconButton, CXRow, CXScreen, CXText } from "@/components/ui";
import { useRootNavigation } from "@/hooks/useRootNavigation";
import { colors, radius, spacing } from "@/theme";

const actions = [
  ["Group", "Build a community", "people", "CreateGroup", "#3B82F6", "#EFF6FF"],
  ["Event", "Plan a gathering", "calendar", "EditEvent", "#F59E0B", "#FFFBEB"],
  ["Trip", "Travel together", "map", "CreateTrip", "#10B981", "#ECFDF5"],
  ["Sell Item", "List your stuff", "storefront", "CreateListing", "#8B5CF6", "#F5F3FF"],
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
            <CXText variant="body" color={colors.textMuted} style={{ marginTop: spacing.xs }}>
              Bring your campus ideas to life.
            </CXText>
          </View>
          <CXIconButton
            icon="notifications-outline"
            label="Notifications"
            backgroundColor={colors.white}
            onPress={() => navigation.navigate("Notifications")}
          />
        </CXRow>

        <View style={styles.grid}>
          {actions.map(([title, subtitle, icon, route, color, bg]) => (
            <Pressable
              key={title}
              style={({ pressed }) => [
                styles.gridItem, 
                pressed && styles.pressed,
              ]}
              onPress={() => navigation.navigate(route as never)}
            >
              <View style={styles.gridCard}>
                <View style={[styles.gridIconContainer, { backgroundColor: bg }]}>
                  <Ionicons name={icon as any} size={28} color={color} />
                </View>
                <CXText variant="bodyStrong" style={{ marginTop: spacing.md, marginBottom: 2 }}>{title}</CXText>
                <CXText variant="caption" color={colors.textMuted} numberOfLines={2}>{subtitle}</CXText>
              </View>
            </Pressable>
          ))}
        </View>

        <Pressable 
          style={({ pressed }) => [pressed && styles.pressed]}
          onPress={() => navigation.navigate("AIChat")}
        >
          <LinearGradient colors={["#111827", "#1F2937"]} style={styles.aiBanner}>
            <View style={styles.aiIcon}>
              <Ionicons name="sparkles" size={24} color="#FFF" />
            </View>
            <View style={styles.flex}>
              <CXText variant="bodyStrong" color="#FFF">Ask CampusAI</CXText>
              <CXText variant="caption" color="#9CA3AF">
                Get instant help for your studies and ideas.
              </CXText>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#4B5563" />
          </LinearGradient>
        </Pressable>

      </ScrollView>
    </CXScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    paddingHorizontal: spacing.screen,
    paddingBottom: spacing.xxxl,
  },
  header: { 
    minHeight: 58,
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  gridItem: {
    width: "48%", // 48% width gives exactly space between for 2 columns
    marginBottom: spacing.md, 
  },
  gridCard: {
    padding: spacing.lg,
    borderRadius: radius.xl,
    alignItems: "flex-start",
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 15,
    elevation: 3,
    height: 140, // fixed height for consistency
  },
  gridIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { opacity: 0.75, transform: [{ scale: 0.98 }] },
  aiBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.lg,
    borderRadius: radius.xl,
    gap: spacing.md,
    marginTop: spacing.xs,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  aiIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
});
