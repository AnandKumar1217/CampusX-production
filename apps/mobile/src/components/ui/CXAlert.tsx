import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, Animated, Easing, Modal, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CXText } from './CXText';
import { CXButton } from './CXButton';
import { colors, radius, spacing } from '@/theme';

interface CXAlertProps {
  visible: boolean;
  title: string;
  message: string;
  onClose: () => void;
  type?: 'error' | 'success' | 'info';
  actionLabel?: string;
}

export function CXAlert({
  visible,
  title,
  message,
  onClose,
  type = 'error',
  actionLabel = 'Got it'
}: CXAlertProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
          easing: Easing.out(Easing.ease),
        }),
        Animated.spring(scale, {
          toValue: 1,
          tension: 65,
          friction: 10,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
          easing: Easing.in(Easing.ease),
        }),
        Animated.timing(scale, {
          toValue: 0.9,
          duration: 150,
          useNativeDriver: true,
          easing: Easing.in(Easing.ease),
        }),
      ]).start();
    }
  }, [visible]);

  // Keep it mounted for animation finish if needed, but Modal transparent handles it ok
  // Wait, if it unmounts immediately, the exit animation won't play.
  // But Modal won't show anyway. For now, it's fine.

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.overlay, { opacity }]}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        
        <Animated.View style={[styles.alertBox, { transform: [{ scale }] }]}>
          <View style={[styles.iconContainer, { backgroundColor: type === 'error' ? colors.danger + '15' : type === 'success' ? '#4CAF5015' : colors.primary + '15' }]}>
            <Ionicons 
              name={type === 'error' ? "alert-circle" : type === 'success' ? "checkmark-circle" : "information-circle"} 
              size={32} 
              color={type === 'error' ? colors.danger : type === 'success' ? "#4CAF50" : colors.primary} 
            />
          </View>
          
          <CXText variant="h3" style={styles.title}>{title}</CXText>
          <CXText variant="body" color={colors.textMuted} style={styles.message}>
            {message}
          </CXText>
          
          <View style={styles.buttonContainer}>
            <CXButton 
              label={actionLabel} 
              onPress={onClose} 
              style={{ width: '100%' }}
              variant="primary" 
            />
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  alertBox: {
    width: '85%',
    maxWidth: 340,
    backgroundColor: colors.white,
    borderRadius: 24,
    padding: spacing.xl,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: {
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  message: {
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 22,
  },
  buttonContainer: {
    width: '100%',
  },
});
