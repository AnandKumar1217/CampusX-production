import { Ionicons } from "@expo/vector-icons";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, gradients, shadows, spacing } from "@/theme";

import { CXText } from "../ui";

const tabMeta = {
  Home: { label: "Home", icon: "home-outline", active: "home" },
  Discover: { label: "Discover", icon: "compass-outline", active: "compass" },
  CreateHub: { label: "Create", icon: "add", active: "add" },
  Chats: { label: "Chats", icon: "chatbubbles-outline", active: "chatbubbles" },
  Profile: { label: "Profile", icon: "person-outline", active: "person" },
} as const;

export function CXBottomNav({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.shell, { paddingBottom: Math.max(insets.bottom, 6) }]}>
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const meta =
          tabMeta[route.name as keyof typeof tabMeta] ?? tabMeta.Home;
        const onPress = () => {
          const event = navigation.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented)
            navigation.navigate(route.name, route.params);
        };
        if (route.name === "CreateHub") {
          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityLabel="Create"
              onPress={onPress}
              style={styles.tab}
            >
              <LinearGradient
                colors={gradients.primaryStrong}
                style={styles.createButton}
              >
                <Ionicons name="add" size={28} color={colors.white} />
              </LinearGradient>
              <CXText
                variant="caption"
                color={focused ? colors.primary : colors.textMuted}
              >
                Create
              </CXText>
            </Pressable>
          );
        }
        return (
          <Pressable
            key={route.key}
            accessibilityRole="button"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={
              descriptors[route.key]?.options.tabBarAccessibilityLabel ??
              meta.label
            }
            onPress={onPress}
            style={styles.tab}
          >
            <Ionicons
              name={focused ? meta.active : meta.icon}
              size={21}
              color={focused ? colors.primary : colors.textMuted}
            />
            <CXText
              variant="caption"
              color={focused ? colors.primary : colors.textMuted}
            >
              {meta.label}
            </CXText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    minHeight: 66,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-around",
    paddingTop: 8,
    paddingHorizontal: spacing.xs,
    backgroundColor: colors.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    ...shadows.floating,
  },
  tab: {
    flex: 1,
    minHeight: 50,
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 2,
  },
  createButton: {
    width: 50,
    height: 50,
    marginTop: -24,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 4,
    borderColor: colors.background,
    ...shadows.floating,
  },
});
