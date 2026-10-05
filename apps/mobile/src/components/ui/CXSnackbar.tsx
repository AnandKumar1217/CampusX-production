import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CXText } from './CXText';
import { colors, radius, spacing } from '@/theme';

interface CXSnackbarProps {
  visible: boolean;
  message: string;
  onDismiss: () => void;
  duration?: number;
  type?: 'success' | 'error';
}

export function CXSnackbar({
  visible,
  message,
  onDismiss,
  duration = 3000,
  type = 'success',
}: CXSnackbarProps) {
  const translateY = useRef(new Animated.Value(100)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
          easing: Easing.out(Easing.ease),
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setTimeout(() => {
          Animated.parallel([
            Animated.timing(translateY, {
              toValue: 100,
              duration: 300,
              useNativeDriver: true,
            }),
            Animated.timing(opacity, {
              toValue: 0,
              duration: 300,
              useNativeDriver: true,
            }),
          ]).start(() => {
            onDismiss();
          });
        }, duration);
      });
    }
  }, [visible, duration, onDismiss, opacity, translateY]);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity,
          transform: [{ translateY }],
        },
      ]}
      pointerEvents="none"
    >
      <View style={[styles.content, type === 'error' && styles.errorContent]}>
        <Ionicons name={type === 'error' ? "alert-circle" : "checkmark-circle"} size={20} color={colors.white} />
        <CXText variant="bodyStrong" color={colors.white} style={styles.text}>
          {message}
        </CXText>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: spacing.xxl,
    left: spacing.lg,
    right: spacing.lg,
    alignItems: 'center',
    zIndex: 9999,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary, // Purple color from theme
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderRadius: 20, // Curved corners, not completely pill-shaped
    // Super 3D effect
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.8,
    shadowRadius: 16,
    elevation: 12,
    borderWidth: 1.5,
    borderColor: '#987BFC', // Lighter purple for a top-edge highlight effect
    borderBottomWidth: 3, // Thicker bottom border for 3D depth
    borderBottomColor: colors.primaryDark,
  },
  errorContent: {
    backgroundColor: colors.danger,
    shadowColor: colors.danger,
    borderColor: '#ef4444',
    borderBottomColor: '#b91c1c',
  },
  text: {
    marginLeft: spacing.md,
    fontSize: 15,
  },
});
