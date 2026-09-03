import { zodResolver } from "@hookform/resolvers/zod";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Controller, useForm } from "react-hook-form";
import { Pressable, ScrollView, StyleSheet, View, LayoutAnimation, UIManager, Platform, TextInput } from "react-native";
import { z } from "zod";

import {
  CXButton,
  CXHeader,
  CXInput,
  CXKeyboardScreen,
  CXRow,
  CXText,
  CXDropdown,
} from "@/components/ui";
import { api, getApiErrorMessage } from "@/services/api";
import { useAppStore } from "@/store/appStore";
import { useSignupStore } from "@/store/signupStore";
import { colors, radius, spacing } from "@/theme";
import type { RootStackParamList } from "@/types/navigation";
import { colleges, departments, years, graduations } from "@/constants/academic";

function StepHeader({
  step,
  title,
  subtitle,
}: {
  step: number;
  title: string;
  subtitle: string;
}) {
  return (
    <View style={styles.stepHeader}>
      <CXRow style={styles.stepTop}>
        <View />
        <CXText variant="smallStrong" color={colors.primary}>
          Step {step} of 3
        </CXText>
      </CXRow>
      <View style={styles.progressTrack}>
        {[1, 2, 3].map((item) => (
          <View
            key={item}
            style={[
              styles.progressSegment,
              item <= step && styles.progressActive,
            ]}
          />
        ))}
      </View>
      <CXText variant="h2">{title}</CXText>
      <CXText color={colors.textMuted}>{subtitle}</CXText>
    </View>
  );
}

const accountSchema = z.object({
  fullName: z.string().min(2, "Enter your full name"),
  email: z.string().min(5, "Enter a valid email or phone number"),
  password: z
    .string()
    .min(8, "Use at least 8 characters")
    .regex(/[A-Za-z]/, "Must contain a letter")
    .regex(/[0-9]/, "Must contain a number"),
});

export function SignupAccountScreen({
  navigation,
}: NativeStackScreenProps<RootStackParamList, "SignupAccount">) {
  const draft = useSignupStore();
  const { control, handleSubmit, setError, formState: { isSubmitting } } = useForm<z.infer<typeof accountSchema>>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      fullName: draft.fullName,
      email: draft.email,
      password: draft.password,
    },
  });
  const submit = handleSubmit(async (values) => {
    try {
      await api.post("/auth/check-identity", { email: values.email });
      draft.patch(values);
      navigation.navigate("SignupProfile");
    } catch (err) {
      setError("email", { message: getApiErrorMessage(err) });
    }
  });
  return (
    <SignupShell>
      <CXHeader title="" onBack={navigation.goBack} />
      <StepHeader
        step={1}
        title="Create your account"
        subtitle="Let’s start with your basic information"
      />
      <View style={styles.heroIcon}>
        <Ionicons name="person-outline" size={38} color={colors.primary} />
      </View>
      <Controller
        control={control}
        name="fullName"
        render={({ field, fieldState }) => (
          <CXInput
            label="Full Name"
            icon="person-outline"
            placeholder="Enter your full name"
            value={field.value}
            onBlur={field.onBlur}
            onChangeText={field.onChange}
            error={fieldState.error?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="email"
        render={({ field, fieldState }) => (
          <CXInput
            label="Email or Phone"
            icon="mail-outline"
            placeholder="Enter email or phone number"
            keyboardType="email-address"
            autoCapitalize="none"
            value={field.value}
            onBlur={field.onBlur}
            onChangeText={field.onChange}
            error={fieldState.error?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="password"
        render={({ field, fieldState }) => (
          <CXInput
            label="Password"
            icon="lock-closed-outline"
            placeholder="Create a password"
            secureTextEntry
            value={field.value}
            onBlur={field.onBlur}
            onChangeText={field.onChange}
            error={fieldState.error?.message}
            hint="Use 8+ characters with letters, numbers & symbols"
          />
        )}
      />
      <CXButton label="Continue" iconRight="arrow-forward" loading={isSubmitting} onPress={submit} />
      <CXText variant="caption" color={colors.textMuted} align="center">
        By continuing, you agree to our{" "}
        <CXText variant="caption" color={colors.primary}>
          Terms of Service
        </CXText>{" "}
        and{" "}
        <CXText variant="caption" color={colors.primary}>
          Privacy Policy
        </CXText>
        .
      </CXText>
    </SignupShell>
  );
}

export function SignupProfileScreen({
  navigation,
}: NativeStackScreenProps<RootStackParamList, "SignupProfile">) {
  const draft = useSignupStore();
  const [values, setValues] = React.useState({
    college: draft.college || "",
    department: draft.department || "",
    academicYear: draft.academicYear || "",
    graduationYear: draft.graduationYear || "",
  });
  const [error, setError] = React.useState<string | null>(null);
  const [openDropdown, setOpenDropdown] = React.useState<string | null>(null);

  const toggleDropdown = (key: string) => {
    setOpenDropdown((prev) => (prev === key ? null : key));
  };

  const selectValue = (key: keyof typeof values, val: string) => {
    setValues((current) => ({ ...current, [key]: val }));
    setOpenDropdown(null);
  };

  const updateValue = (key: keyof typeof values, val: string) => {
    setValues((current) => ({ ...current, [key]: val }));
  };

  return (
    <SignupShell>
      <CXHeader title="" onBack={navigation.goBack} />
      <StepHeader
        step={2}
        title="Profile Setup"
        subtitle="Tell us about your academic profile"
      />
      <View style={styles.heroIcon}>
        <Ionicons name="school-outline" size={38} color={colors.primary} />
      </View>
      <CXDropdown
        zIndex={4}
        label="College"
        placeholder="Select College"
        value={values.college}
        options={colleges}
        isOpen={openDropdown === "college"}
        onToggle={() => toggleDropdown("college")}
        onSelect={(val) => selectValue("college", val)}
        onChangeText={(val) => updateValue("college", val)}
      />
      <CXDropdown
        zIndex={3}
        label="Department"
        placeholder="Select Department"
        value={values.department}
        options={departments}
        isOpen={openDropdown === "department"}
        onToggle={() => toggleDropdown("department")}
        onSelect={(val) => selectValue("department", val)}
        onChangeText={(val) => updateValue("department", val)}
      />
      <CXDropdown
        zIndex={2}
        label="Academic Year"
        placeholder="Select Year"
        value={values.academicYear}
        options={years}
        isOpen={openDropdown === "academicYear"}
        onToggle={() => toggleDropdown("academicYear")}
        onSelect={(val) => selectValue("academicYear", val)}
        onChangeText={(val) => updateValue("academicYear", val)}
      />
      <CXDropdown
        zIndex={1}
        label="Graduation Year"
        placeholder="Expected Graduation"
        value={values.graduationYear}
        options={graduations}
        isOpen={openDropdown === "graduationYear"}
        onToggle={() => toggleDropdown("graduationYear")}
        onSelect={(val) => selectValue("graduationYear", val)}
        onChangeText={(val) => updateValue("graduationYear", val)}
      />
      <View style={styles.info}>
        <CXText variant="small" color={colors.inkSoft}>
          💡 These details help us show relevant classes, groups & events.
        </CXText>
      </View>
      {error ? (
        <CXText variant="small" color={colors.danger} align="center">
          {error}
        </CXText>
      ) : null}
      <CXButton
        label="Continue"
        iconRight="arrow-forward"
        onPress={() => {
          if (!values.college || !values.department || !values.academicYear || !values.graduationYear) {
            setError("Please fill out all fields");
            return;
          }
          setError(null);
          draft.patch(values);
          navigation.navigate("SignupInterests");
        }}
      />
    </SignupShell>
  );
}

const interestOptions = [
  ["Coding", "code-slash-outline"],
  ["Design", "color-palette-outline"],
  ["AI & ML", "hardware-chip-outline"],
  ["Business", "briefcase-outline"],
  ["Sports", "football-outline"],
  ["Music", "musical-notes-outline"],
  ["Photography", "camera-outline"],
  ["Reading", "book-outline"],
  ["Other", "ellipsis-horizontal"],
] as const;

export function SignupInterestsScreen({
  navigation,
}: NativeStackScreenProps<RootStackParamList, "SignupInterests">) {
  const draft = useSignupStore();
  const setSession = useAppStore((state) => state.setSession);
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const submit = async () => {
    if (draft.interests.length < 2) {
      setError("Choose at least two interests");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const response = await api.post<{
        data: { accessToken: string; refreshToken: string; user: any };
      }>("/auth/signup", {
        fullName: draft.fullName,
        email: draft.email,
        password: draft.password,
        college: draft.college,
        department: draft.department,
        academicYear: draft.academicYear,
        graduationYear: draft.graduationYear,
        interests: draft.interests,
      });
      await setSession(
        response.data.data.accessToken,
        response.data.data.refreshToken,
        response.data.data.user
      );
      navigation.reset({ index: 0, routes: [{ name: "SignupSuccess" }] });
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <SignupShell>
      <CXHeader title="" onBack={navigation.goBack} />
      <StepHeader
        step={3}
        title="What interests you?"
        subtitle="Choose a few to get better suggestions"
      />
      <View style={styles.heroIcon}>
        <Ionicons name="heart-outline" size={38} color={colors.primary} />
      </View>
      <View style={styles.interestGrid}>
        {interestOptions.map(([label, icon]) => {
          const selected = draft.interests.includes(label);
          return (
            <Pressable
              key={label}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected }}
              onPress={() => draft.toggleInterest(label)}
              style={[styles.interest, selected && styles.interestSelected]}
            >
              <Ionicons
                name={icon}
                size={18}
                color={selected ? colors.primary : colors.inkSoft}
              />
              <CXText variant="smallStrong">{label}</CXText>
              {selected ? (
                <Ionicons
                  name="checkmark-circle"
                  size={15}
                  color={colors.primary}
                />
              ) : null}
            </Pressable>
          );
        })}
      </View>
      <CXText variant="caption" color={colors.textMuted} align="center">
        You can update these later in Profile.
      </CXText>
      {error ? (
        <CXText variant="small" color={colors.danger} align="center">
          {error}
        </CXText>
      ) : null}
      <CXButton
        label="Continue"
        loading={submitting}
        onPress={() => void submit()}
      />
    </SignupShell>
  );
}



function SignupShell({ children }: React.PropsWithChildren) {
  return (
    <CXKeyboardScreen edges={[]} backgroundColor={colors.white}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {children}
      </ScrollView>
    </CXKeyboardScreen>
  );
}

export function SignupSuccessScreen({
  navigation,
}: NativeStackScreenProps<RootStackParamList, "SignupSuccess">) {
  const draft = useSignupStore();
  
  return (
    <SignupShell>
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingVertical: 40, gap: 24 }}>
        <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: colors.primary + "20", justifyContent: "center", alignItems: "center" }}>
          <Ionicons name="checkmark-circle" size={50} color={colors.primary} />
        </View>
        <CXText variant="h1" align="center">Account Created!</CXText>
        <CXText color={colors.textMuted} align="center" style={{ paddingHorizontal: 20 }}>
          Welcome to CampusX, {draft.fullName.split(" ")[0] || "Student"}! Your account has been successfully set up.
        </CXText>
      </View>
      <CXButton
        label="Go to Dashboard"
        onPress={() => {
          draft.reset();
          navigation.reset({ index: 0, routes: [{ name: "Main" }] });
        }}
      />
    </SignupShell>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 28,
    gap: spacing.md,
  },
  stepHeader: { gap: spacing.xs },
  stepTop: { justifyContent: "space-between" },
  progressTrack: { flexDirection: "row", gap: 5, marginBottom: spacing.sm },
  progressSegment: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
  progressActive: { backgroundColor: colors.primary },
  heroIcon: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceLavender,
    marginVertical: spacing.xs,
  },
  choiceWrap: { gap: spacing.xs },
  choice: {
    minHeight: 50,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
  },
  choiceOpen: {
    borderColor: colors.primary,
  },
  dropdownList: {
    marginTop: spacing.xs,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    overflow: "hidden",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.sm,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  dropdownItemSelected: {
    backgroundColor: colors.surfaceLavender,
  },
  info: {
    padding: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceLavender,
  },
  interestGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  interest: {
    width: "48%",
    minHeight: 48,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.white,
  },
  interestSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceLavender,
  },
});

import React from "react";
