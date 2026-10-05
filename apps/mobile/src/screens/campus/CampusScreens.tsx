import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as Location from "expo-location";
import { Alert, Switch, View } from "react-native";

import { CXHeader, CXRow, CXScreen, CXText } from "@/components/ui";
import { api } from "@/services/api";
import { useAppStore } from "@/store/appStore";
import { colors } from "@/theme";
import type { RootStackParamList } from "@/types/navigation";

type Props = NativeStackScreenProps<RootStackParamList, "LocationSettings">;

export function LocationSettingsScreen({ navigation }: Props) {
  const locationSharingEnabled = useAppStore((state) => state.locationSharingEnabled);
  const setLocationSharingEnabled = useAppStore((state) => state.setLocationSharingEnabled);

  const toggleSharing = async (value: boolean) => {
    if (value) {
      const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
      if (fgStatus !== "granted") {
        Alert.alert(
          "Permission Denied",
          "Location permission is required to share your location with friends.",
        );
        return;
      }
      
      const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
      if (bgStatus !== "granted") {
        Alert.alert(
          "Background Permission Denied",
          "Without background location permission, your friends won't see your live location when the app is closed.",
        );
        // We can still proceed with foreground-only sharing.
      }
    }

    setLocationSharingEnabled(value);
    try {
      await api.patch("/location/settings", { enabled: value });
    } catch (error) {
      setLocationSharingEnabled(!value);
      console.error("Failed to update location sharing", error);
    }
  };

  return (
    <CXScreen>
      <CXHeader title="Location Sharing" onBack={navigation.goBack} />
      <View style={{ padding: 16 }}>
        <CXText variant="body" color={colors.textMuted} style={{ marginBottom: 24 }}>
          Share your live location with your CampusX friends.
        </CXText>

        <CXRow style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <CXText variant="bodyStrong">Share My Location</CXText>
          <Switch
            value={locationSharingEnabled}
            onValueChange={(value) => void toggleSharing(value)}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={colors.white}
          />
        </CXRow>

        <CXText variant="caption" color={colors.textMuted} style={{ marginBottom: 24 }}>
          Only your accepted CampusX friends can see your live location.
        </CXText>

        <CXRow style={{ alignItems: "center", marginTop: 12 }}>
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: locationSharingEnabled ? colors.success : colors.border,
              marginRight: 8,
            }}
          />
          <CXText variant="body" color={locationSharingEnabled ? colors.success : colors.textMuted}>
            {locationSharingEnabled
              ? "Location sharing is active."
              : "Location sharing is off. Your location is hidden from friends."}
          </CXText>
        </CXRow>
      </View>
    </CXScreen>
  );
}
