import React, { useState } from "react";
import { View, StyleSheet, ScrollView, Alert, Image, Pressable, ActivityIndicator, Platform , TextInput, View as RNView } from "react-native";
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { Ionicons } from "@expo/vector-icons";
import { CXHeader, CXScrollScreen, CXText, CXButton } from "@/components/ui";
import { CXSnackbar } from "@/components/ui/CXSnackbar";
import { api } from "@/services/api";
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { eventService } from "@/services/eventService";
const CustomInput = ({label, error, ...props}: any) => (
  <RNView style={{marginBottom: 16}}>
    <CXText style={{marginBottom: 4, fontWeight: "600", fontSize: 13, color: error ? theme.colors.danger : theme.colors.textSecondary}}>{label}</CXText>
    <TextInput 
      style={{
        borderWidth: 1, 
        borderColor: error ? theme.colors.danger : theme.colors.border, 
        padding: 12, 
        borderRadius: 8, 
        backgroundColor: theme.colors.surface, 
        fontSize: 14,
        color: theme.colors.text
      }} 
      placeholderTextColor={theme.colors.textSecondary}
      {...props} 
    />
    {error ? <CXText style={{color: theme.colors.danger, fontSize: 12, marginTop: 4}}>{error}</CXText> : null}
  </RNView>
);
const theme = { colors: { primary: "#7c3aed", text: "#1f2937", textSecondary: "#6b7280", surface: "#ffffff", surfaceHover: "#f3f4f6", background: "#f9fafb", danger: "#ef4444", border: "#e5e7eb", success: "#10b981" } };
// We would ideally import a DateTimePicker, but standard text inputs or native integrations might be needed here
// I'll assume we use basic string inputs for a prototype, or a placeholder for real date pickers.

export function CreateEventScreen({ navigation, route }: any) {
  const queryClient = useQueryClient();
  const editMode = !!route.params?.event;
  const event = route.params?.event;

  const [form, setForm] = useState({
    title: event?.title || "",
    description: event?.description || "",
    category: event?.category || "",
    location: event?.location || "",
    lat: event?.coordinates?.coordinates?.[1] || null,
    lng: event?.coordinates?.coordinates?.[0] || null,
    capacity: event?.capacity?.toString() || "",
    startsAt: event?.startsAt ? new Date(event.startsAt) : new Date(Date.now() + 86400000), // tomorrow
    endsAt: event?.endsAt ? new Date(event.endsAt) : null,
    imageUri: event?.imageUrl || event?.image || ""
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const [isGettingLocation, setIsGettingLocation] = useState(false);

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) {
      setForm({ ...form, imageUri: result.assets?.[0]?.uri || "" });
    }
  };

  const getCurrentLocation = async () => {
    setIsGettingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission to access location was denied');
        setIsGettingLocation(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const geocode = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude
      });
      
      let locName = "Current Location";
      if (geocode && geocode.length > 0) {
        locName = `${geocode[0]?.name || geocode[0]?.street || ""}, ${geocode[0]?.city || geocode[0]?.subregion || ""}`.replace(/^, | , $/g, "");
      }
      
      setForm({ 
        ...form, 
        location: locName,
        lat: location.coords.latitude,
        lng: location.coords.longitude
      });
    } catch (error) {
      Alert.alert('Error', 'Could not fetch location.');
    } finally {
      setIsGettingLocation(false);
    }
  };

  const handlePickDate = (field: 'startsAt' | 'endsAt') => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: form[field] || new Date(),
        mode: 'date',
        onChange: (event, date) => {
          if (event.type === 'set' && date) {
            DateTimePickerAndroid.open({
              value: date,
              mode: 'time',
              onChange: (timeEvent, time) => {
                if (timeEvent.type === 'set' && time) {
                  setForm(f => ({ ...f, [field]: time }));
                }
              }
            });
          }
        }
      });
    }
  };

  const mutation = useMutation({
    mutationFn: (data: any) => {
      if (editMode) {
        return eventService.updateEvent(event.id, data);
      }
      return eventService.createEvent(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      if (editMode) {
        queryClient.invalidateQueries({ queryKey: ["event", event.id] });
      }
      navigation.goBack();
    },
    onError: (err: any) => {
      Alert.alert("Error", err.response?.data?.message || "Failed to save event");
    }
  });

  const handleSave = async (isDraft: boolean) => {
    const newErrors: Record<string, string> = {};
    if (!form.title) newErrors.title = "Event title is required";
    if (!form.category) newErrors.category = "Category is required";
    if (!form.location) newErrors.location = "Location is required";
    if (!form.startsAt) newErrors.startsAt = "Start time is required";
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setSnackbarMessage("Please fill in all highlighted required fields.");
      setSnackbarVisible(true);
      return;
    }
    
    setErrors({});

    const payload: any = {
      title: form.title,
      description: form.description,
      category: form.category,
      location: { name: form.location },
      startsAt: form.startsAt,
      draft: isDraft,
      capacity: form.capacity ? parseInt(form.capacity) : undefined
    };

    if (form.lat && form.lng) {
      payload.location = {
        name: form.location,
        type: "Point",
        coordinates: [form.lng, form.lat]
      };
    }

    if (form.imageUri && form.imageUri !== event?.image) {
      try {
        const formData = new FormData();
        const filename = form.imageUri.split('/').pop() || 'cover.jpg';
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : "image";
        
        formData.append('file', {
          uri: form.imageUri,
          name: filename,
          type,
        } as any);

        const uploadRes = await api.post('/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        
        payload.imageUrl = uploadRes.data.data.url;
        payload.imagePublicId = uploadRes.data.data.publicId;
      } catch (err) {
        Alert.alert("Error", "Failed to upload image.");
        return;
      }
    }
    
    if (form.endsAt) payload.endsAt = form.endsAt;
    if (form.capacity) payload.capacity = parseInt(form.capacity, 10);

    mutation.mutate(payload);
  };

  return (
    <View style={{flex: 1, backgroundColor: theme.colors.background}}>
      <CXScrollScreen>
        <CXHeader title={editMode ? "Edit Event" : "Create Event"} onBack={() => navigation.goBack()} />
      <View style={styles.form}>
        <CXText style={{fontWeight: "600", marginBottom: 8}}>Event Image</CXText>
        {form.imageUri ? (
          <View style={{position: 'relative', marginBottom: 16}}>
            <Image source={{uri: form.imageUri}} style={{width: '100%', height: 160, borderRadius: 12}} />
            <Pressable 
              style={{position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.5)', padding: 6, borderRadius: 20}}
              onPress={() => setForm({...form, imageUri: ''})}
            >
              <Ionicons name="close" color="#fff" size={20} />
            </Pressable>
          </View>
        ) : (
          <Pressable 
            style={{width: '100%', height: 160, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', marginBottom: 16, backgroundColor: theme.colors.surfaceHover}}
            onPress={pickImage}
          >
            <Ionicons name="image-outline" color={theme.colors.textSecondary} size={32} />
            <CXText style={{marginTop: 8, color: theme.colors.textSecondary, fontSize: 14}}>Tap to add event image</CXText>
          </Pressable>
        )}
        <CustomInput 
          label="Event Title *"
          placeholder="What's happening?"
          value={form.title}
          error={errors.title}
          onChangeText={(v: string) => { setForm({ ...form, title: v }); setErrors({...errors, title: ''}); }}
        />
        <CustomInput 
          label="Description"
          placeholder="Tell people about your event..."
          value={form.description}
          onChangeText={(v: string) => setForm({ ...form, description: v })}
          multiline
          numberOfLines={4}
        />
        <CustomInput 
          label="Category *"
          placeholder="e.g. Academic, Tech, Sports"
          value={form.category}
          error={errors.category}
          onChangeText={(v: string) => { setForm({ ...form, category: v }); setErrors({...errors, category: ''}); }}
        />
        <View style={{ marginBottom: 16 }}>
          <CXText variant="caption" style={{marginBottom: 4, fontWeight: "600", color: errors.location ? theme.colors.danger : theme.colors.text}}>Location *</CXText>
          <TextInput 
            style={{borderWidth: 1, borderColor: errors.location ? theme.colors.danger : "#e5e7eb", padding: 12, borderRadius: 8, backgroundColor: "#fff", color: theme.colors.text}}
            placeholder="Where is it taking place?"
            placeholderTextColor={theme.colors.textSecondary}
            value={form.location}
            onChangeText={(v: string) => { setForm({ ...form, location: v, lat: null, lng: null }); setErrors({...errors, location: ''}); }}
          />
          {errors.location ? <CXText style={{color: theme.colors.danger, fontSize: 12, marginTop: 4}}>{errors.location}</CXText> : null}
          <Pressable 
            onPress={getCurrentLocation} 
            style={{ flexDirection: "row", alignItems: "center", marginTop: 8 }}
            disabled={isGettingLocation}
          >
            {isGettingLocation ? (
              <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginRight: 8 }} />
            ) : (
              <Ionicons name="location" size={16} color={theme.colors.primary} style={{ marginRight: 4 }} />
            )}
            <CXText style={{ color: theme.colors.primary, fontWeight: "500" }}>
              {form.lat ? "Change Location / Refresh" : "Use My Current Location"}
            </CXText>
          </Pressable>
        </View>
        
        <View style={{ marginBottom: 16 }}>
          <CXText style={{marginBottom: 4, fontWeight: "600", fontSize: 13, color: errors.startsAt ? theme.colors.danger : theme.colors.textSecondary}}>Starts At *</CXText>
          <Pressable 
            style={{borderWidth: 1, borderColor: errors.startsAt ? theme.colors.danger : theme.colors.border, padding: 12, borderRadius: 8, backgroundColor: theme.colors.surface}}
            onPress={() => { handlePickDate('startsAt'); setErrors({...errors, startsAt: ''}); }}
          >
            <CXText style={{color: theme.colors.text, fontSize: 14}}>{form.startsAt ? form.startsAt.toLocaleString() : "Select date & time"}</CXText>
          </Pressable>
          {errors.startsAt ? <CXText style={{color: theme.colors.danger, fontSize: 12, marginTop: 4}}>{errors.startsAt}</CXText> : null}
        </View>
        
        <View style={{ marginBottom: 16 }}>
          <CXText style={{marginBottom: 4, fontWeight: "600", fontSize: 13, color: theme.colors.textSecondary}}>Ends At (Optional)</CXText>
          <Pressable 
            style={{borderWidth: 1, borderColor: theme.colors.border, padding: 12, borderRadius: 8, backgroundColor: theme.colors.surface}}
            onPress={() => handlePickDate('endsAt')}
          >
            <CXText style={{color: form.endsAt ? theme.colors.text : theme.colors.textSecondary, fontSize: 14}}>{form.endsAt ? form.endsAt.toLocaleString() : "Select date & time"}</CXText>
          </Pressable>
        </View>

        <CustomInput 
          label="Max Capacity (Optional)"
          placeholder="e.g. 100"
          keyboardType="numeric"
          value={form.capacity}
          onChangeText={(v: string) => setForm({ ...form, capacity: v })}
        />
        
        <View style={{ gap: 12, marginTop: 12 }}>
          <CXButton 
            label={editMode ? "Save Changes" : "Publish Event"} 
            onPress={() => handleSave(false)} 
            loading={mutation.isPending}
          />
        </View>
      </View>
      </CXScrollScreen>
      <CXSnackbar 
        visible={snackbarVisible} 
        message={snackbarMessage} 
        onDismiss={() => setSnackbarVisible(false)} 
        type="error" 
      />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { padding: 16, gap: 16, paddingBottom: 100 },
  btn: { marginTop: 16 }
});
