import { zodResolver } from "@hookform/resolvers/zod";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Image } from "expo-image";
import { Controller, useForm } from "react-hook-form";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { z } from "zod";

import {
  CXButton,
  CXHeader,
  CXInput,
  CXKeyboardScreen,
  CXRow,
  CXText,
} from "@/components/ui";
import { api, getApiErrorMessage } from "@/services/api";
import { colors, radius, spacing } from "@/theme";
import type { RootStackParamList } from "@/types/navigation";

const logo = require("../../../assets/branding/campusx-logo-new-transparent.png");
const aura = require("../../../assets/branding/bottom-aura.png");

type ForgotProps = NativeStackScreenProps<RootStackParamList, "ForgotPassword">;

export function ForgotPasswordScreen({ navigation }: ForgotProps) {
  const [method, setMethod] = React.useState<"email" | "username" | "phone">(
    "email",
  );
  const schema = z.object({
    value: z.string().min(3, `Enter your registered ${method}`),
  });
  const { control, handleSubmit, setError, formState } = useForm<{
    value: string;
  }>({ resolver: zodResolver(schema), defaultValues: { value: "" } });
  const submit = handleSubmit(async ({ value }) => {
    try {
      await api.post("/auth/forgot-password", { method, value });
      navigation.navigate("ResetPassword");
    } catch (error) {
      setError("root", { message: getApiErrorMessage(error) });
    }
  });

  return (
    <AuthShell>
      <CXHeader title="" onBack={navigation.goBack} />
      <AuthLogo />
      <CXText variant="h2">Forgot Password?</CXText>
      <CXText color={colors.textMuted}>
        Don’t worry! Enter your registered email, username, or phone number and
        we’ll send instructions to reset your password.
      </CXText>
      <CXRow style={styles.methods}>
        {(["email", "username", "phone"] as const).map((item) => (
          <Pressable
            key={item}
            onPress={() => setMethod(item)}
            style={[styles.method, method === item && styles.methodActive]}
          >
            <CXText
              variant="smallStrong"
              color={method === item ? colors.white : colors.textMuted}
            >
              {item[0]!.toUpperCase() + item.slice(1)}
            </CXText>
          </Pressable>
        ))}
      </CXRow>
      <Controller
        control={control}
        name="value"
        render={({ field, fieldState }) => (
          <CXInput
            label={`Registered ${method[0]!.toUpperCase() + method.slice(1)}`}
            icon={
              method === "email"
                ? "mail-outline"
                : method === "phone"
                  ? "call-outline"
                  : "person-outline"
            }
            placeholder={`Enter your ${method}`}
            value={field.value}
            onBlur={field.onBlur}
            onChangeText={field.onChange}
            error={fieldState.error?.message}
          />
        )}
      />
      <View style={styles.infoBox}>
        <CXText variant="small" color={colors.inkSoft}>
          ⓘ We will send a password reset link or one-time code to your
          registered account.
        </CXText>
      </View>
      {formState.errors.root?.message ? (
        <CXText color={colors.danger}>{formState.errors.root.message}</CXText>
      ) : null}
      <CXButton
        label="Send Reset Link"
        loading={formState.isSubmitting}
        onPress={submit}
      />
      <Pressable
        onPress={() => navigation.navigate("Login")}
        style={styles.centerLink}
      >
        <CXText variant="small" color={colors.textMuted}>
          Remember your password?{" "}
          <CXText variant="smallStrong" color={colors.primary}>
            Login
          </CXText>
        </CXText>
      </Pressable>
    </AuthShell>
  );
}

type ResetProps = NativeStackScreenProps<RootStackParamList, "ResetPassword">;

const resetSchema = z
  .object({
    password: z.string().min(8, "Use at least 8 characters"),
    confirm: z.string(),
  })
  .refine((value) => value.password === value.confirm, {
    path: ["confirm"],
    message: "Passwords do not match",
  });

export function ResetPasswordScreen({ navigation, route }: ResetProps) {
  const { control, handleSubmit, setError, formState } = useForm<
    z.infer<typeof resetSchema>
  >({
    resolver: zodResolver(resetSchema),
    defaultValues: { password: "", confirm: "" },
  });
  const submit = handleSubmit(async (values) => {
    try {
      await api.post("/auth/reset-password", {
        token: route.params?.token,
        password: values.password,
      });
      navigation.reset({ index: 0, routes: [{ name: "Login" }] });
    } catch (error) {
      setError("root", { message: getApiErrorMessage(error) });
    }
  });

  return (
    <AuthShell>
      <CXHeader title="" onBack={navigation.goBack} />
      <AuthLogo />
      <CXText variant="h2">Reset Password</CXText>
      <CXText color={colors.textMuted}>
        Create a new secure password for your account.
      </CXText>
      <Controller
        control={control}
        name="password"
        render={({ field, fieldState }) => (
          <CXInput
            label="New Password"
            icon="lock-closed-outline"
            placeholder="Enter new password"
            secureTextEntry
            value={field.value}
            onBlur={field.onBlur}
            onChangeText={field.onChange}
            error={fieldState.error?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="confirm"
        render={({ field, fieldState }) => (
          <CXInput
            label="Confirm Password"
            icon="lock-closed-outline"
            placeholder="Confirm new password"
            secureTextEntry
            value={field.value}
            onBlur={field.onBlur}
            onChangeText={field.onChange}
            error={fieldState.error?.message}
          />
        )}
      />
      <View style={styles.infoBox}>
        <CXText variant="small" color={colors.inkSoft}>
          ⓘ Your password should be at least 8 characters and include letters
          and numbers.
        </CXText>
      </View>
      {formState.errors.root?.message ? (
        <CXText color={colors.danger}>{formState.errors.root.message}</CXText>
      ) : null}
      <CXButton
        label="Reset Password"
        loading={formState.isSubmitting}
        onPress={submit}
      />
      <Pressable
        onPress={() => navigation.navigate("Login")}
        style={styles.centerLink}
      >
        <CXText variant="small" color={colors.textMuted}>
          Back to{" "}
          <CXText variant="smallStrong" color={colors.primary}>
            Login
          </CXText>
        </CXText>
      </Pressable>
    </AuthShell>
  );
}

function AuthShell({ children }: React.PropsWithChildren) {
  return (
    <CXKeyboardScreen edges={[]} backgroundColor={colors.white}>
      <Image source={aura} contentFit="fill" style={styles.aura} />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </CXKeyboardScreen>
  );
}

function AuthLogo() {
  return <Image source={logo} contentFit="contain" style={styles.logo} />;
}

const styles = StyleSheet.create({
  aura: { position: "absolute", bottom: 0, width: "100%", height: "28%" },
  content: {
    flexGrow: 1,
    paddingHorizontal: 26,
    paddingTop: 32,
    paddingBottom: 36,
    gap: spacing.md,
  },
  logo: { alignSelf: "center", width: 160, height: 150, marginTop: -22 },
  methods: { gap: spacing.xs },
  method: {
    flex: 1,
    minHeight: 38,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  methodActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  infoBox: {
    padding: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceLavender,
    borderWidth: 1,
    borderColor: colors.border,
  },
  centerLink: { alignSelf: "center", padding: spacing.sm },
});

import React from "react";
