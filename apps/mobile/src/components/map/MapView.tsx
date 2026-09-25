import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { Map, Camera, UserLocation, Marker as MLMarker } from '@maplibre/maplibre-react-native';

export default function MapView(props: any) {
  const { 
    region, 
    showsUserLocation, 
    children, 
    style,
    onPress,
    onPoiClick
  } = props;

  return (
    <Map 
      style={style}
      mapStyle="https://tiles.openfreemap.org/styles/liberty"
      logoEnabled={false}
      attributionEnabled={false}
      compassEnabled={props.showsCompass !== false}
      pitchEnabled={props.pitchEnabled !== false}
      rotateEnabled={props.rotateEnabled !== false}
      scrollEnabled={props.scrollEnabled !== false}
      zoomEnabled={props.zoomEnabled !== false}
      onPress={(event) => {
        // Simple adaptation of onPress / onPoiClick
        if (onPress && event && event.nativeEvent && event.nativeEvent.lngLat) {
          const lngLat = event.nativeEvent.lngLat;
          const features = (event.nativeEvent as any).features;
          const name = features && features.length > 0 ? features[0].properties?.name : undefined;
          
          onPress({ 
            nativeEvent: { 
              coordinate: { 
                latitude: lngLat[1],
                longitude: lngLat[0]
              },
              name: name
            }
          });
        }
      }}
    >
      {region && (
        <Camera
          ref={props.cameraRef}
          initialViewState={{
            center: [region.longitude, region.latitude],
            zoom: props.zoomLevel || 16,
          }}
          animationMode="flyTo"
          animationDuration={500}
        />
      )}
      {showsUserLocation && (
        <UserLocation visible={true} showsUserHeadingIndicator={true} />
      )}
      {children}
    </Map>
  );
}

export function Marker(props: any) {
  const { coordinate, onPress, children, title, pinColor, id, anchor } = props;
  const [markerId] = React.useState(id || title || `marker-${Math.random()}`);
  
  if (!coordinate || !Number.isFinite(coordinate.longitude) || !Number.isFinite(coordinate.latitude)) {
    return null;
  }

  return (
    <MLMarker
      id={markerId}
      lngLat={[coordinate.longitude, coordinate.latitude]}
      anchor={anchor || "center"}
      onPress={onPress ? (e: any) => {
        if (e && e.stopPropagation) e.stopPropagation();
        onPress();
      } : undefined}
    >
      {children ? children : (
        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: pinColor || 'red', borderWidth: 3, borderColor: 'white' }} />
      )}
    </MLMarker>
  );
}

export function Callout(props: any) {
  return <View {...props} />;
}
