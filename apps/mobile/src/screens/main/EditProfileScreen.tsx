import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import React, { useState } from "react";
import * as ImagePicker from "expo-image-picker";
import { ScrollView, StyleSheet, View, Pressable, TextInput, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRootNavigation } from "@/hooks/useRootNavigation";
import { useAppStore } from "@/store/appStore";
import { colors, radius, spacing } from "@/theme";
import {
  CXButton,
  CXHeader,
  CXKeyboardScreen,
  CXText,
  CXDropdown,
} from "@/components/ui";

import { colleges, departments, years } from "@/constants/academic";

const defaultAvatar = require("../../../assets/avatars/anand.png");

export function EditProfileScreen() {
  const navigation = useRootNavigation();
  const currentUser = useAppStore((state) => state.user);
  const updateUser = useAppStore((state) => state.updateUser);
  
  // Local state for the form
  const [name, setName] = useState(currentUser?.name || "");
  const [username, setUsername] = useState(currentUser?.username || "");
  const [college, setCollege] = useState(currentUser?.college || "");
  const [department, setDepartment] = useState(currentUser?.department || "");
  const [academicYear, setAcademicYear] = useState(currentUser?.academicYear || "");
  const [bio, setBio] = useState(currentUser?.bio || "Just a student at CampusX!");
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  const toggleDropdown = (key: string) => {
    setOpenDropdown((prev) => (prev === key ? null : key));
  };

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      setAvatarUri(result.assets[0].uri);
    }
  };
  
    const handleSave = async () => {
    try {
      const { api } = require("@/services/api");
      let finalAvatarUrl = currentUser?.avatarUrl;
      
      if (avatarUri && avatarUri !== currentUser?.avatarUrl) {
        const formData = new FormData();
        const filename = avatarUri.split('/').pop() || 'avatar.jpg';
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? "image/$(match[1])" : "image";

        formData.append('file', {
          uri: avatarUri,
          name: filename,
          type,
        } as any);

        const uploadRes = await api.post('/upload', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          }
        });
        
        finalAvatarUrl = uploadRes.data.data.url;
      }

      await api.patch("/users/me", {
        name,
        avatarUrl: finalAvatarUrl,
        college,
        department,
        academicYear,
        bio,
      });

      updateUser({
        name,
        username,
        avatarUrl: finalAvatarUrl,
        college,
        department,
        academicYear,
        bio,
      } as any);
      (navigation as any).navigate("Main", {
        screen: "Profile",
        params: { profileUpdated: true },
      });
    } catch (e) {
      Alert.alert("Error", "Failed to update profile");
    }
  };

  return (
    <CXKeyboardScreen>
      <CXHeader title="Edit Profile" onBack={navigation.goBack} />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.avatarSection}>
          <View>
            <Image
              source={avatarUri ? { uri: avatarUri } : (currentUser?.avatarUrl ? { uri: currentUser.avatarUrl } : defaultAvatar)}
              style={styles.avatar}
              contentFit="cover"
            />
            <Pressable style={styles.editBadge} onPress={pickImage}>
              <Ionicons name="camera" size={16} color={colors.white} />
            </Pressable>
          </View>
        </View>

        <View style={styles.formGroup}>
          <CXText variant="captionStrong" color={colors.textMuted}>Name</CXText>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Your Name"
              placeholderTextColor={colors.textMuted}
            />
          </View>
        </View>

        <View style={styles.formGroup}>
          <CXText variant="captionStrong" color={colors.textMuted}>Username</CXText>
          <View style={styles.inputContainer}>
            <TextInput
              style={[styles.input, { color: colors.textMuted }]}
              value={username}
              onChangeText={setUsername}
              placeholder="username"
              autoCapitalize="none"
              placeholderTextColor={colors.textMuted}
              editable={false}
            />
          </View>
        </View>

        <View style={[styles.formGroup, { zIndex: 3 }]}>
          <CXDropdown
            zIndex={3}
            label="College"
            placeholder="Select College"
            value={college}
            options={colleges}
            isOpen={openDropdown === "college"}
            onToggle={() => toggleDropdown("college")}
            onSelect={(val) => { setCollege(val); setOpenDropdown(null); }}
            onChangeText={setCollege}
          />
        </View>

        <View style={[styles.formGroup, { zIndex: 2 }]}>
          <CXDropdown
            zIndex={2}
            label="Department"
            placeholder="Select Department"
            value={department}
            options={departments}
            isOpen={openDropdown === "department"}
            onToggle={() => toggleDropdown("department")}
            onSelect={(val) => { setDepartment(val); setOpenDropdown(null); }}
            onChangeText={setDepartment}
          />
        </View>

        <View style={[styles.formGroup, { zIndex: 1 }]}>
          <CXDropdown
            zIndex={1}
            label="Academic Year"
            placeholder="Select Year"
            value={academicYear}
            options={years}
            isOpen={openDropdown === "academicYear"}
            onToggle={() => toggleDropdown("academicYear")}
            onSelect={(val) => { setAcademicYear(val); setOpenDropdown(null); }}
            onChangeText={setAcademicYear}
          />
        </View>

        <View style={styles.formGroup}>
          <CXText variant="captionStrong" color={colors.textMuted}>Bio</CXText>
          <View style={styles.inputContainer}>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={bio}
              onChangeText={setBio}
              placeholder="Tell us about yourself"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              placeholderTextColor={colors.textMuted}
            />
          </View>
        </View>

        <CXButton label="Save Changes" onPress={handleSave} style={{ marginTop: spacing.xl }} />
      </ScrollView>
    </CXKeyboardScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.screen,
    paddingBottom: 40,
  },
  avatarSection: {
    alignItems: "center",
    paddingVertical: spacing.xl,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  editBadge: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primary,
    borderWidth: 3,
    borderColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  formGroup: {
    marginBottom: spacing.md,
  },
  inputContainer: {
    marginTop: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceLavender,
    paddingHorizontal: spacing.sm,
  },
  input: {
    height: 48,
    fontSize: 16,
    color: colors.ink,
  },
  textArea: {
    height: 100,
    paddingTop: spacing.sm,
  }
});

