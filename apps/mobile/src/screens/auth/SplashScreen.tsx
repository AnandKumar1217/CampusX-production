import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Image } from "expo-image";
import { useEffect, useRef } from "react";
import { Animated, StyleSheet, View, Text, useWindowDimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path, Line } from "react-native-svg";
import { StatusBar } from "expo-status-bar";

import { CXScreen } from "@/components/ui";
import { colors } from "@/theme";
import type { RootStackParamList } from "@/types/navigation";
import { useAppStore } from "@/store/appStore";
import { consumePendingRoute, isColdStartProcessed, markColdStartProcessed } from "@/navigation/PushRoutingManager";
import * as Notifications from "expo-notifications";

type Props = NativeStackScreenProps<RootStackParamList, "Splash">;

const logo = require("../../../assets/branding/campusx-logo-new-transparent.png");

export function SplashScreen({ navigation }: Props) {
  const hydrated = useAppStore(state => state.hydrated);
  const onboardingComplete = useAppStore(state => state.onboardingComplete);
  const accessToken = useAppStore(state => state.accessToken);
  const hydrate = useAppStore(state => state.hydrate);
  const fetchCurrentUser = useAppStore(state => state.fetchCurrentUser);
  const { width, height } = useWindowDimensions();

  // Animation values
  const bgOpacity = useRef(new Animated.Value(0)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.97)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const glowScale = useRef(new Animated.Value(0.98)).current;

  useEffect(() => {
    void hydrate();

    // Entrance Animation Sequence
    Animated.sequence([
      // 0-500ms: Background fade in
      Animated.timing(bgOpacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      // 150-700ms: Logo fade in + scale
      Animated.parallel([
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 550,
          useNativeDriver: true,
        }),
        Animated.spring(logoScale, {
          toValue: 1,
          friction: 7,
          tension: 52,
          useNativeDriver: true,
        }),
      ]),
      // 300-850ms: Tagline fade in
      Animated.timing(textOpacity, {
        toValue: 1,
        duration: 550,
        useNativeDriver: true,
      }),
    ]).start();

    // Continuous breathing animation for bottom glow
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowScale, {
          toValue: 1.02,
          duration: 3000,
          useNativeDriver: true,
        }),
        Animated.timing(glowScale, {
          toValue: 0.98,
          duration: 3000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [hydrate, bgOpacity, logoOpacity, logoScale, textOpacity, glowScale]);

  useEffect(() => {
    if (!hydrated) return;
    
    let isMounted = true;
    
    const initializeApp = async () => {
      if (accessToken) {
        try {
          await fetchCurrentUser();
          if (isMounted) {
            let target = consumePendingRoute();
            
            if (!isColdStartProcessed()) {
              markColdStartProcessed();
              const response = await Notifications.getLastNotificationResponseAsync();
              const data = response?.notification?.request?.content?.data;
              if (!target && data) {
                if (data.route) {
                  target = { screen: data.route as any, params: data.params };
                } else if (data.url) {
                  const url = data.url as string;
                  const screenStr = url.replace("campusx://", "");
                  target = { screen: (screenStr || "Main") as any, params: data.params };
                }
              }
            }

            if (target && target.screen && target.screen !== "Main") {
              navigation.reset({
                index: 1,
                routes: [
                  { name: "Main" },
                  { name: target.screen, params: target.params }
                ]
              });
            } else {
              navigation.replace("Main");
            }
          }
        } catch (error) {
          console.log("Failed to fetch user on startup:", error);
          if (isMounted) navigation.replace("Login");
        }
      } else if (onboardingComplete) {
        if (isMounted) navigation.replace("Login");
      } else {
        if (isMounted) navigation.replace("OnboardingOne");
      }
    };

    const timer = setTimeout(() => {
      void initializeApp();
    }, 2500); // Increased timeout to let animations play out
    
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [accessToken, hydrated, navigation, onboardingComplete, fetchCurrentUser]);

  // Perspective floor calculations
  const centerX = width / 2;
  const horizonY = height * 0.7; // 70% down
  const floorHeight = height * 0.3;

  // Generate perspective rays
  const rays = [];
  const numRays = 12;
  for (let i = 0; i <= numRays; i++) {
    const angle = (Math.PI * i) / numRays;
    const x2 = centerX + Math.cos(angle) * width * 1.5;
    const y2 = horizonY + Math.sin(angle) * floorHeight * 2;
    rays.push(
      <Line
        key={`ray-${i}`}
        x1={centerX}
        y1={horizonY}
        x2={x2}
        y2={y2}
        stroke="rgba(167, 139, 250, 0.15)"
        strokeWidth="1"
      />
    );
  }

  // Generate horizontal perspective grid lines
  const gridLines = [];
  const numGridLines = 5;
  for (let i = 1; i <= numGridLines; i++) {
    const yOffset = Math.pow(i / numGridLines, 2) * floorHeight;
    gridLines.push(
      <Line
        key={`grid-${i}`}
        x1={0}
        y1={horizonY + yOffset}
        x2={width}
        y2={horizonY + yOffset}
        stroke="rgba(167, 139, 250, 0.15)"
        strokeWidth="1"
      />
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      <Animated.View style={[styles.background, { opacity: bgOpacity }]}>
        
        {/* Top Decorative Waves */}
        <Svg height={height * 0.4} width={width} style={styles.topSvg}>
          <Path
            d={`M0,0 L0,${height * 0.2} Q${width * 0.3},${height * 0.25} ${width * 0.8},0 Z`}
            fill="#F5F3FF"
          />
          <Path
            d={`M0,0 L0,${height * 0.1} Q${width * 0.4},${height * 0.18} ${width},0 Z`}
            fill="#EDE9FE"
            opacity={0.6}
          />
        </Svg>

        {/* Bottom Effects */}
        <View style={styles.bottomEffectsContainer}>
          <Svg height={height} width={width} style={StyleSheet.absoluteFill}>
            {rays}
            {gridLines}
            
            {/* Bottom-Right Curve */}
            <Path
              d={`M${width},${height} L${width},${height * 0.75} Q${width * 0.6},${height * 0.85} ${width * 0.2},${height} Z`}
              fill="#F5F3FF"
              opacity={0.7}
            />
          </Svg>

          {/* Central Glow */}
          <Animated.View
            style={[
              styles.glowWrapper,
              { transform: [{ scale: glowScale }] },
            ]}
          >
            <LinearGradient
              colors={["rgba(255,255,255,0)", "rgba(196, 181, 253, 0.4)", "rgba(167, 139, 250, 0.1)"]}
              style={styles.glowGradient}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
            />
          </Animated.View>
        </View>

      </Animated.View>

      {/* Branding Container */}
      <View style={styles.brandingContainer}>
        <Animated.View
          style={[
            styles.logoWrap,
            { opacity: logoOpacity, transform: [{ scale: logoScale }] },
          ]}
        >
          <Image source={logo} contentFit="contain" style={styles.logo} />
          <View style={styles.wordmarkContainer}>
            <Text style={styles.wordmarkBlack}>Campus</Text>
            <Text style={styles.wordmarkPurple}>X</Text>
          </View>
        </Animated.View>

        <Animated.View style={[styles.taglineWrap, { opacity: textOpacity }]}>
          <Text style={styles.tagline}>Campus, simply connected.</Text>
        </Animated.View>
      </View>
      
      <View accessibilityLabel="CampusX loading" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  background: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#FFFFFF", // Base color
  },
  topSvg: {
    position: "absolute",
    top: 0,
    left: 0,
  },
  bottomEffectsContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    top: 0,
  },
  glowWrapper: {
    position: "absolute",
    bottom: 0,
    left: "-50%",
    right: "-50%",
    height: "50%",
    alignItems: "center",
  },
  glowGradient: {
    width: "100%",
    height: "100%",
    borderTopLeftRadius: 1000,
    borderTopRightRadius: 1000,
  },
  brandingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: "10%", // Shift logo slightly above center
    zIndex: 10,
  },
  logoWrap: {
    width: "45%", // adjusted for icon
    aspectRatio: 1, // new logo is square
    alignItems: "center",
    justifyContent: "center",
  },
  logo: {
    width: "100%",
    height: "100%",
  },
  wordmarkContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
  },
  wordmarkBlack: {
    fontSize: 32,
    fontWeight: "700",
    color: "#000000",
    letterSpacing: -0.5,
  },
  wordmarkPurple: {
    fontSize: 32,
    fontWeight: "700",
    color: "#7C3AED", // Match logo purple
    letterSpacing: -0.5,
  },
  taglineWrap: {
    marginTop: 28, // Pushed further down as requested
  },
  tagline: {
    color: "#5B55A5",
    fontSize: 16, // 15-17px
    fontWeight: "400",
    letterSpacing: 0.5,
    textAlign: "center",
  },
});
