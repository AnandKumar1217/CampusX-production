import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import Svg, { Path, Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";

import { CXScreen, CXText } from "@/components/ui";
import { colors, spacing } from "@/theme";
import type { RootStackParamList } from "@/types/navigation";
import { useAppStore } from "@/store/appStore";

// --- Shared Background Component ---
function OnboardingBackground({ index }: { index: number }) {
  const { width, height } = useWindowDimensions();

  const renderWaves = () => {
    if (index === 0) {
      return (
        <Svg height={height * 0.3} width={width} style={{ position: 'absolute', top: 0, right: 0 }}>
          <Path d={`M${width * 0.5},0 Q${width * 0.8},${height * 0.15} ${width},${height * 0.25} L${width},0 Z`} fill="#F5F3FF" opacity={0.8} />
          <Path d={`M${width * 0.7},0 Q${width * 0.9},${height * 0.1} ${width},${height * 0.15} L${width},0 Z`} fill="#EDE9FE" opacity={0.6} />
        </Svg>
      );
    } else if (index === 1) {
      // Deeper wave matching the provided design for Screen 2
      return (
        <Svg height={height * 0.4} width={width} style={{ position: 'absolute', top: 0, right: 0 }}>
          <Path d={`M${width * 0.4},0 Q${width * 0.7},${height * 0.25} ${width},${height * 0.25} L${width},0 Z`} fill="#F5F3FF" opacity={0.9} />
          <Path d={`M${width * 0.6},0 Q${width * 0.85},${height * 0.15} ${width},${height * 0.15} L${width},0 Z`} fill="#EDE9FE" opacity={0.7} />
        </Svg>
      );
    } else {
      // Top left wave for Screen 3
      return (
        <Svg height={height * 0.3} width={width} style={{ position: 'absolute', top: 0, left: 0 }}>
          <Path d={`M0,0 L0,${height * 0.25} Q${width * 0.2},${height * 0.15} ${width * 0.5},0 Z`} fill="#F5F3FF" opacity={0.8} />
          <Path d={`M0,0 L0,${height * 0.15} Q${width * 0.1},${height * 0.1} ${width * 0.3},0 Z`} fill="#EDE9FE" opacity={0.6} />
        </Svg>
      );
    }
  };

  return (
    <View style={StyleSheet.absoluteFill}>
      {renderWaves()}

      {/* Bottom Starburst Glow */}
      <View style={{ position: 'absolute', bottom: -50, left: "-50%", right: "-50%", height: "30%", alignItems: "center", justifyContent: "center" }}>
        {/* Core bright glow */}
        <View style={{ position: 'absolute', bottom: 0, width: 300, height: 150, backgroundColor: "#D8B4FE", borderRadius: 150, opacity: 0.5, transform: [{ scaleX: 2 }], filter: 'blur(40px)' }} />
        <LinearGradient
          colors={["rgba(255,255,255,0)", "rgba(167, 139, 250, 0.2)", "rgba(124, 58, 237, 0.5)"]}
          style={{ width: "100%", height: "100%", borderTopLeftRadius: 1000, borderTopRightRadius: 1000 }}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        />
      </View>
    </View>
  );
}

type OnboardingProps = {
  index: number;
  illustration?: any;
  customIllustration?: React.ReactNode;
  title: string;
  accent: string;
  body: string;
  onNext?: () => void;
  onFinish: () => void;
  last?: boolean;
};

function Onboarding({ index, illustration, customIllustration, title, accent, body, onNext, onFinish, last }: OnboardingProps) {
  const finishOnboarding = useAppStore((state) => state.finishOnboarding);
  const { height } = useWindowDimensions();
  
  // Illustration entrance animation
  const scale = useRef(new Animated.Value(0.95)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 8, tension: 40, useNativeDriver: true }),
    ]).start();
  }, [opacity, scale]);

  const finish = async () => {
    await finishOnboarding();
    onFinish();
  };

  return (
    <CXScreen edges={[]} backgroundColor="#FAFAFC">
      <OnboardingBackground index={index} />
      
      <Pressable accessibilityRole="button" onPress={finish} style={styles.skip}>
        <CXText variant="bodyStrong" color="#7C3AED">Skip</CXText>
      </Pressable>
      
      <View style={styles.content}>
        
        {/* Illustration Area */}
        <Animated.View style={[styles.illustrationContainer, { opacity, transform: [{ scale }] }]}>
          {customIllustration ? (
            customIllustration
          ) : (
            <Image
              source={illustration}
              contentFit="contain"
              style={[styles.illustration, { height: Math.min(height * 0.5, 450) }]}
            />
          )}
        </Animated.View>
        
        {/* Bottom Content Area */}
        <View style={styles.bottomArea}>
          
          <View style={styles.copy}>
            <CXText variant="h1" align="center" style={styles.titleBlack}>{title}</CXText>
            <CXText variant="h1" align="center" style={styles.titlePurple}>{accent}</CXText>
            <CXText color={colors.textMuted} align="center" style={styles.body}>{body}</CXText>
          </View>
          
          <View style={styles.dots}>
            {[0, 1, 2].map((dot) => (
              <View key={dot} style={[styles.dot, dot === index && styles.activeDot]} />
            ))}
          </View>
          
          <Pressable
            style={({ pressed }) => [styles.primaryButton, pressed && { opacity: 0.9 }]}
            onPress={() => (last ? void finish() : onNext?.())}
          >
            <CXText style={styles.buttonText}>{last ? "Get Started" : "Next"}</CXText>
            <Ionicons name="arrow-forward" size={24} color="#FFFFFF" style={styles.buttonIcon} />
          </Pressable>

        </View>
      </View>
    </CXScreen>
  );
}

// --- Specific Screens ---
export function OnboardingOneScreen(props: NativeStackScreenProps<RootStackParamList, "OnboardingOne">) {
  return (
    <Onboarding
      index={0}
      illustration={require("../../../assets/onboarding/campus-world-transparent.png")}
      title="Your Campus."
      accent="Your World."
      body="Everything you need for a smarter, simpler, and better campus life."
      onNext={() => props.navigation.replace("OnboardingTwo")}
      onFinish={() => props.navigation.replace("Login")}
    />
  );
}

export function OnboardingTwoScreen(props: NativeStackScreenProps<RootStackParamList, "OnboardingTwo">) {
  return (
    <Onboarding
      index={1}
      illustration={require("../../../assets/onboarding/connect-collaborate-transparent.png")}
      title="Connect. Collaborate."
      accent="Achieve Together."
      body="Chat with friends, join groups, share notes, and collaborate seamlessly."
      onNext={() => props.navigation.replace("OnboardingThree")}
      onFinish={() => props.navigation.replace("Login")}
    />
  );
}

export function OnboardingThreeScreen(props: NativeStackScreenProps<RootStackParamList, "OnboardingThree">) {
  return (
    <Onboarding
      index={2}
      illustration={require("../../../assets/onboarding/track-grow-transparent.png")}
      title="Track. Learn."
      accent="Grow Every Day."
      body="Stay on top of your academics with smart insights and AI-powered suggestions."
      onFinish={() => props.navigation.replace("Login")}
      last
    />
  );
}

const styles = StyleSheet.create({
  skip: {
    position: "absolute",
    zIndex: 10,
    top: 56,
    right: 28,
    padding: spacing.xs,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 48,
    justifyContent: "space-between",
  },
  illustrationContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
    marginBottom: 10,
    zIndex: 5,
  },
  illustration: {
    width: "100%",
  },
  bottomArea: {
    alignItems: "center",
    zIndex: 10,
  },
  copy: {
    alignItems: "center",
    marginBottom: 32,
  },
  titleBlack: {
    fontSize: 34,
    fontWeight: "800",
    color: "#111827",
    letterSpacing: -0.5,
    lineHeight: 40,
  },
  titlePurple: {
    fontSize: 34,
    fontWeight: "800",
    color: "#6D28D9",
    letterSpacing: -0.5,
    lineHeight: 40,
    marginBottom: 12,
  },
  body: {
    maxWidth: 300,
    fontSize: 16,
    lineHeight: 24,
    color: "#6B7280",
  },
  dots: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 36,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#E5E7EB",
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#6D28D9",
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#6D28D9",
    width: "100%",
    paddingVertical: 18,
    borderRadius: 16,
    elevation: 4,
    shadowColor: "#6D28D9",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "600",
    marginRight: 8,
  },
  buttonIcon: {
    position: "absolute",
    right: 24,
  },
});
