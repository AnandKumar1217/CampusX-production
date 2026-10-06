import React from "react";
import { ScrollView, StyleSheet, View, Linking, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import {
  CXCard,
  CXScreen,
  CXText,
  CXHeader,
} from "@/components/ui";
import { colors, spacing } from "@/theme";

export function HelpSupportScreen({ navigation }: any) {
  const handleEmailPress = () => {
    Linking.openURL("mailto:campusx.teamotp@gmail.com").catch(() => {
      // Fallback if email client can't be opened
    });
  };

  return (
    <CXScreen>
      <CXHeader title="Help & Support" onBack={navigation.goBack} />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Ionicons name="help-buoy-outline" size={64} color={colors.primary} />
          <CXText variant="h2" style={styles.title}>
            How can we help you?
          </CXText>
          <CXText variant="body" color={colors.textMuted} style={styles.subtitle}>
            If you're experiencing issues, have feedback, or need assistance, we're here to help!
          </CXText>
        </View>

        <CXCard style={styles.card}>
          <CXText variant="h3" style={styles.cardTitle}>
            Contact Us
          </CXText>
          <CXText variant="body" style={styles.paragraph}>
            For any queries, bug reports, or feature requests, please reach out to our support team via email. We usually respond within 24-48 hours.
          </CXText>

          <TouchableOpacity style={styles.emailContainer} onPress={handleEmailPress} activeOpacity={0.7}>
            <Ionicons name="mail-outline" size={24} color={colors.primary} />
            <View style={styles.emailTextContainer}>
              <CXText variant="bodyStrong" color={colors.primary}>
                Email Support
              </CXText>
              <CXText variant="small" color={colors.primaryLight}>
                campusx.teamotp@gmail.com
              </CXText>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.primary} />
          </TouchableOpacity>
        </CXCard>
      </ScrollView>
    </CXScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
    gap: spacing.lg,
  },
  header: {
    alignItems: "center",
    marginVertical: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  title: {
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    textAlign: "center",
  },
  subtitle: {
    textAlign: "center",
    lineHeight: 22,
  },
  card: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  cardTitle: {
    color: colors.ink,
  },
  paragraph: {
    lineHeight: 24,
    color: colors.inkSoft,
    marginBottom: spacing.sm,
  },
  emailContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primaryTint,
    padding: spacing.md,
    borderRadius: spacing.sm,
    gap: spacing.md,
  },
  emailTextContainer: {
    flex: 1,
  },
});

