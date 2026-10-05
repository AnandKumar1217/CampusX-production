import React from 'react';
import { View, Text } from 'react-native';

const MapView = (props: any) => (
  <View style={[{ backgroundColor: '#e0e0e0', alignItems: 'center', justifyContent: 'center' }, props.style]}>
    <Text>Map not supported on Web</Text>
  </View>
);

export const Marker = (): null => null;
export const Callout = (): null => null;

export default MapView;
