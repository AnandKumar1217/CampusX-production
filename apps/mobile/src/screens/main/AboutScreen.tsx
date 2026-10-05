import React from "react";
import { ScrollView, StyleSheet, View, Image } from "react-native";

import {
  CXCard,
  CXScreen,
  CXText,
  CXHeader,
} from "@/components/ui";
import { colors, spacing } from "@/theme";

export function AboutScreen({ navigation }: any) {
  return (
    <CXScreen>
      <CXHeader title="About CampusX" onBack={navigation.goBack} />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <CXText variant="h1" style={styles.title}>
            CampusX
          </CXText>
          <CXText variant="body" color={colors.textMuted} style={styles.version}>
            Version 1.0.0
          </CXText>
        </View>

        <CXCard style={styles.card}>
          <CXText variant="body" style={styles.paragraph}>
            CampusX is your ultimate campus companion app. Designed to connect students, manage events, and foster a vibrant community.
          </CXText>
          <CXText variant="body" style={styles.paragraph}>
            Whether you want to discover exciting events, join student groups, or stay updated with campus announcements, CampusX brings the entire campus right to your fingertips.
          </CXText>
        </CXCard>

        <View style={styles.footer}>
          <CXText variant="small" color={colors.textFaint}>
            Built with ❤️ for students
          </CXText>
          <CXText variant="small" color={colors.textFaint} style={{ marginTop: spacing.xs }}>
            © {new Date().getFullYear()} CampusX Inc. All rights reserved.
          </CXText>
        </View>
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
    marginVertical: spacing.xl,
  },
  title: {
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  version: {
    fontWeight: "600",
  },
  card: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  paragraph: {
    lineHeight: 24,
    color: colors.inkSoft,
  },
  footer: {
    alignItems: "center",
    marginTop: spacing.xl,
    paddingBottom: spacing.xxl,
  },
});
