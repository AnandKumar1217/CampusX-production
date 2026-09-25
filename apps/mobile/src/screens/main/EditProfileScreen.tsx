import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import * as ImagePicker from "expo-image-picker";
import { ScrollView, StyleSheet, View, Pressable, TextInput, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRootNavigation } from "@/hooks/useRootNavigation";
import { useAppStore } from "@/store/appStore";
import { colors, radius, spacing } from "@/theme";
import {
  CXButton,
  CXAvatar,
  CXHeader,
  CXKeyboardScreen,
  CXText,
  CXDropdown,
} from "@/components/ui";

import { colleges, departments, years } from "@/constants/academic";

export function EditProfileScreen() {
  const navigation = useRootNavigation();
  const currentUser = useAppStore((state) => state.user);
  const updateUser = useAppStore((state) => state.updateUser);
  
  // Local state for the form
  const [name, setName] = useState(currentUser?.name || "");
  const [username, setUsername] = useState(currentUser?.username || "");
  const isCustomCollege = currentUser?.college && !colleges.includes(currentUser.college);
  const [college, setCollege] = useState(isCustomCollege ? "Other" : (currentUser?.college || ""));
  const [otherCollege, setOtherCollege] = useState(isCustomCollege ? currentUser.college : "");

  const isCustomDept = currentUser?.department && !departments.includes(currentUser.department);
  const [department, setDepartment] = useState(isCustomDept ? "Other" : (currentUser?.department || ""));
  const [otherDepartment, setOtherDepartment] = useState(isCustomDept ? currentUser.department : "");

  const [academicYear, setAcademicYear] = useState(currentUser?.academicYear || "");
  const [bio, setBio] = useState(currentUser?.bio || "");
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [usernameSuggestions, setUsernameSuggestions] = useState<string[]>([]);

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

    if (!result.canceled && result.assets?.[0]?.uri) {
      setAvatarUri(result.assets[0].uri);
    }
  };
  
    const handleSave = async () => {
      setIsSaving(true);
      try {
        const { api } = require("@/services/api");
        let finalAvatarUrl = currentUser?.avatarUrl;
      
      if (avatarUri && avatarUri !== currentUser?.avatarUrl) {
        const formData = new FormData();
        const filename = avatarUri.split('/').pop() || 'avatar.jpg';
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : "image";

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

      const finalCollege = college === "Other" ? (otherCollege ?? "").trim() : college;
      const finalDepartment = department === "Other" ? (otherDepartment ?? "").trim() : department;

      if (!finalCollege || !finalDepartment) {
         Alert.alert("Error", "Please fill out all academic fields");
         setIsSaving(false);
         return;
      }

      await api.patch("/users/me", {
        name,
        username: username.trim().toLowerCase(),
        avatarUrl: finalAvatarUrl,
        college: finalCollege,
        department: finalDepartment,
        academicYear,
        bio,
      });

      updateUser({
        name,
        username,
        avatarUrl: finalAvatarUrl,
        college: finalCollege,
        department: finalDepartment,
        academicYear,
        bio,
      } as any);
      (navigation as any).navigate("Main", {
        screen: "Profile",
        params: { profileUpdated: true },
      });
    } catch (_e) {
      const e = _e as any;
      if (e.response?.data?.code === "USERNAME_TAKEN") {
        const suggestions = e.response.data.details?.suggestions;
        if (suggestions && suggestions.length > 0) {
          setUsernameSuggestions(suggestions);
        }
        Alert.alert("Username taken", "Username is already taken");
      } else if (e.config?.url?.includes("/upload")) {
        Alert.alert("Upload Failed", "Couldn't upload profile photo. Try again.");
      } else {
        Alert.alert("Error", "Couldn't save changes. Check your connection.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <CXKeyboardScreen>
      <CXHeader title="Edit Profile" onBack={navigation.goBack} />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" nestedScrollEnabled={true}>
        <View style={styles.avatarSection}>
          <View>
            <View style={styles.avatar}>
              <CXAvatar source={avatarUri || currentUser?.avatarUrl || undefined} name={name || "CampusX user"} size={96} />
            </View>
            <Pressable style={styles.editBadge} onPress={pickImage}>
              <Ionicons name="camera" size={16} color={colors.white} />
            </Pressable>
          </View>
        </View>

        <View style={styles.formGroup}>
          <CXText variant="smallStrong" color={colors.textMuted}>Name</CXText>
          <View style={[styles.inputContainer, styles.editable]}>
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
          <CXText variant="smallStrong" color={colors.textMuted}>Username</CXText>
          <View style={[styles.inputContainer, styles.editable]}>
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={(val) => {
                setUsernameSuggestions([]);
                setUsername(val);
              }}
              placeholder="username"
              autoCapitalize="none"
              placeholderTextColor={colors.textMuted}
            />
          </View>
          {usernameSuggestions.length > 0 && (
            <View style={{ marginTop: spacing.sm }}>
              <CXText variant="small" color={colors.textMuted} style={{ marginBottom: spacing.xs }}>
                Suggestions:
              </CXText>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
                {usernameSuggestions.map((suggestion) => (
                  <Pressable
                    key={suggestion}
                    onPress={() => {
                      setUsername(suggestion);
                      setUsernameSuggestions([]);
                    }}
                    style={{
                      paddingHorizontal: spacing.sm,
                      paddingVertical: spacing.xs,
                      backgroundColor: colors.primaryTint,
                      borderRadius: radius.pill,
                    }}
                  >
                    <CXText variant="smallStrong" color={colors.primary}>
                      {suggestion}
                    </CXText>
                  </Pressable>
                ))}
              </View>
            </View>
          )}
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
            editable={true}
            containerStyle={styles.editable}
          />
        </View>

        {college === "Other" && (
          <View style={styles.formGroup}>
            <View style={[styles.inputContainer, styles.editable]}>
              <TextInput
                style={styles.input}
                value={otherCollege}
                onChangeText={setOtherCollege}
                placeholder="e.g. My Custom College"
                placeholderTextColor={colors.textMuted}
              />
            </View>
          </View>
        )}

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
            editable={true}
            containerStyle={styles.editable}
          />
        </View>

        {department === "Other" && (
          <View style={styles.formGroup}>
            <View style={[styles.inputContainer, styles.editable]}>
              <TextInput
                style={styles.input}
                value={otherDepartment}
                onChangeText={setOtherDepartment}
                placeholder="e.g. History"
                placeholderTextColor={colors.textMuted}
              />
            </View>
          </View>
        )}

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
            editable={true}
            containerStyle={styles.editable}
          />
        </View>

        <View style={styles.formGroup}>
          <CXText variant="smallStrong" color={colors.textMuted}>Bio</CXText>
          <View style={[styles.inputContainer, styles.editable, { minHeight: 100 }]}>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={bio}
              onChangeText={setBio}
              placeholder="Tell us about yourself"
              multiline={true}
              numberOfLines={4}
              textAlignVertical="top"
              placeholderTextColor={colors.textMuted}
            />
          </View>
        </View>

        <CXButton 
          label={isSaving ? "Saving..." : "Save Changes"} 
          onPress={handleSave} 
          disabled={isSaving} 
          style={{ marginTop: spacing.xl }} 
        />
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
    paddingHorizontal: spacing.sm,
  },
  editable: {
    backgroundColor: colors.white,
  },
  locked: {
    backgroundColor: colors.surfaceLavender,
    borderColor: "transparent",
  },
  input: {
    height: 48,
    fontSize: 16,
    color: colors.ink,
  },
  textArea: {
    paddingTop: spacing.sm,
  }
});

