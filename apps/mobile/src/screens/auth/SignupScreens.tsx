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
import { colleges, departments, years } from "@/constants/academic";

import React from "react";

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
          Step {step} of 2
        </CXText>
      </CXRow>
      <View style={styles.progressTrack}>
        {[1, 2].map((item) => (
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
  username: z.string().min(3, "Use at least 3 characters").max(30, "Too long").regex(/^[a-z0-9_.]+$/, "Only lowercase letters, numbers, dots, and underscores"),
  email: z.string().email("Enter a valid email address"),
  otp: z.string().length(6, "Code must be 6 digits"),
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
      username: draft.username,
      email: draft.email,
      otp: "",
      password: draft.password,
    },
  });
  const [usernameSuggestions, setUsernameSuggestions] = React.useState<string[]>([]);
  const [showOtp, setShowOtp] = React.useState(false);

  const [sendingOtp, setSendingOtp] = React.useState(false);

  const submit = handleSubmit(async (values) => {
    try {
      setUsernameSuggestions([]);
      await api.post("/auth/check-identity", { email: values.email, username: values.username, otp: values.otp });
      draft.patch(values);
      navigation.navigate("SignupProfile");
    } catch (err: any) {
      if (err.response?.data?.code === "USERNAME_TAKEN") {
        const suggestions = err.response.data.details?.suggestions;
        if (suggestions && suggestions.length > 0) {
          setUsernameSuggestions(suggestions);
        }
        setError("username", { message: getApiErrorMessage(err) });
      } else if (err.response?.data?.code === "EMAIL_EXISTS") {
        setError("email", { message: getApiErrorMessage(err) });
      } else {
        setError("email", { message: getApiErrorMessage(err) });
      }
    }
  });
  return (
    <SignupShell>
      <CXHeader title="" onBack={() => { draft.reset(); navigation.goBack(); }} />
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
        name="username"
        render={({ field, fieldState }) => (
          <View>
            <CXInput
              label="Username"
              icon="at-outline"
              placeholder="Choose a username"
              autoCapitalize="none"
              value={field.value}
              onBlur={field.onBlur}
              onChangeText={(val) => {
                setUsernameSuggestions([]);
                field.onChange(val);
              }}
              error={fieldState.error?.message}
            />
            {usernameSuggestions.length > 0 && (
              <View style={{ marginTop: -spacing.sm, marginBottom: spacing.md }}>
                <CXText variant="small" color={colors.textMuted} style={{ marginBottom: spacing.xs }}>
                  Suggestions:
                </CXText>
                <CXRow style={{ flexWrap: "wrap", gap: spacing.xs }}>
                  {usernameSuggestions.map((suggestion) => (
                    <Pressable
                      key={suggestion}
                      onPress={() => {
                        field.onChange(suggestion);
                        setUsernameSuggestions([]);
                      }}
                      style={{
                        paddingHorizontal: spacing.sm,
                        paddingVertical: spacing.xs,
                        backgroundColor: colors.primaryTint,
                        borderRadius: radius.pill,
                      }}
                    >
                      <CXText variant="smallStrong" color={colors.primary}>
                        {suggestion}
                      </CXText>
                    </Pressable>
                  ))}
                </CXRow>
              </View>
            )}
          </View>
        )}
      />
      <Controller
        control={control}
        name="email"
        render={({ field, fieldState }) => (
          <CXInput
            label="Email"
            icon="mail-outline"
            placeholder="Enter your email address"
            keyboardType="email-address"
            autoCapitalize="none"
            value={field.value}
            onBlur={field.onBlur}
            onChangeText={field.onChange}
            error={fieldState.error?.message}
            trailing={
              <Pressable
                onPress={async () => {
                  const email = field.value;
                  if (!email || !email.includes("@")) {
                    setError("email", { message: "Enter a valid email first" });
                    return;
                  }
                  try {
                    setSendingOtp(true);
                    await api.post("/auth/send-verification-otp", { email });
                    setShowOtp(true);
                  } catch (err: any) {
                    setError("email", { message: getApiErrorMessage(err) });
                  } finally {
                    setSendingOtp(false);
                  }
                }}
                disabled={sendingOtp}
                style={{
                  paddingHorizontal: spacing.sm,
                  paddingVertical: 6,
                  backgroundColor: colors.primaryTint,
                  borderRadius: radius.pill,
                  opacity: sendingOtp ? 0.7 : 1,
                }}
              >
                <CXText variant="smallStrong" color={colors.primary}>
                  {sendingOtp ? "Sending..." : showOtp ? "Resend" : "Verify"}
                </CXText>
              </Pressable>
            }
          />
        )}
      />
      {showOtp && (
        <Controller
          control={control}
          name="otp"
          render={({ field, fieldState }) => (
            <CXInput
              label="Verification Code"
              icon="keypad-outline"
              placeholder="Enter 6-digit code"
              keyboardType="number-pad"
              maxLength={6}
              value={field.value}
              onBlur={field.onBlur}
              onChangeText={field.onChange}
              error={fieldState.error?.message}
            />
          )}
        />
      )}
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
  const setSession = useAppStore((state) => state.setSession);
  const [submitting, setSubmitting] = React.useState(false);
  const [values, setValues] = React.useState({
    college: draft.college || "",
    otherCollege: "",
    department: draft.department || "",
    otherDepartment: "",
    academicYear: draft.academicYear || "",
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
      {values.college === "Other" && (
        <CXInput
          label="Enter your College"
          placeholder="e.g. My Custom College"
          value={values.otherCollege}
          onChangeText={(val) => updateValue("otherCollege", val)}
        />
      )}
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
      {values.department === "Other" && (
        <CXInput
          label="Enter your Department"
          placeholder="e.g. History"
          value={values.otherDepartment}
          onChangeText={(val) => updateValue("otherDepartment", val)}
        />
      )}
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
        loading={submitting}
        onPress={async () => {
          const finalCollege = values.college === "Other" ? values.otherCollege.trim() : values.college;
          const finalDepartment = values.department === "Other" ? values.otherDepartment.trim() : values.department;

          if (!finalCollege || !finalDepartment || !values.academicYear) {
            setError("Please fill out all fields");
            return;
          }
          setError(null);
          setSubmitting(true);
          try {
            const response = await api.post<{
              data: { accessToken: string; refreshToken: string; user: any };
            }>("/auth/signup", {
              fullName: draft.fullName,
              username: draft.username,
              email: draft.email,
              password: draft.password,
              college: finalCollege,
              department: finalDepartment,
              academicYear: values.academicYear,
              interests: [],
              otp: draft.otp,
            });
            await setSession(
              response.data.data.accessToken,
              response.data.data.refreshToken,
              response.data.data.user
            );
            draft.reset();
            navigation.reset({ index: 0, routes: [{ name: "SignupSuccess" }] });
          } catch (caught) {
            setError(getApiErrorMessage(caught));
          } finally {
            setSubmitting(false);
          }
        }}
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
