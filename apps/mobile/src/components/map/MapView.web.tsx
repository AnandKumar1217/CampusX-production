import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const MapView = ({ children, style, ...props }: any) => (
  <View style={[style, styles.container]}>
    <Text style={styles.text}>Map is not supported on web</Text>
    <View style={{ display: 'none' }}>{children}</View>
  </View>
);

export const Marker = ({ children }: any) => <>{children}</>;

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: '#6b7280',
    fontSize: 16,
    fontWeight: '500',
  }
});

export default MapView;
