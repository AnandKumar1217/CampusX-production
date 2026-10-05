import { zodResolver } from "@hookform/resolvers/zod";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Image } from "expo-image";
import { Controller, useForm } from "react-hook-form";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { z } from "zod";
import { Ionicons } from "@expo/vector-icons";

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

import React from "react";


type ForgotProps = NativeStackScreenProps<RootStackParamList, "ForgotPassword">;

export function ForgotPasswordScreen({ navigation }: ForgotProps) {
  const [isOtpSent, setIsOtpSent] = React.useState(false);
  const [countdown, setCountdown] = React.useState(0);
  const lastAttemptedOtpRef = React.useRef<string>("");
  const schema = z.object({
    email: z.string().min(3, "Enter a valid email or username"),
    otp: z.string().optional(),
  });
  const { control, handleSubmit, setError, formState, watch, getValues } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { email: "", otp: "" },
  });

  const otpValue = watch("otp");

  React.useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  React.useEffect(() => {
    if (isOtpSent && otpValue && /^[0-9]{6}$/.test(otpValue) && !formState.isSubmitting && otpValue !== lastAttemptedOtpRef.current) {
      lastAttemptedOtpRef.current = otpValue;
      submit();
    }
  }, [otpValue, isOtpSent, formState.isSubmitting]);

  const submit = handleSubmit(async (values) => {
    try {
      if (!isOtpSent) {
        await api.post("/auth/forgot-password", { value: values.email });
        setIsOtpSent(true);
        setCountdown(30);
      } else {
        if (!values.otp || values.otp.length < 4) {
          setError("otp", { message: "Please enter the OTP" });
          return;
        }
        const response = await api.post("/auth/verify-forgot-password-otp", { 
          email: values.email, 
          otp: values.otp 
        });
        const resetToken = response.data.data.resetToken;
        navigation.navigate("ResetPassword", { token: resetToken } as any);
      }
    } catch (error) {
      setError("root", { message: getApiErrorMessage(error) });
    }
  });

  return (
    <AuthShell>
      <CXHeader title="" onBack={navigation.goBack} />
      <CXText variant="h2">Forgot Password?</CXText>
      <CXText color={colors.textMuted}>
        Don’t worry! Enter your registered email and
        we’ll send an OTP to reset your password.
      </CXText>
      
      <Controller
        control={control}
        name="email"
        render={({ field, fieldState }) => (
          <CXInput
            label="Email or Username"
            icon="mail-outline"
            placeholder="Enter your email or username"
            keyboardType="default"
            autoCapitalize="none"
            editable={!isOtpSent}
            value={field.value}
            onBlur={field.onBlur}
            onChangeText={field.onChange}
            error={fieldState.error?.message}
          />
        )}
      />
      
      {isOtpSent && (
        <Controller
          control={control}
          name="otp"
          render={({ field, fieldState }) => (
            <CXInput
              label="Verification Code (OTP)"
              icon="keypad-outline"
              placeholder="Enter the OTP sent to email"
              keyboardType="number-pad"
              value={field.value}
              onBlur={field.onBlur}
              onChangeText={(val) => {
                const numeric = val.replace(/\D/g, "").slice(0, 6);
                field.onChange(numeric);
              }}
              error={fieldState.error?.message}
            />
          )}
        />
      )}

      <View style={styles.infoBox}>
        <CXText variant="small" color={colors.inkSoft}>
          ⓘ We will send a one-time code to your registered email account.
        </CXText>
      </View>
      {isOtpSent && (
        <View style={{ flexDirection: "row", justifyContent: "center", marginVertical: spacing.sm }}>
          <Pressable
            disabled={countdown > 0}
            onPress={async () => {
              try {
                await api.post("/auth/forgot-password", { value: getValues().email });
                setCountdown(30);
              } catch (err) {
                setError("root", { message: getApiErrorMessage(err) });
              }
            }}
          >
            <CXText variant="smallStrong" color={countdown > 0 ? colors.textMuted : colors.primary}>
              {countdown > 0 ? `Resend Code in ${countdown}s` : "Resend Code"}
            </CXText>
          </Pressable>
        </View>
      )}
      <View style={{ minHeight: 24, justifyContent: "center", marginVertical: spacing.xs }}>
        {formState.errors.root?.message ? (
          <CXText color={colors.danger} variant="small">{formState.errors.root.message}</CXText>
        ) : null}
      </View>
      <CXButton
        label={isOtpSent ? "Verify & Reset" : "Send OTP"}
        loading={formState.isSubmitting}
        onPress={submit}
        disabled={isOtpSent ? (otpValue?.length !== 6) : false}
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
  const [isSuccess, setIsSuccess] = React.useState(false);
  const { control, handleSubmit, setError, formState } = useForm<
    z.infer<typeof resetSchema>
  >({
    resolver: zodResolver(resetSchema),
    defaultValues: { password: "", confirm: "" },
  });
  const submit = handleSubmit(async (values) => {
    try {
      await api.post("/auth/reset-password", {
        token: (route.params as any)?.token,
        password: values.password,
      });
      setIsSuccess(true);
      setTimeout(() => {
        navigation.reset({ index: 0, routes: [{ name: "Login" }] });
      }, 3000);
    } catch (error) {
      setError("root", { message: getApiErrorMessage(error) });
    }
  });

  if (isSuccess) {
    return (
      <AuthShell>
        <CXHeader title="" onBack={() => navigation.navigate("Login")} />
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingVertical: 40, gap: 24 }}>
          <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: colors.primary + "20", justifyContent: "center", alignItems: "center" }}>
            <Ionicons name="checkmark-circle" size={50} color={colors.primary} />
          </View>
          <CXText variant="h1" align="center">Password Changed!</CXText>
          <CXText color={colors.textMuted} align="center" style={{ paddingHorizontal: 20 }}>
            Your password has been successfully updated.
          </CXText>
          <Pressable onPress={() => navigation.reset({ index: 0, routes: [{ name: "Login" }] })}>
             <CXText variant="bodyStrong" color={colors.primary}>Click here to login</CXText>
          </Pressable>
          <CXText variant="small" color={colors.textFaint}>Redirecting in 3 seconds...</CXText>
        </View>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <CXHeader title="" onBack={navigation.goBack} />
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



const styles = StyleSheet.create({

  content: {
    flexGrow: 1,
    paddingHorizontal: 26,
    paddingTop: 32,
    paddingBottom: 36,
    gap: spacing.md,
  },

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
