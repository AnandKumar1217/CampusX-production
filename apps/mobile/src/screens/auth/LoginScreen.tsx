import { zodResolver } from "@hookform/resolvers/zod";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Image } from "expo-image";
import { Controller, useForm } from "react-hook-form";
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { z } from "zod";
import Svg, { Path } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

import {
  CXButton,
  CXInput,
  CXKeyboardScreen,
  CXRow,
  CXText,
} from "@/components/ui";
import { api, getApiErrorMessage } from "@/services/api";
import { useAppStore } from "@/store/appStore";
import { colors, spacing } from "@/theme";
import type { RootStackParamList } from "@/types/navigation";

const schema = z.object({
  identity: z.string().min(3, "Enter your email, username, or phone number"),
  password: z.string().min(8, "Password must contain at least 8 characters"),
});
type Form = z.infer<typeof schema>;
type Props = NativeStackScreenProps<RootStackParamList, "Login">;

const logo = require("../../../assets/branding/campusx-logo-new-transparent.png");

function LoginBackground() {
  const { width, height } = useWindowDimensions();

  return (
    <View style={StyleSheet.absoluteFill}>
      <Svg height={height} width={width} style={{ position: 'absolute', top: 0, left: 0, pointerEvents: "none" }}>
        {/* Top right subtle wave */}
        <Path d={`M${width * 0.4},0 Q${width * 0.7},${height * 0.25} ${width},${height * 0.25} L${width},0 Z`} fill="#F5F3FF" opacity={0.9} />
        <Path d={`M${width * 0.6},0 Q${width * 0.85},${height * 0.15} ${width},${height * 0.15} L${width},0 Z`} fill="#EDE9FE" opacity={0.7} />
      </Svg>
    </View>
  );
}

export function LoginScreen({ navigation }: Props) {
  const setSession = useAppStore((state) => state.setSession);
  const { control, handleSubmit, setError, formState } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { identity: "", password: "" },
  });

  const submit = handleSubmit(async (values) => {
    try {
      const response = await api.post<{
        data: { accessToken: string; refreshToken: string; user: any };
      }>("/auth/login", values);
      await setSession(
        response.data.data.accessToken,
        response.data.data.refreshToken,
        response.data.data.user
      );
      navigation.reset({ index: 0, routes: [{ name: "Main" }] });
    } catch (error) {
      setError("root", { message: getApiErrorMessage(error) });
    }
  });

  return (
    <CXKeyboardScreen edges={[]} backgroundColor="#FAFAFC">
      <LoginBackground />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.copy}>
          <CXText variant="smallStrong" color={colors.primary}>
            Welcome Back!
          </CXText>
          <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 4 }}>
            <CXText variant="h1" style={{ color: "#111827" }}>Connect. Learn.{"\n"}Grow </CXText>
            <CXText variant="h1" color={colors.primary}>
              Together.
            </CXText>
          </View>
          <CXText color={colors.textMuted} style={{ marginTop: 8 }}>
            Login to continue your CampusX journey
          </CXText>
        </View>

        <View style={styles.logoContainer}>
          <Image source={logo} contentFit="contain" style={styles.logo} />
          <CXText variant="smallStrong" color={colors.primary} align="center" style={{ marginTop: 2 }}>
            Connect • Learn • Grow
          </CXText>
        </View>
        <View style={styles.form}>
          <Controller
            control={control}
            name="identity"
            render={({ field, fieldState }) => (
              <CXInput
                label="Email / Username / Phone"
                icon="person-outline"
                placeholder="Enter email, username, or phone"
                autoCapitalize="none"
                autoComplete="username"
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
                placeholder="Enter password"
                secureTextEntry
                autoComplete="current-password"
                value={field.value}
                onBlur={field.onBlur}
                onChangeText={field.onChange}
                error={fieldState.error?.message}
              />
            )}
          />
          <Pressable
            onPress={() => navigation.navigate("ForgotPassword")}
            style={styles.forgot}
          >
            <CXText variant="smallStrong" color={colors.primary}>
              Forgot Password?
            </CXText>
          </Pressable>
          {formState.errors.root?.message ? (
            <CXText variant="small" color={colors.danger} align="center">
              {formState.errors.root.message}
            </CXText>
          ) : null}
          <CXButton
            label="Login"
            loading={formState.isSubmitting}
            onPress={submit}
          />
        </View>
        <View style={styles.dividerRow}>
          <View style={styles.line} />
          <CXText variant="caption" color={colors.textMuted}>
            or continue with
          </CXText>
          <View style={styles.line} />
        </View>
        <CXRow style={styles.socialRow}>
          <SocialButton label="Google" iconName="logo-google" color="#DB4437" />
          <SocialButton label="Apple" iconName="logo-apple" color="#000000" />
          <SocialButton label="Phone" iconName="call" color="#6D28D9" />
        </CXRow>
        <CXRow style={styles.signup}>
          <CXText color={colors.textMuted}>Don’t have an account? </CXText>
          <Pressable onPress={() => navigation.navigate("SignupAccount")}>
            <CXText variant="bodyStrong" color={colors.primary}>
              Sign Up
            </CXText>
          </Pressable>
        </CXRow>
      </ScrollView>
    </CXKeyboardScreen>
  );
}

function SocialButton({ label, iconName, color }: { label: string; iconName: keyof typeof Ionicons.glyphMap; color: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Continue with ${label}`}
      style={styles.socialButton}
    >
      <Ionicons name={iconName} size={18} color={color} style={{ marginRight: 6 }} />
      <CXText variant="smallStrong" style={{ color: "#111827", fontSize: 11 }}>{label}</CXText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    paddingHorizontal: 26,
    paddingTop: 58,
    paddingBottom: 24,
  },
  copy: { marginBottom: spacing.xl },
  logoContainer: { alignSelf: "center", marginBottom: spacing.xl },
  logo: { width: 110, height: 102 },
  form: { gap: spacing.md },
  forgot: { alignSelf: "flex-end", marginTop: -6 },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginVertical: spacing.xl,
  },
  line: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  socialRow: { justifyContent: "space-between", gap: spacing.sm },
  socialButton: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  signup: { justifyContent: "center", marginTop: spacing.xl },
});
