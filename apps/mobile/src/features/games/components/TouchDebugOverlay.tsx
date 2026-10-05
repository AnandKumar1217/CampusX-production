import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { globalTouchManager } from '../engine/MultiTouchManager';

export function TouchDebugOverlay() {
  const [p1Count, setP1Count] = useState(0);
  const [p2Count, setP2Count] = useState(0);
  const [touches, setTouches] = useState<{id: string, x: number, y: number, p: number}[]>([]);

  useEffect(() => {
    if (!__DEV__) return;
    const interval = setInterval(() => {
      const p1 = globalTouchManager.getActiveTouchesForPlayer(1);
      const p2 = globalTouchManager.getActiveTouchesForPlayer(2);
      setP1Count(p1.length);
      setP2Count(p2.length);
      setTouches([
        ...p1.map(t => ({ id: t.pointerId, x: t.currentX, y: t.currentY, p: 1 })),
        ...p2.map(t => ({ id: t.pointerId, x: t.currentX, y: t.currentY, p: 2 }))
      ]);
    }, 50);
    return () => clearInterval(interval);
  }, []);

  if (!__DEV__) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={styles.stats}>
        <Text style={styles.text}>P1 ACTIVE POINTERS: {p1Count}</Text>
        <Text style={styles.text}>P2 ACTIVE POINTERS: {p2Count}</Text>
      </View>
      {touches.map(t => (
        <View 
          key={t.id} 
          style={[
            styles.touch, 
            { 
              left: t.x - 20, 
              top: t.y - 20,
              borderColor: t.p === 1 ? '#3B82F6' : '#EC4899'
            }
          ]} 
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  stats: {
    position: 'absolute',
    top: 100,
    left: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 10,
    borderRadius: 8,
    zIndex: 9999,
  },
  text: {
    color: 'white',
    fontFamily: 'monospace',
    fontSize: 12,
  },
  touch: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
    zIndex: 9998,
  }
});
